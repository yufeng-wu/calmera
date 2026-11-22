import test from "node:test";
import assert from "node:assert/strict";
import { ownsKey } from "../lib/eraseData.mjs";
import { consentRecord, consentStatus, consentStorageKey, coversVersion, readConsent, saveConsent } from "../lib/privacyConsent.mjs";
import {
  CONSENT_COPY, HEALTH_DATA_POLICY, SEARCH_NOTICE, PRIVACY_DOCS, PRIVACY_POLICY, PRIVACY_POLICY_VERSION, placeholdersRemaining,
} from "../lib/privacyPolicy.mjs";
import { escapeHTML, renderPolicyPage } from "../scripts/build-privacy-site.mjs";
import { createMemoryStorage } from "../lib/store/memoryStorage.mjs";

const NOW = new Date("2026-11-08T15:00:00.000Z");
const older = { version: "2025-01-01", acceptedAt: "2025-01-01T00:00:00.000Z", ai: "openai" };

test("a record names the current version, the time and both AI providers", () => {
  assert.deepEqual(consentRecord(NOW), { version: PRIVACY_POLICY_VERSION, acceptedAt: NOW.toISOString(), ai: ["openai", "anthropic"] });
  assert.match(PRIVACY_POLICY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(PRIVACY_POLICY_VERSION > "2026-11-09", "naming Anthropic asks everyone again");
});

test("only a record for this version or later opens the app", () => {
  assert.equal(coversVersion(consentRecord(NOW)), true);
  assert.equal(coversVersion({ ...consentRecord(NOW), version: "2099-01-01" }), true);
  assert.equal(coversVersion(older), false);
  for (const bad of [null, "yes", {}, { version: "latest", acceptedAt: "x" }, { version: PRIVACY_POLICY_VERSION }]) {
    assert.equal(coversVersion(bad), false);
  }
});

test("status: nothing asks for a first agreement, an older one asks again as an update", () => {
  assert.equal(consentStatus(null), "needed");
  assert.equal(consentStatus(older), "updated");
  assert.equal(consentStatus(consentRecord(NOW)), "accepted");
});

test("the agreement is saved on this iPhone and read back", async () => {
  const storage = createMemoryStorage();
  assert.deepEqual(await saveConsent({ storage, owner: "local", now: NOW }), consentRecord(NOW));
  assert.deepEqual(JSON.parse(storage.data.get(consentStorageKey("local"))), consentRecord(NOW));
  assert.deepEqual(await readConsent(storage, "local"), consentRecord(NOW));
});

test("reading tolerates missing, broken and unreadable values", async () => {
  assert.equal(await readConsent(createMemoryStorage({ [consentStorageKey("local")]: "{not json" }), "local"), null);
  assert.equal(await readConsent(createMemoryStorage(), "local"), null);
  assert.equal(await readConsent({ getItem: async () => { throw new Error("locked"); } }, "local"), null);
});

test("an agreement that can't be saved is an error, so the sheet stays open", async () => {
  await assert.rejects(saveConsent({ storage: createMemoryStorage({}, { failWrites: true }), owner: "local", now: NOW }));
});

test("erasing all data also forgets the agreement", () => {
  assert.equal(ownsKey(consentStorageKey("local"), "local"), true);
  assert.equal(ownsKey(consentStorageKey("localx"), "local"), false);
});

const allText = (doc) => [...doc.intro, ...doc.sections.flatMap((s) => [{ type: "p", text: s.heading }, ...s.blocks])]
  .flatMap((b) => b.text ? [b.text] : b.items ? b.items.map((i) => typeof i === "string" ? i : `${i.term} ${i.text}`) : []).join("\n");

test("the policy names both providers and each kind of data they receive", () => {
  const text = allText(PRIVACY_POLICY);
  for (const phrase of ["OpenAI", "Anthropic", "OpenAI API key", "Anthropic API key", "text you type", "Photos you choose", "what you say",
    "Voice recordings", "ChatGPT account", "Keychain", "disconnect your AI provider"]) {
    assert.match(text, new RegExp(phrase), phrase);
  }
  assert.match(text, /don’t sell/);
  assert.doesNotMatch(text, /disconnect ChatGPT/i);
  const links = PRIVACY_POLICY.sections.flatMap((s) => s.blocks).filter((b) => b.type === "link").map((b) => b.url);
  assert.ok(links.some((url) => url.includes("openai.com")) && links.some((url) => url.includes("anthropic.com")));
});

test("the policy describes data kept on the iPhone, with no account or calmera servers", () => {
  for (const doc of Object.values(PRIVACY_DOCS)) {
    const text = allText(doc);
    for (const gone of ["Clerk", "Neon", "Render", "Upstash", "Delete account", "sign in on", "your email", "our servers", "our database"]) {
      assert.doesNotMatch(text, new RegExp(gone, "i"), `${doc.id}: ${gone}`);
    }
  }
  const text = allText(PRIVACY_POLICY);
  assert.match(text, /on your iPhone/);
  assert.match(text, /no calmera account/);
  assert.match(text, /Erase all data/);
  assert.match(text, /iCloud Backup/);
  assert.match(CONSENT_COPY.data.text, /stay on this iPhone/);
  assert.doesNotMatch(JSON.stringify(CONSENT_COPY), /Sign Out|sign in|connection/i);
});

test("the consent sheet names both providers, the three kinds of data and the choice", () => {
  assert.match(CONSENT_COPY.ai.heading, /OpenAI/);
  assert.match(CONSENT_COPY.ai.heading, /Anthropic/);
  assert.match(CONSENT_COPY.ai.text, /Anthropic API key/);
  assert.doesNotMatch(JSON.stringify(CONSENT_COPY), /Claude/);
  assert.match(CONSENT_COPY.ai.note, /Keychain/);
  assert.equal(CONSENT_COPY.ai.items.length, 3);
  assert.match(CONSENT_COPY.agreement, /Privacy Policy/);
  assert.match(CONSENT_COPY.agreement, /OpenAI or Anthropic/);
  // Online search is said in one sentence, the same on every page that mentions it.
  assert.ok(CONSENT_COPY.ai.note.includes(SEARCH_NOTICE));
  assert.match(SEARCH_NOTICE, /^When Online search is on, which it is unless you turn it off in Settings, your AI provider may also search the web with what you log/);
  const everywhere = JSON.stringify([PRIVACY_POLICY, HEALTH_DATA_POLICY]);
  assert.equal(everywhere.split(SEARCH_NOTICE).length - 1, 3, "summary, AI section and health data policy");
  // The usage record is named with what it keeps, and what it never does.
  assert.match(JSON.stringify(PRIVACY_POLICY), /AI usage.*how many tokens and web searches.*Never what you logged/);
  assert.match(JSON.stringify(PRIVACY_POLICY), /AI usage record keeps only the last 7 days/);
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
