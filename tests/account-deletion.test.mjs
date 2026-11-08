import test from "node:test";
import assert from "node:assert/strict";
import {
  DELETION_MARKER, AccountDeletionError, chatGPTKeys, clearLocalAccountData, createAccountDeletion, deletionErrorMessage,
  ownsKey, readDeletionMarker, requestAccountDeletion, resumeAccountDeletion, secureKeysFor,
} from "../lib/accountDeletion.mjs";
import { ACCOUNT_NOTICES, createAccountNotice } from "../lib/accountNotice.mjs";

const URL = "https://calmera.invalid/api/users/delete-account";
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => {
  if (body === undefined) throw new SyntaxError("not json");
  return body;
} });
const tokens = (value = "token") => {
  const calls = [];
  const getToken = async (options) => { calls.push(options); return typeof value === "function" ? value(options) : value; };
  return { getToken, calls };
};
const rejects = async (promise, code, extra = {}) => {
  const error = await promise.then(() => assert.fail(`expected ${code}`), (failure) => failure);
  assert.ok(error instanceof AccountDeletionError, String(error));
  assert.equal(error.code, code);
  for (const [key, value] of Object.entries(extra)) assert.equal(error[key], value, key);
  return error;
};

test("sends one authorized DELETE, using the cached token first and a fresh one on a retry", async () => {
  const sent = [];
  const fetchImpl = async (url, options) => { sent.push({ url, options }); return reply(200, { deleted: true }); };
  const { getToken, calls } = tokens("abc");
  assert.deepEqual(await requestAccountDeletion({ getToken, url: URL, fetchImpl }), { deleted: true });
  await requestAccountDeletion({ getToken, url: URL, fetchImpl, fresh: true });
  assert.deepEqual(calls, [undefined, { skipCache: true }]);
  assert.equal(sent[0].url, URL);
  assert.equal(sent[0].options.method, "DELETE");
  assert.equal(sent[0].options.headers.Authorization, "Bearer abc");
});

test("each server answer becomes a failure that says whether anything was deleted", async () => {
  const cases = [
    [reply(502, { code: "account_close_failed", dataDeleted: true }), "account_close_failed", { dataDeleted: true }],
    [reply(500, { code: "data_delete_failed", dataDeleted: false }), "failed", { dataDeleted: false }],
    [reply(404, { error: "Not found" }), "unavailable", {}],
    [reply(404), "unavailable", {}],
    [reply(429, { error: "slow down" }), "busy", {}],
    [reply(503), "unknown", {}],
    [reply(500, { error: "something else" }), "unknown", {}],
    [reply(401, { error: "Sign in" }), "sign_in_required", {}],
  ];
  for (const [response, code, extra] of cases) {
    await rejects(requestAccountDeletion({ ...tokens(), url: URL, fetchImpl: async () => response }), code, { dispatched: true, ...extra });
  }
});

