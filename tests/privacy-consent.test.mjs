import test from "node:test";
import assert from "node:assert/strict";
import { ownsKey } from "../lib/accountDeletion.mjs";
import {
  CONSENT_METADATA_KEY, cacheConsent, consentRecord, consentStatus, consentStorageKey, coversVersion,
  readLocalConsent, readRemoteConsent, saveConsent, syncConsent,
} from "../lib/privacyConsent.mjs";
import {
  CONSENT_COPY, HEALTH_DATA_POLICY, PRIVACY_DOCS, PRIVACY_POLICY, PRIVACY_POLICY_VERSION, placeholdersRemaining,
} from "../lib/privacyPolicy.mjs";
import { escapeHTML, renderPolicyPage } from "../scripts/build-privacy-site.mjs";

const NOW = new Date("2026-11-08T15:00:00.000Z");
const memoryStorage = (seed = {}, { failWrites = false } = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: async (key) => data.has(key) ? data.get(key) : null,
    setItem: async (key, value) => { if (failWrites) throw new Error("disk_full"); data.set(key, value); },
  };
};
const clerkUser = (unsafeMetadata = {}, { fail = false, hang = false } = {}) => {
  const user = {
    unsafeMetadata, updates: [],
    update: async (params) => {
      user.updates.push(params);
      if (hang) return new Promise(() => {});
      if (fail) throw new Error("offline");
      user.unsafeMetadata = params.unsafeMetadata;
      return user;
    },
  };
  return user;
};
const older = { version: "2025-01-01", acceptedAt: "2025-01-01T00:00:00.000Z", ai: "openai" };

