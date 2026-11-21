import test from "node:test";
import assert from "node:assert/strict";
import { keyProvider } from "../lib/ai/providers.mjs";
import { chatgptNote, connectTitle, connectionName, connectionRows, connectionValue, isConnected, keepsKey, keyCheck,
  keyDraftIssue, modelValue, privacyLine, readKeyDraft, switchNotice } from "../lib/ai/connectionPresentation.mjs";
import { INITIAL_CONNECTION, createConnectionController } from "../lib/ai/connectionController.mjs";
import { PREVIEW_KEY, previewConnectionServices } from "../lib/ai/previewConnection.mjs";
import { leaveKeyOutcome, logAfterConnect, takeKeyOutcome, takeLogAfterConnect } from "../lib/ai/connectHandoff.mjs";
import { loggingProblem } from "../lib/ai/loggingProblem.mjs";
import { connectionPresentation } from "../lib/mealLogPresentation.mjs";
import { connectionIssue } from "../lib/chatgpt/connectionStatus.mjs";

// Obviously fake keys: never a real one in tests.
const CLAUDE = "sk-ant-FAKE-test-key-0000-WXYZ", OPENAI = "sk-proj-FAKE-test-key-0000-ABCD";
const claude = { type: "claude-key", provider: "anthropic", masked: "sk-ant-••••WXYZ" };
const openai = { type: "openai-key", provider: "openai", masked: "sk-proj-••••ABCD" };
const signedOut = connectionIssue(new Error("chatgpt_refresh_required"));

test("a pasted key says whose it is, so nobody has to pick a provider", () => {
  assert.equal(keyProvider(` ${CLAUDE} `), "anthropic");
  assert.equal(keyProvider(OPENAI), "openai");
  assert.equal(keyProvider("sk-svcacct-FAKE"), "openai");
  for (const other of ["", "hello there", "AIzaFAKE-not-a-key", null, 42]) assert.equal(keyProvider(other), null);
  assert.deepEqual(readKeyDraft(` ${CLAUDE}\n`), { provider: "anthropic", key: CLAUDE, caption: "Claude key · sk-ant-••••WXYZ" });
  assert.equal(readKeyDraft(OPENAI).caption, "OpenAI key · sk-proj-••••ABCD");
  assert.ok(!readKeyDraft(CLAUDE).caption.includes("FAKE"), "the caption never shows the middle of the key");
  // Part of a key is recognised but not ready; anything else isn't a key at all.
  const part = readKeyDraft("sk-ant-short"), other = readKeyDraft("hello there");
  assert.deepEqual(part, { provider: "anthropic", key: null, caption: null });
  assert.deepEqual(other, { provider: null, key: null, caption: null });
  assert.match(keyDraftIssue(part).title, /whole key/);
  assert.match(keyDraftIssue(other).title, /OpenAI or Claude/);
});

test("a key is kept only once its provider has accepted it", () => {
  assert.deepEqual(["works", "no-credit"].map(keepsKey), [true, true]);
  for (const outcome of ["rejected", "offline", "rate-limited", "busy", "not-allowed", "failed", "malformed", undefined]) assert.equal(keepsKey(outcome), false, outcome);
});

test("the two rows keep their place; only the detail and the mark change", () => {
  const none = connectionRows({ current: null });
  assert.deepEqual(none, { chatgpt: { title: "ChatGPT", detail: "Sign in with your account", state: "available" },
    key: { title: "API key", detail: "OpenAI or Claude", state: "available" } });
  const chatgpt = connectionRows({ current: { type: "chatgpt" }, email: "you@example.com" });
  assert.deepEqual([chatgpt.chatgpt.detail, chatgpt.chatgpt.state, chatgpt.key.state], ["you@example.com", "current", "available"]);
  assert.equal(connectionRows({ current: { type: "chatgpt" } }).chatgpt.detail, "Signed in");
  const key = connectionRows({ current: claude });
  assert.deepEqual(key.key, { title: "Claude API key", detail: "sk-ant-••••WXYZ", state: "current" });
  assert.equal(key.chatgpt.state, "available");
  assert.equal(connectionRows({ current: openai }).key.title, "OpenAI API key");
  assert.equal(connectionRows({ current: claude, busy: "sign-in" }).chatgpt.detail, "Signing in…");
  const expired = connectionRows({ current: { type: "chatgpt" }, email: "you@example.com", issue: signedOut });
  assert.deepEqual([expired.chatgpt.state, expired.chatgpt.detail], ["attention", "Signed out. Tap to sign in again."]);
  assert.equal(isConnected({ current: { type: "chatgpt" }, issue: signedOut }), false);
  assert.equal(isConnected({ current: { type: "chatgpt" }, issue: connectionIssue(new Error("openai_http_503")) }), true);
  assert.equal(isConnected({ current: claude }), true);
  assert.equal(isConnected({ current: null }), false);
});