test("a lost connection or a timeout means the outcome is unknown, not that nothing happened", async () => {
  await rejects(requestAccountDeletion({ ...tokens(), url: URL, fetchImpl: async () => { throw new TypeError("Network request failed"); } }),
    "unknown", { dispatched: true });
  const hangs = (url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
  await rejects(requestAccountDeletion({ ...tokens(), url: URL, fetchImpl: hangs, timeoutMs: 20 }), "unknown", { dispatched: true });
});

test("without a token nothing is sent, and an ended session after an uncertain attempt means the account is likely gone", async () => {
  let fetched = 0;
  const fetchImpl = async () => { fetched++; return reply(200, {}); };
  const offline = { getToken: async () => { throw new TypeError("Network request failed"); } };
  await rejects(requestAccountDeletion({ ...offline, url: URL, fetchImpl }), "offline", { dispatched: false });
  await rejects(requestAccountDeletion({ ...offline, url: URL, fetchImpl, mayHaveDeleted: true }), "offline");
  const revoked = { getToken: async () => { throw Object.assign(new Error("Unauthorized"), { status: 401 }); } };
  await rejects(requestAccountDeletion({ ...revoked, url: URL, fetchImpl }), "sign_in_required");
  await rejects(requestAccountDeletion({ ...revoked, url: URL, fetchImpl, mayHaveDeleted: true }), "session_ended");
  const notFound = { getToken: async () => { throw Object.assign(new Error(""), { errors: [{ code: "resource_not_found" }] }); } };
  await rejects(requestAccountDeletion({ ...notFound, url: URL, fetchImpl, mayHaveDeleted: true }), "session_ended");
  await rejects(requestAccountDeletion({ ...tokens(null), url: URL, fetchImpl }), "sign_in_required");
  await rejects(requestAccountDeletion({ ...tokens(null), url: URL, fetchImpl, mayHaveDeleted: true }), "session_ended");
  await rejects(requestAccountDeletion({ ...tokens(), url: URL, fetchImpl: async () => reply(401, {}), mayHaveDeleted: true }), "session_ended");
  assert.equal(fetched, 0);
});

test("every failure has a message, and only uncertain ones avoid saying nothing was deleted", () => {
  for (const code of ["offline", "unavailable", "busy", "sign_in_required", "failed"]) {
    assert.match(deletionErrorMessage(new AccountDeletionError(code)), /Nothing was deleted|nothing was deleted/);
  }
  for (const code of ["unknown", "account_close_failed"]) {
    assert.doesNotMatch(deletionErrorMessage(new AccountDeletionError(code)), /othing was deleted/);
    assert.match(deletionErrorMessage(new AccountDeletionError(code)), /[Tt]ry again/);
  }
  assert.match(deletionErrorMessage(null), /Try again/);
});

function fakeAppStorage(entries = {}, { failList = false } = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => { map.set(key, value); },
    removeItem: async (key) => { map.delete(key); },
    getAllKeys: async () => { if (failList) throw new Error("synthetic storage failure"); return [...map.keys()]; },
    multiRemove: async (keys) => { keys.forEach((key) => map.delete(key)); },
  };
}
function fakeSecureStore(keys = [], failing = []) {
  const map = new Map(keys.map((key) => [key, "secret"]));
  return { map, deleteItemAsync: async (key) => { if (failing.includes(key)) throw new Error("keychain"); map.delete(key); } };
}

test("only this person's calmera keys are theirs", () => {
  const me = "user_2abc";
  for (const key of [`calmera.today.v1.${me}`, `calmera.food-icons.v1.${me}`, `calmera.meal-times.${me}`,
    `calmera.theme.v1:${me}`, `calmera.account-ready.v1.${me}`, `calmera.chatgpt.${me}.model`]) assert.equal(ownsKey(key, me), true, key);
  for (const key of [`calmera.today.v1.${me}x`, `calmera.today.v1.user_2ab`, `other.today.${me}`, "calmera.theme.v1:guest",
    DELETION_MARKER, null]) assert.equal(ownsKey(key, me), false, String(key));
  assert.equal(ownsKey(`calmera.today.v1.${me}`, ""), false);
  assert.ok(chatGPTKeys(me).every((key) => ownsKey(key, me)));
  assert.equal(new Set(secureKeysFor(me)).size, 6);
});

test("clearing the phone removes this person's storage and keychain items, and nobody else's", async () => {
  const me = "user_me", other = "user_other";
  const appStorage = fakeAppStorage({
    [`calmera.today.v1.${me}`]: "{}", [`calmera.food-icons.v1.${me}`]: "{}", [`calmera.meal-times.${me}`]: "{}",
    [`calmera.theme.v1:${me}`]: "dusk", [`calmera.account-ready.v1.${me}`]: "1",
    [`calmera.today.v1.${other}`]: "{}", [`calmera.theme.v1:${other}`]: "dusk", "calmera.theme.v1:guest": "dawn", "unrelated": "x",
  });
  const keychain = fakeSecureStore([...secureKeysFor(me), ...secureKeysFor(other)]);
  let disconnected = 0;
  const failures = await clearLocalAccountData({ userId: me, asyncStorage: appStorage, secureStore: keychain,
    disconnectChatGPT: async () => { disconnected++; } });
  assert.deepEqual(failures, []);
  assert.equal(disconnected, 1);
  assert.deepEqual([...appStorage.map.keys()].sort(), [`calmera.theme.v1:${other}`, `calmera.today.v1.${other}`, "calmera.theme.v1:guest", "unrelated"].sort());
  assert.deepEqual([...keychain.map.keys()].sort(), secureKeysFor(other).sort());
});