test("a record names the current version, the time and OpenAI", () => {
  assert.deepEqual(consentRecord(NOW), { version: PRIVACY_POLICY_VERSION, acceptedAt: NOW.toISOString(), ai: "openai" });
  assert.match(PRIVACY_POLICY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test("only a record for this version or later opens the app", () => {
  assert.equal(coversVersion(consentRecord(NOW)), true);
  assert.equal(coversVersion({ ...consentRecord(NOW), version: "2099-01-01" }), true);
  assert.equal(coversVersion(older), false);
  for (const bad of [null, "yes", {}, { version: "latest", acceptedAt: "x" }, { version: PRIVACY_POLICY_VERSION }]) {
    assert.equal(coversVersion(bad), false);
  }
});

test("status: nothing anywhere asks for a first agreement", () => {
  assert.deepEqual(consentStatus({ local: null, remote: null }), { status: "needed", record: null, needsSync: false, needsCache: false });
});

test("status: an older agreement asks again as an update", () => {
  assert.equal(consentStatus({ local: older, remote: null }).status, "updated");
  assert.equal(consentStatus({ local: null, remote: older }).status, "updated");
});

test("status: the phone's copy opens at once and catches Clerk up", () => {
  const local = consentRecord(NOW);
  assert.deepEqual(consentStatus({ local, remote: null }), { status: "accepted", record: local, needsSync: true, needsCache: false });
  assert.equal(consentStatus({ local, remote: local }).needsSync, false);
});

test("status: Clerk's copy opens a new phone and is cached there", () => {
  const remote = consentRecord(NOW);
  assert.deepEqual(consentStatus({ local: older, remote }), { status: "accepted", record: remote, needsSync: false, needsCache: true });
});

test("reading tolerates missing, broken and foreign values", async () => {
  assert.equal(readRemoteConsent(undefined), null);
  assert.equal(readRemoteConsent({ [CONSENT_METADATA_KEY]: "yes" }), null);
  assert.deepEqual(readRemoteConsent({ [CONSENT_METADATA_KEY]: older }), older);
  const storage = memoryStorage({ [consentStorageKey("user_a")]: "{not json" });
  assert.equal(await readLocalConsent(storage, "user_a"), null);
  assert.equal(await readLocalConsent(memoryStorage(), "user_a"), null);
  assert.equal(await readLocalConsent({ getItem: async () => { throw new Error("locked"); } }, "user_a"), null);
});

test("saving writes the phone first, then Clerk, keeping other metadata", async () => {
  const storage = memoryStorage();
  const user = clerkUser({ theme: "grove" });
  const result = await saveConsent({ storage, user, userId: "user_a", now: NOW });
  assert.deepEqual(result, { record: consentRecord(NOW), cached: true, synced: true });
  assert.deepEqual(JSON.parse(storage.data.get(consentStorageKey("user_a"))), consentRecord(NOW));
  assert.deepEqual(user.unsafeMetadata, { theme: "grove", [CONSENT_METADATA_KEY]: consentRecord(NOW) });
});

test("saving offline still opens the app; the next launch syncs", async () => {
  const storage = memoryStorage();
  const user = clerkUser({}, { fail: true });
  const result = await saveConsent({ storage, user, userId: "user_a", now: NOW });
  assert.equal(result.cached, true);
  assert.equal(result.synced, false);
  const local = await readLocalConsent(storage, "user_a");
  assert.equal(consentStatus({ local, remote: readRemoteConsent(user.unsafeMetadata) }).needsSync, true);
});

test("a stalled Clerk update gives up instead of holding the button", async () => {
  const started = Date.now();
  assert.equal(await syncConsent(clerkUser({}, { hang: true }), consentRecord(NOW), 30), false);
  assert.ok(Date.now() - started < 1000);
});

test("saving fails only when neither copy can be written", async () => {
  await assert.rejects(saveConsent({ storage: memoryStorage({}, { failWrites: true }), user: clerkUser({}, { fail: true }), userId: "user_a", now: NOW }),
    /consent_not_saved/);
  const onlyClerk = await saveConsent({ storage: memoryStorage({}, { failWrites: true }), user: clerkUser(), userId: "user_a", now: NOW });
  assert.equal(onlyClerk.synced, true);
  assert.equal(await cacheConsent(memoryStorage({}, { failWrites: true }), "user_a", consentRecord(NOW)), false);
});

test("deleting an account also forgets its consent on the phone", () => {
  assert.equal(ownsKey(consentStorageKey("user_a"), "user_a"), true);
  assert.equal(ownsKey(consentStorageKey("user_ab"), "user_a"), false);
});

const allText = (doc) => [...doc.intro, ...doc.sections.flatMap((s) => [{ type: "p", text: s.heading }, ...s.blocks])]
  .flatMap((b) => b.text ? [b.text] : b.items ? b.items.map((i) => typeof i === "string" ? i : `${i.term} ${i.text}`) : []).join("\n");

test("the policy names OpenAI and each kind of data it receives", () => {
  const text = allText(PRIVACY_POLICY);
  for (const phrase of ["OpenAI", "text you type", "Photos you choose", "what you say", "Voice recordings", "ChatGPT account"]) {
    assert.match(text, new RegExp(phrase), phrase);
  }
  for (const provider of ["Clerk", "Neon", "Render", "Upstash"]) assert.match(text, new RegExp(provider));
  assert.match(text, /don’t sell/);
  assert.match(text, /Delete account/);
});

test("the consent sheet names OpenAI, the three kinds of data and the choice", () => {
  assert.match(CONSENT_COPY.ai.heading, /OpenAI/);
  assert.equal(CONSENT_COPY.ai.items.length, 3);
  assert.match(CONSENT_COPY.agreement, /Privacy Policy/);
  assert.match(CONSENT_COPY.agreement, /OpenAI/);
  assert.match(CONSENT_COPY.agreement, new RegExp(CONSENT_COPY.agree));
  assert.match(CONSENT_COPY.agreement, /need to agree/);
  // The sheet turns this phrase into the link that opens the policy, so it appears once.
  assert.equal(CONSENT_COPY.agreement.split("Privacy Policy").length, 2);
});

test("documents are well formed and link to each other", () => {
  for (const doc of Object.values(PRIVACY_DOCS)) {
    const ids = doc.sections.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, `${doc.id} section ids are unique`);
    for (const block of doc.sections.flatMap((s) => s.blocks)) {
      assert.ok(["p", "list", "terms", "link", "doc"].includes(block.type), block.type);
      if (block.type === "doc") assert.ok(PRIVACY_DOCS[block.id], block.id);
      if (block.type === "link") assert.match(block.url, /^https:\/\//);
    }
    assert.ok(doc.sections.some((s) => s.id === "contact"), `${doc.id} has a contact section`);
  }
});

test("the contact details are filled in and the policy is US-only", () => {
  assert.deepEqual(placeholdersRemaining(), []);
  assert.match(allText(PRIVACY_POLICY), /calmeradev@gmail\.com/);
  assert.doesNotMatch(allText(PRIVACY_POLICY), /EEA|European|UK\b|GDPR|purchase/);
});

test("web pages escape text and link the two policies relatively", () => {
  assert.equal(escapeHTML(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  const privacy = renderPolicyPage(PRIVACY_POLICY);
  const health = renderPolicyPage(HEALTH_DATA_POLICY);
  assert.match(privacy, /<title>Privacy Policy · calmera<\/title>/);
  assert.match(privacy, /href="health-data\/"/);
  assert.match(health, /href="\.\.\/"/);
  assert.match(privacy, /<meta name="viewport"/);
  assert.doesNotMatch(privacy, /<script/);
  assert.match(privacy, /don&#39;t|don’t sell/);
});