test("one name per connection, in Settings and everywhere else", () => {
  assert.deepEqual(["chatgpt", "openai-key", "claude-key", "gemini"].map(connectionName), ["ChatGPT", "OpenAI key", "Claude key", null]);
  assert.equal(connectionValue(undefined), null, "nothing shows before the Keychain answers");
  assert.equal(connectionValue(null), "Not connected");
  assert.equal(connectionValue(claude), "Claude key");
  assert.equal(connectTitle(null), "Connect");
  assert.equal(connectTitle({ type: "chatgpt" }), "Switch from ChatGPT");
  assert.equal(connectTitle(openai), "Replace key");
  assert.equal(connectTitle(undefined), "Connect");
});

test("a switch is said once it has happened, naming what went", () => {
  assert.equal(switchNotice(null, claude), null);
  assert.equal(switchNotice(claude, null), null);
  assert.equal(switchNotice(claude, { type: "chatgpt" }), "Now using ChatGPT. Your Claude key is gone from this iPhone.");
  assert.equal(switchNotice({ type: "chatgpt" }, openai), "Now using your OpenAI key. ChatGPT is signed out.");
  assert.equal(switchNotice(openai, claude), "Now using your Claude key. Your OpenAI key is gone from this iPhone.");
  assert.equal(switchNotice(claude, { ...claude, masked: "sk-ant-••••0000" }), "Key replaced.");
  assert.equal(switchNotice(claude, claude), null);
  assert.equal(switchNotice({ type: "chatgpt" }, { type: "chatgpt" }), null);
});

test("small words under the rows: key checks, ChatGPT trouble, the model and privacy", () => {
  assert.equal(keyCheck(undefined, "openai"), null);
  assert.deepEqual(keyCheck("works", "openai"), { ok: true, title: "Working", message: null });
  const empty = keyCheck("no-credit", "anthropic");
  assert.deepEqual([empty.ok, empty.title], [false, "Out of credit"]);
  assert.match(empty.message, /Anthropic account has no credit/);
  assert.equal(keyCheck("something-new", "openai").title, "Couldn’t finish");
  assert.equal(chatgptNote(null), null);
  assert.equal(chatgptNote(signedOut), null, "a sign-out is shown on the row itself");
  assert.equal(chatgptNote(connectionIssue(new Error("openai_http_503"))).tone, "soft");
  const restricted = chatgptNote(connectionIssue(new Error("no_eligible_models")));
  assert.equal(restricted.tone, "bad");
  assert.match(restricted.text, /^Plan access unavailable\. /);
  const choices = [{ slug: "a", display_name: "Model A" }, { slug: "b" }];
  assert.equal(modelValue({ choices, preferred: null }), "Automatic");
  assert.equal(modelValue({ choices, preferred: "a" }), "Model A");
  assert.equal(modelValue({ choices, preferred: "b" }), "b");
  assert.equal(modelValue({ choices, preferred: "gone" }), "Automatic", "a model the account lost falls back, as logging does");
  assert.equal(modelValue({ choices: [], preferred: "kept" }), "kept", "with no catalog the saved choice still shows");
  assert.equal(modelValue(), "Automatic");
  assert.match(privacyLine(null), /no servers/);
  assert.match(privacyLine({ type: "chatgpt" }), /goes to OpenAI\. Your sign-in stays on this iPhone/);
  assert.match(privacyLine(claude), /goes to Anthropic\. Your key stays in this iPhone’s Keychain/);
});

