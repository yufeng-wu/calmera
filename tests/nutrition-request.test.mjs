import test from "node:test";
import assert from "node:assert/strict";
import { readNutrition } from "../lib/nutritionRequest.mjs";
import { createNutritionStore } from "../lib/nutritionStore.mjs";

const options = { url: "https://calmera.invalid/api/food-entries/summaries", getToken: async () => "synthetic-token" };
const payload = { "2026-10-20": { foodEntries: [{ id: 1, food_name: "Synthetic banana" }] } };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
const response = () => ({ ok: true, status: 200, json: async () => payload });
async function failureOf(promise, code) {
  let failure;
  await promise.catch(error => { failure = error; });
  assert.ok(failure, "the synthetic read must reject");
  assert.equal(failure.message, code);
  assert.equal(failure.code, code);
  return failure;
}

test("a successful read preserves the exact URL, auth header, and parsed nutrition data", async () => {
  const calls = [];
  const result = await readNutrition({ ...options, fetchImpl: async (url, request) => {
    calls.push({ url, request }); return response();
  } });
  assert.equal(result, payload);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, options.url);
  assert.deepEqual(calls[0].request.headers, { Authorization: "Bearer synthetic-token" });
  assert.equal(calls[0].request.body, undefined);
  assert.equal(calls[0].request.signal.aborted, false);
});

test("missing credentials cannot dispatch a read", async () => {
  for (const token of [null, undefined, ""]) {
    await failureOf(readNutrition({ ...options, getToken: async () => token,
      fetchImpl: () => assert.fail("missing credentials cannot dispatch") }), "calmera_sign_in_required");
  }
});

test("HTTP failures expose only numeric status codes and never read private response bodies", async () => {
  let calls = 0;
  for (const status of [400, 401, 404, 429, 500, 503]) {
    await failureOf(readNutrition({ ...options, fetchImpl: async () => {
      calls++;
      return { ok: false, status, json: () => assert.fail("no failure body parsing"), text: () => assert.fail("no raw server text") };
    } }), `nutrition_http_${status}`);
  }
  assert.equal(calls, 6);
  await failureOf(readNutrition({ ...options, fetchImpl: async () => ({ ok: false, status: "synthetic private status" }) }), "nutrition_request_failed");
});

test("token, network, and JSON errors are sanitized without retrying", async () => {
  const raw = "synthetic private provider or server detail";
  let calls = 0;
  await failureOf(readNutrition({ ...options, getToken: async () => { throw Error(raw); },
    fetchImpl: () => assert.fail("failed token cannot dispatch") }), "nutrition_request_failed");
  await failureOf(readNutrition({ ...options, fetchImpl: async () => { calls++; throw Error(raw); } }), "nutrition_request_failed");
  await failureOf(readNutrition({ ...options, fetchImpl: async () => {
    calls++; return { ok: true, json: async () => { throw Error(raw); } };
  } }), "nutrition_request_failed");
  assert.equal(calls, 2);
});

test("stalled credentials time out and a late token cannot dispatch", async () => {
  const token = deferred(); let calls = 0;
  const error = await failureOf(readNutrition({ ...options, timeoutMs: 10, getToken: () => token.promise,
    fetchImpl: async () => { calls++; } }), "nutrition_request_timeout");
  assert.equal(error.name, "Error");
  token.resolve("late synthetic-token"); await nextTurn(); assert.equal(calls, 0);
});

test("stalled fetch is bounded even when it ignores abort; late response cannot parse", async () => {
  const fetchResult = deferred(); let calls = 0; let reads = 0; let requestSignal;
  await failureOf(readNutrition({ ...options, timeoutMs: 10, fetchImpl: async (url, request) => {
    calls++; requestSignal = request.signal; return fetchResult.promise;
  } }), "nutrition_request_timeout");
  assert.equal(requestSignal.aborted, true);
  fetchResult.resolve({ ok: true, json: async () => { reads++; return payload; } });
  await nextTurn(); assert.equal(calls, 1); assert.equal(reads, 0);
});