test("ChatGPT credentials are deleted even when revoking them with OpenAI fails or stalls", async () => {
  for (const disconnectChatGPT of [async () => { throw new Error("offline"); }, () => new Promise(() => {}), () => { throw new Error("sync"); }]) {
    const keychain = fakeSecureStore(secureKeysFor("user_me"));
    const failures = await clearLocalAccountData({ userId: "user_me", asyncStorage: fakeAppStorage(), secureStore: keychain,
      disconnectChatGPT, revokeTimeoutMs: 20 });
    assert.deepEqual(failures, []);
    assert.equal(keychain.map.size, 0);
  }
});

test("anything the phone couldn't remove is reported, so it can be tried again", async () => {
  const keychain = fakeSecureStore(secureKeysFor("user_me"), ["calmera.voice.user_me"]);
  const failures = await clearLocalAccountData({ userId: "user_me", asyncStorage: fakeAppStorage({}, { failList: true }), secureStore: keychain });
  assert.deepEqual(failures, ["calmera.voice.user_me", "app-storage"]);
  assert.equal(keychain.map.size, 1);
});

// A whole deletion with recorded steps.
function harness({ outcomes = [], cleanupFailures = [], signOutFails = false } = {}) {
  const steps = [];
  const storage = fakeAppStorage();
  const requests = [];
  const deletion = createAccountDeletion({
    userId: "user_me", storage, now: () => 1,
    request: async (options) => {
      requests.push(options);
      steps.push(`request:${(storage.map.has(DELETION_MARKER) && JSON.parse(storage.map.get(DELETION_MARKER)).stage) || "none"}`);
      const outcome = outcomes[requests.length - 1] ?? "ok";
      if (outcome !== "ok") throw new AccountDeletionError(outcome, { dataDeleted: outcome === "account_close_failed" });
    },
    notify: (notice) => steps.push(`notify:${notice}`),
    signOut: async () => { steps.push("signOut"); if (signOutFails) throw new Error("session already gone"); },
    cleanup: async (userId) => { steps.push(`cleanup:${userId}`); return cleanupFailures; },
  });
  return { deletion, steps, storage, requests };
}

test("a confirmed deletion records its progress, signs out, clears the phone and leaves no marker", async () => {
  const { deletion, steps, storage } = harness();
  assert.deepEqual(await deletion(), { confirmed: true, failures: [] });
  assert.deepEqual(steps, ["request:requested", "notify:account-deleted", "signOut", "cleanup:user_me"]);
  assert.equal(storage.map.has(DELETION_MARKER), false);
});

test("a failure that deleted nothing leaves the phone and the session alone", async () => {
  for (const code of ["offline", "failed", "unavailable", "busy", "sign_in_required"]) {
    const { deletion, steps, storage } = harness({ outcomes: [code] });
    await rejects(deletion(), code);
    assert.deepEqual(steps, ["request:requested"]);
    assert.equal(storage.map.has(DELETION_MARKER), false);
  }
});

test("after a half-finished attempt the marker stays, and the retry asks for a fresh token and finishes", async () => {
  const { deletion, steps, storage, requests } = harness({ outcomes: ["account_close_failed", "ok"] });
  const error = await rejects(deletion(), "account_close_failed", { dataDeleted: true });
  assert.ok(error);
  assert.equal(JSON.parse(storage.map.get(DELETION_MARKER)).stage, "requested");
  assert.deepEqual(steps, ["request:requested"]);
  assert.deepEqual(await deletion(), { confirmed: true, failures: [] });
  assert.deepEqual(requests, [{ fresh: false, mayHaveDeleted: false }, { fresh: true, mayHaveDeleted: true }]);
  assert.equal(storage.map.has(DELETION_MARKER), false);
});