// The page's logic with no screen: the real connection store over a Keychain in memory.
function page(state, overrides = {}) {
  const services = { ...previewConnectionServices(state), ...overrides };
  const states = [];
  const controller = createConnectionController(services, { onChange: value => states.push(value) });
  return { services, controller, states, get state() { return controller.state; } };
}
const cancelled = () => Object.assign(new Error("authorization_cancelled"), {});

test("opening the page reads the one connection and nothing else", async () => {
  const none = page("none");
  assert.equal(none.state, INITIAL_CONNECTION);
  await none.controller.open();
  assert.deepEqual(none.state, { ...INITIAL_CONNECTION, current: null, loaded: true });
  const key = page("claude-key");
  await key.controller.open();
  assert.deepEqual(key.state.current, { type: "claude-key", provider: "anthropic", masked: "sk-ant-••••WXYZ" });
  assert.ok(!JSON.stringify(key.states).includes(PREVIEW_KEY), "the key itself never reaches the page's state");
  const chatgpt = page("chatgpt");
  await chatgpt.controller.open();
  assert.deepEqual([chatgpt.state.current.type, chatgpt.state.email, chatgpt.state.model, chatgpt.state.issue, chatgpt.state.loaded],
    ["chatgpt", "you@example.com", "Automatic", null, true]);
  // The row shows before ChatGPT's details arrive: the first state with a connection isn't loaded yet.
  assert.equal(chatgpt.states.find(value => value.current).loaded, false);
});

test("signing in to ChatGPT replaces a key once it works, and says what went", async () => {
  const fixture = page("claude-key");
  await fixture.controller.open();
  const done = fixture.controller.signIn();
  assert.equal(fixture.state.busy, "sign-in");
  fixture.controller.signIn();   // a second tap while the sheet is up starts nothing
  await done;
  assert.equal(fixture.state.busy, null);
  assert.equal(fixture.state.current.type, "chatgpt");
  assert.equal(fixture.state.email, "you@example.com");
  assert.deepEqual(fixture.state.notice, { tone: "good", text: "Now using ChatGPT. Your Claude key is gone from this iPhone." });
  assert.equal((await fixture.services.read()).type, "chatgpt");
  assert.equal(await fixture.services.checkKey(), null, "the key was deleted, not kept beside the sign-in");
  // Said once: the next visit starts clean.
  await fixture.controller.open();
  assert.equal(fixture.state.notice, null);
  // A first connection has nothing to announce.
  const first = page("none");
  await first.controller.open(); await first.controller.signIn();
  assert.deepEqual([first.state.current.type, first.state.notice], ["chatgpt", null]);
});

test("cancelling the sign-in sheet changes nothing and says nothing; a failure says what to do", async () => {
  const options = [];
  let attempt = 0;
  const fixture = page("claude-key", { signIn: async value => {
    options.push(value);
    attempt += 1;
    if (attempt === 1) throw cancelled();
    if (attempt === 2) throw new TypeError("Network request failed");
    if (attempt === 3) throw new Error("plan_permission_required");
  } });
  await fixture.controller.open();
  await fixture.controller.signIn();
  assert.deepEqual([fixture.state.current.type, fixture.state.notice, fixture.state.busy], ["claude-key", null, null]);
  await fixture.controller.signIn();
  assert.equal(fixture.state.current.type, "claude-key", "the key stays until ChatGPT works");
  assert.deepEqual(fixture.state.notice, { tone: "bad", text: "Sign-in didn’t finish. Check your internet connection and try again." });
  await fixture.controller.signIn();
  assert.match(fixture.state.notice.text, /allow calmera to use your plan/);
  // After a failure the next sign-in registers afresh, in case the saved registration was the trouble.
  assert.deepEqual(options, [{ newAccount: false }, { newAccount: false }, { newAccount: true }]);
});

test("a ChatGPT sign-out shows on its row, and signing in again clears it", async () => {
  const fixture = page("expired");
  await fixture.controller.open();
  assert.equal(fixture.state.issue.kind, "sign-in");
  assert.equal(isConnected(fixture.state), false);
  assert.equal(connectionRows(fixture.state).chatgpt.state, "attention");
  await fixture.controller.signIn();
  assert.equal(fixture.state.issue, null);
  assert.equal(isConnected(fixture.state), true);
  assert.equal(fixture.state.notice, null, "signing back in to the same connection isn't a switch");
});