test("stalled JSON parsing is bounded and its late data cannot publish", async () => {
  const json = deferred(); let published = 0;
  const pending = readNutrition({ ...options, timeoutMs: 10,
    fetchImpl: async () => ({ ok: true, json: () => json.promise }) }).then(value => { published++; return value; });
  await failureOf(pending, "nutrition_request_timeout");
  json.resolve(payload); await nextTurn(); assert.equal(published, 0);
});

test("external abort during token lookup settles immediately and prevents late dispatch", async () => {
  const token = deferred(); const controller = new AbortController(); let calls = 0;
  const pending = readNutrition({ ...options, signal: controller.signal, getToken: () => token.promise,
    fetchImpl: async () => { calls++; } });
  controller.abort();
  const error = await failureOf(pending, "nutrition_request_cancelled");
  assert.equal(error.name, "AbortError");
  token.resolve("late synthetic-token"); await nextTurn(); assert.equal(calls, 0);
});

test("external abort during ignored fetch cannot parse a late response", async () => {
  const fetchResult = deferred(); const controller = new AbortController(); let reads = 0; let requestSignal;
  const pending = readNutrition({ ...options, signal: controller.signal, fetchImpl: async (url, request) => {
    requestSignal = request.signal; return fetchResult.promise;
  } });
  await nextTurn(); controller.abort();
  await failureOf(pending, "nutrition_request_cancelled");
  assert.equal(requestSignal.aborted, true);
  fetchResult.resolve({ ok: true, json: async () => { reads++; return payload; } });
  await nextTurn(); assert.equal(reads, 0);
});

test("external abort during JSON parsing cannot return its late data", async () => {
  const json = deferred(); const controller = new AbortController(); let published = 0;
  const pending = readNutrition({ ...options, signal: controller.signal,
    fetchImpl: async () => ({ ok: true, json: () => json.promise }) }).then(value => { published++; return value; });
  await nextTurn(); controller.abort();
  await failureOf(pending, "nutrition_request_cancelled");
  json.resolve(payload); await nextTurn(); assert.equal(published, 0);
});

test("an already-aborted read never starts token lookup", async () => {
  const controller = new AbortController(); controller.abort();
  const error = await failureOf(readNutrition({ ...options, signal: controller.signal,
    getToken: () => assert.fail("cancelled read cannot start"), fetchImpl: () => assert.fail("no request") }), "nutrition_request_cancelled");
  assert.equal(error.name, "AbortError");
});

test("a disposed store cannot start credential lookup", async () => {
  await failureOf(readNutrition({ ...options, isActive: () => false,
    getToken: () => assert.fail("disposed owner cannot start"), fetchImpl: () => assert.fail("no request") }), "nutrition_store_disposed");
});

test("owner disposal while credentials settle prevents dispatch", async () => {
  let active = true;
  await failureOf(readNutrition({ ...options, isActive: () => active,
    getToken: async () => { active = false; return "synthetic-token"; },
    fetchImpl: () => assert.fail("disposed owner cannot dispatch") }), "nutrition_store_disposed");
});

test("owner disposal after a response prevents reading its JSON", async () => {
  let active = true;
  await failureOf(readNutrition({ ...options, isActive: () => active, fetchImpl: async () => {
    active = false; return { ok: true, json: () => assert.fail("disposed owner cannot parse") };
  } }), "nutrition_store_disposed");
});

test("owner disposal while JSON settles prevents publishing it", async () => {
  let active = true; let published = 0;
  const pending = readNutrition({ ...options, isActive: () => active, fetchImpl: async () => ({ ok: true,
    json: async () => { active = false; return payload; },
  }) }).then(value => { published++; return value; });
  await failureOf(pending, "nutrition_store_disposed");
  assert.equal(published, 0);
});