test("if the answer was lost and the session has since ended, the phone is cleared without claiming success", async () => {
  const { deletion, steps } = harness({ outcomes: ["unknown", "session_ended"] });
  await rejects(deletion(), "unknown");
  assert.deepEqual(await deletion(), { confirmed: false, failures: [] });
  assert.deepEqual(steps, ["request:requested", "request:requested", "notify:deletion-unconfirmed", "signOut", "cleanup:user_me"]);
});

test("a sign-out that fails doesn't stop the cleanup, and a cleanup that fails keeps the marker for next launch", async () => {
  const { deletion, steps, storage } = harness({ signOutFails: true, cleanupFailures: ["calmera.voice.user_me"] });
  assert.deepEqual(await deletion(), { confirmed: true, failures: ["calmera.voice.user_me"] });
  assert.ok(steps.includes("cleanup:user_me"));
  assert.equal(JSON.parse(storage.map.get(DELETION_MARKER)).stage, "deleted");
});

test("pressing twice while one deletion runs sends one request", async () => {
  const { deletion, requests } = harness();
  const [first, second] = await Promise.all([deletion(), deletion()]);
  assert.equal(requests.length, 1);
  assert.deepEqual(first, second);
});

test("on launch, an interrupted deletion is finished only when the account is gone or confirmed deleted", async () => {
  const run = async (marker, signedInUserId, cleanupFailures = []) => {
    const storage = fakeAppStorage(marker ? { [DELETION_MARKER]: JSON.stringify(marker) } : {});
    const steps = [];
    const result = await resumeAccountDeletion({ storage, signedInUserId,
      signOut: async () => { steps.push("signOut"); }, cleanup: async (userId) => { steps.push(`cleanup:${userId}`); return cleanupFailures; } });
    return { result, steps, marker: await readDeletionMarker(storage) };
  };
  assert.deepEqual(await run(null, "user_me"), { result: null, steps: [], marker: null });
  // Still signed in and never confirmed: the account may exist, so nothing is touched.
  const kept = await run({ userId: "user_me", stage: "requested" }, "user_me");
  assert.deepEqual([kept.result, kept.steps, kept.marker?.stage], [{ finished: false }, [], "requested"]);
  // Confirmed, but the app stopped before signing out.
  const confirmed = await run({ userId: "user_me", stage: "deleted" }, "user_me");
  assert.deepEqual([confirmed.steps, confirmed.marker], [["signOut", "cleanup:user_me"], null]);
  // The session ended with the account.
  const gone = await run({ userId: "user_me", stage: "requested" }, null);
  assert.deepEqual([gone.steps, gone.marker], [["cleanup:user_me"], null]);
  // Someone else signed in on this phone afterwards: only the old account's things go.
  const other = await run({ userId: "user_old", stage: "deleted" }, "user_new");
  assert.deepEqual([other.steps, other.marker], [["cleanup:user_old"], null]);
  const retryLater = await run({ userId: "user_me", stage: "deleted" }, null, ["app-storage"]);
  assert.equal(retryLater.marker?.userId, "user_me");
  assert.equal(await readDeletionMarker(fakeAppStorage({ [DELETION_MARKER]: "not json" })), null);
});

test("the sign-in notice is shown once, whether it arrives before or after Sign In appears", () => {
  const notice = createAccountNotice();
  notice.set("account-deleted");
  assert.equal(notice.take(), "account-deleted");
  assert.equal(notice.take(), null);
  const heard = [];
  const stop = notice.subscribe((value) => heard.push(value));
  notice.set("deletion-unconfirmed");
  stop();
  notice.set("account-deleted");
  assert.deepEqual(heard, ["deletion-unconfirmed"]);
  assert.ok(ACCOUNT_NOTICES["account-deleted"] && ACCOUNT_NOTICES["deletion-unconfirmed"]);
});