test("ChatGPT details that can't be read leave the connection in place", async () => {
  const fixture = page("chatgpt", { chatgpt: async () => { throw new Error("openai_http_503"); } });
  await fixture.controller.open();
  assert.deepEqual([fixture.state.current.type, fixture.state.loaded, fixture.state.issue.kind, fixture.state.model], ["chatgpt", true, "temporary", "Automatic"]);
  const broken = page("none", { read: async () => { throw new Error("keychain"); } });
  await broken.controller.open();
  assert.deepEqual([broken.state.current, broken.state.loaded, broken.state.notice.tone], [null, true, "bad"]);
});

test("removing the connection leaves nothing; a failure leaves it and says so", async () => {
  for (const state of ["claude-key", "chatgpt"]) {
    const fixture = page(state);
    await fixture.controller.open();
    await fixture.controller.disconnect();
    assert.deepEqual([fixture.state.current, fixture.state.email, fixture.state.busy], [null, null, null], state);
    assert.equal(await fixture.services.read(), null);
  }
  const stuck = page("claude-key", { disconnect: async () => { throw new Error("keychain"); } });
  await stuck.controller.open();
  await stuck.controller.disconnect();
  assert.equal(stuck.state.current.type, "claude-key");
  assert.deepEqual(stuck.state.notice, { tone: "bad", text: "Couldn’t disconnect. Try again." });
  const none = page("none");
  await none.controller.open();
  await none.controller.disconnect();
  assert.equal(none.states.some(value => value.busy === "disconnect"), false, "with nothing connected there is nothing to remove");
});

test("checking a key reports what the provider said, on the row that asked", async () => {
  let answer = "works";
  const fixture = page("claude-key", { checkKey: async () => { if (answer instanceof Error) throw answer; return answer; } });
  await fixture.controller.open();
  const running = fixture.controller.checkKey();
  assert.equal(fixture.state.busy, "check");
  await running;
  assert.deepEqual([fixture.state.check, fixture.state.busy], [{ outcome: "works" }, null]);
  answer = "no-credit"; await fixture.controller.checkKey();
  assert.equal(keyCheck(fixture.state.check.outcome, fixture.state.current.provider).title, "Out of credit");
  answer = new Error("boom"); await fixture.controller.checkKey();
  assert.deepEqual(fixture.state.check, { outcome: "failed" });
  const chatgpt = page("chatgpt");
  await chatgpt.controller.open(); await chatgpt.controller.checkKey();
  assert.equal(chatgpt.state.check, null, "ChatGPT has no key to check");
});

test("coming back from the key page shows the new key, what it replaced and what its check found", async () => {
  const fixture = page("chatgpt");
  await fixture.controller.open();
  fixture.controller.close();
  // The key page: the check passed with an empty balance, so the key was saved.
  assert.equal(await fixture.services.testKey("openai", OPENAI), "works");
  await fixture.services.saveKey("openai", OPENAI);
  await fixture.controller.open({ keyOutcome: "no-credit" });
  assert.deepEqual(fixture.state.current, openai);
  assert.deepEqual(fixture.state.notice, { tone: "good", text: "Now using your OpenAI key. ChatGPT is signed out." });
  assert.deepEqual(fixture.state.check, { outcome: "no-credit" });
  assert.equal(fixture.state.email, null);
  // A key that simply works needs no check line.
  fixture.controller.close();
  await fixture.services.saveKey("anthropic", CLAUDE);
  await fixture.controller.open({ keyOutcome: "works" });
  assert.deepEqual([fixture.state.current.type, fixture.state.check, fixture.state.notice.text],
    ["claude-key", null, "Now using your Claude key. Your OpenAI key is gone from this iPhone."]);
  assert.equal(await page("key-error").services.testKey("anthropic", CLAUDE), "rejected");
});