test("a real store ends stalled-token history loading, surfaces its timeout, and recovers on explicit retry", async t => {
  const store = createNutritionStore({ ownerKey: "synthetic-read-owner" });
  t.after(() => store.dispose());
  const oldToken = deferred(); let tokenCalls = 0; let fetchCalls = 0;
  const loader = ({ signal }) => readNutrition({ ...options, signal, isActive: store.isActive, timeoutMs: 10,
    getToken: () => ++tokenCalls === 1 ? oldToken.promise : Promise.resolve("fresh synthetic-token"),
    fetchImpl: async () => { fetchCalls++; return response(); },
  });
  const cold = store.loadHistory(loader);
  assert.equal(store.getSnapshot().pending.history, true);
  await failureOf(cold, "nutrition_request_timeout");
  assert.equal(store.getSnapshot().pending.history, false);
  assert.ok(store.getSnapshot().errors.history);
  assert.equal(store.getSnapshot().historyLoaded, false);
  await store.loadHistory(loader, { force: true });
  assert.equal(store.getSnapshot().errors.history, null);
  assert.equal(store.getSnapshot().pending.history, false);
  assert.equal(store.getSnapshot().historyLoaded, true);
  assert.equal(store.getSnapshot().days["2026-10-20"].entries[0].id, 1);
  oldToken.resolve("late synthetic-token"); await nextTurn();
  assert.equal(fetchCalls, 1);
  assert.equal(store.getDiagnostics().historyRequests, 2);
});

test("store invalidation cancels a token wait without fetching, publishing errors, or clearing a newer pending read", async t => {
  const store = createNutritionStore({ ownerKey: "synthetic-read-owner" });
  t.after(() => store.dispose());
  const oldToken = deferred(), tokenStarted = deferred(), freshFetch = deferred(), fetchStarted = deferred();
  let fetchCalls = 0;
  const old = store.loadHistory(({ signal }) => readNutrition({ ...options, signal, isActive: store.isActive,
    getToken: () => { tokenStarted.resolve(); return oldToken.promise; },
    fetchImpl: () => { fetchCalls++; assert.fail("invalidated token cannot dispatch"); },
  }));
  const oldRejected = assert.rejects(old, error => error.name === "AbortError" && error.message === "nutrition_request_cancelled");
  await tokenStarted.promise;
  store.invalidateEntries();
  const fresh = store.loadHistory(({ signal }) => readNutrition({ ...options, signal, isActive: store.isActive,
    fetchImpl: () => { fetchCalls++; fetchStarted.resolve(); return freshFetch.promise; },
  }));
  fresh.catch(() => {});
  await fetchStarted.promise;
  await oldRejected;
  oldToken.resolve("late invalidated synthetic-token"); await nextTurn();
  assert.equal(fetchCalls, 1);
  assert.equal(store.getSnapshot().pending.history, true);
  assert.equal(store.getSnapshot().errors.history, null);
  assert.equal(store.getSnapshot().historyLoaded, false);
  freshFetch.resolve(response()); await fresh;
  assert.equal(store.getSnapshot().pending.history, false);
  assert.equal(store.getSnapshot().errors.history, null);
  assert.equal(store.getSnapshot().days["2026-10-20"].entries[0].id, 1);
});

test("disposing a real store cancels its pending token and ignores its late completion", async () => {
  const store = createNutritionStore({ ownerKey: "synthetic-read-owner" });
  const token = deferred(), started = deferred(); let fetchCalls = 0;
  const pending = store.loadHistory(({ signal }) => readNutrition({ ...options, signal, isActive: store.isActive,
    getToken: () => { started.resolve(); return token.promise; },
    fetchImpl: () => { fetchCalls++; assert.fail("disposed token cannot dispatch"); },
  }));
  const rejected = assert.rejects(pending, error => error.name === "AbortError" && error.message === "nutrition_request_cancelled");
  await started.promise; store.dispose(); await rejected;
  token.resolve("late disposed synthetic-token"); await nextTurn();
  assert.equal(fetchCalls, 0);
  assert.equal(store.isActive(), false);
  assert.deepEqual(store.getSnapshot().pending, {});
  assert.deepEqual(store.getSnapshot().errors, {});
  assert.deepEqual(store.getSnapshot().days, {});
});