test("a sign-in still running from an earlier visit is waited for, and a late answer can't touch a page that was left", async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const fixture = page("none", { pending: () => pending });
  const opening = fixture.controller.open();
  assert.equal(fixture.state.busy, "sign-in");
  assert.equal(fixture.state.current, undefined, "nothing is read while the sign-in is still deciding");
  finish(); await opening;
  assert.deepEqual([fixture.state.busy, fixture.state.current, fixture.state.loaded], [null, null, true]);
  // Leaving mid sign-in: the result is dropped here and read fresh on the next visit.
  let release;
  const slow = page("none", { signIn: () => new Promise(resolve => { release = resolve; }) });
  await slow.controller.open();
  const signing = slow.controller.signIn();
  slow.controller.close();
  const seen = slow.states.length;
  release(); await signing;
  assert.equal(slow.states.length, seen);
});

test("the connect flow's hand-offs are read once", () => {
  assert.equal(takeLogAfterConnect(), null);
  logAfterConnect("voice");
  assert.deepEqual([takeLogAfterConnect(), takeLogAfterConnect()], ["voice", null]);
  leaveKeyOutcome("no-credit");
  assert.deepEqual([takeKeyOutcome(), takeKeyOutcome()], ["no-credit", null]);
});

test("a connection problem while logging is one alert that leads to the one page that fixes it", () => {
  const key = code => Object.assign(new Error(code), { provider: "anthropic" });
  const rejected = loggingProblem(key("apikey_rejected"));
  assert.deepEqual([rejected.title, rejected.action, rejected.actionLabel], ["Key not accepted", "connection", "Replace Key"]);
  assert.equal(rejected.message, "Claude didn’t accept your key. Your meal is still here.");
  // Credit is added with the provider and a busy provider just needs time: no button pretends otherwise.
  for (const code of ["apikey_no_credit", "apikey_network", "apikey_rate_limited", "apikey_provider_busy"]) assert.equal(loggingProblem(key(code)).action, null, code);
  assert.match(loggingProblem(key("apikey_no_credit")).message, /Anthropic account has no credit/);
  const expired = loggingProblem(new Error("chatgpt_refresh_required"));
  assert.deepEqual([expired.title, expired.action, expired.actionLabel], ["ChatGPT signed you out", "connection", "Sign In"]);
  assert.equal(loggingProblem(new Error("openai_http_401")).action, "connection");
  const none = loggingProblem(new Error("ai_connection_required"));
  assert.deepEqual([none.action, none.actionLabel], ["connection", "Connect"]);
  const usage = loggingProblem(new Error("plan_usage_unavailable"));
  assert.deepEqual([usage.title, usage.action], ["ChatGPT usage limit", "usage"]);
  for (const code of ["invalid_estimate", "no_food_detected", "request_cancelled", ""]) assert.equal(loggingProblem(new Error(code)), null, code);
  assert.equal(loggingProblem(null), null);
});

test("from the voice sheet nothing can open over it, so the alert says where to go instead", () => {
  const rejected = loggingProblem(Object.assign(new Error("apikey_rejected"), { provider: "openai" }), { inSheet: true });
  assert.equal(rejected.action, null);
  assert.equal(rejected.message, "OpenAI didn’t accept your key. Replace it in Settings → AI connection. Your words are still here.");
  const expired = loggingProblem(new Error("chatgpt_sign_in_required"), { inSheet: true });
  assert.equal(expired.action, null);
  assert.match(expired.message, /Sign in again in Settings → AI connection\./);
  assert.equal(loggingProblem(new Error("plan_usage_unavailable"), { inSheet: true }).action, "usage", "ChatGPT's settings open outside the app");
  assert.match(loggingProblem(Object.assign(new Error("apikey_network"), { provider: "openai" }), { inSheet: true }).message, /Your words are still here\.$/);
});

test("the log pages say nothing while the connection works and offer one fix when it doesn't", () => {
  assert.deepEqual(connectionPresentation({ state: "ready", type: "claude-key" }), {});
  assert.deepEqual(connectionPresentation({ state: "checking" }), {});
  assert.deepEqual(connectionPresentation({ state: "none" }), { action: "connect", actionLabel: "Connect an AI to estimate" });
  const expired = connectionPresentation({ state: "sign-in", issue: signedOut });
  assert.deepEqual(expired, { title: "ChatGPT signed you out", action: "connect", actionLabel: "Sign in again" });
});
