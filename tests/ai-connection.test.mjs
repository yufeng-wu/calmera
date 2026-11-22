import test from "node:test";
import assert from "node:assert/strict";
import { keyProvider } from "../lib/ai/providers.mjs";
import { chatgptOutcome, connectChatGPT, connectKey, issueOutcome, keepsKey, methodOf } from "../lib/ai/connectionMethods.mjs";
import { CREDIT_PAGES, METHODS, billingLine, checkResult, connectTitle, connectionCard, connectionName, connectionValue, isConnected, keepsUntil,
  methodPrivacy, modelValue, privacyLine, problemFor, readKeyDraft, switchNotice } from "../lib/ai/connectionPresentation.mjs";
import { INITIAL_CONNECTION, createConnectionController } from "../lib/ai/connectionController.mjs";
import { summarizeUsage } from "../lib/ai/usage.mjs";
import { PREVIEW_KEY, previewConnectionServices } from "../lib/ai/previewConnection.mjs";
import { leaveConnectOutcome, logAfterConnect, takeConnectOutcome, takeLogAfterConnect } from "../lib/ai/connectHandoff.mjs";
import { loggingProblem } from "../lib/ai/loggingProblem.mjs";
import { connectionPresentation } from "../lib/mealLogPresentation.mjs";
import { connectionIssue } from "../lib/chatgpt/connectionStatus.mjs";

// Obviously fake keys: never a real one in tests.
const CLAUDE = "sk-ant-FAKE-test-key-0000-WXYZ", OPENAI = "sk-proj-FAKE-test-key-0000-ABCD";
const claude = { type: "claude-key", provider: "anthropic", masked: "sk-ant-••••WXYZ" };
const openai = { type: "openai-key", provider: "openai", masked: "sk-proj-••••ABCD" };
const chatgpt = { type: "chatgpt" };
const cancelled = () => new Error("authorization_cancelled");

test("a pasted key says whose it is, so nobody has to pick a provider", () => {
  assert.equal(keyProvider(` ${CLAUDE} `), "anthropic");
  assert.equal(keyProvider(OPENAI), "openai");
  assert.equal(keyProvider("sk-svcacct-FAKE"), "openai");
  for (const other of ["", "hello there", "AIzaFAKE-not-a-key", null, 42]) assert.equal(keyProvider(other), null);
  assert.deepEqual(readKeyDraft(` ${CLAUDE}\n`), { provider: "anthropic", key: CLAUDE, caption: "Anthropic key · sk-ant-••••WXYZ" });
  assert.equal(readKeyDraft(OPENAI).caption, "OpenAI key · sk-proj-••••ABCD");
  assert.ok(!readKeyDraft(CLAUDE).caption.includes("FAKE"), "the caption never shows the middle of the key");
  assert.deepEqual(readKeyDraft("sk-ant-short"), { provider: "anthropic", key: null, caption: null });
  assert.deepEqual(readKeyDraft("hello there"), { provider: null, key: null, caption: null });
});

test("connecting ends the same way for a sign-in and for a key", async () => {
  const saved = [];
  const save = async (provider, key) => { saved.push([provider, key]); };
  assert.deepEqual(await connectKey(CLAUDE, { test: async () => "works", save }), { outcome: "works", provider: "anthropic", connected: true });
  assert.deepEqual(await connectChatGPT({}, { signIn: async () => {} }), { outcome: "works", connected: true });
  // Failures: nothing is saved, and the outcome uses the same words for both.
  assert.deepEqual(await connectKey(OPENAI, { test: async () => "offline", save }), { outcome: "offline", provider: "openai", connected: false });
  assert.deepEqual(await connectChatGPT({}, { signIn: async () => { throw new TypeError("Network request failed"); } }), { outcome: "offline", connected: false });
  assert.deepEqual(await connectKey(OPENAI, { test: async () => "rejected", save }), { outcome: "rejected", provider: "openai", connected: false });
  assert.deepEqual(await connectChatGPT({}, { signIn: async () => { throw new Error("plan_permission_required"); } }), { outcome: "rejected", connected: false });
  assert.equal((await connectChatGPT({}, { signIn: async () => { throw cancelled(); } })).outcome, "cancelled");
  assert.equal((await connectKey("hello there", { test: async () => "works", save })).outcome, "unknown");
  assert.equal((await connectKey("sk-ant-short", { test: async () => "works", save })).outcome, "malformed");
  assert.equal((await connectKey(OPENAI, { test: async () => { throw new Error("boom"); }, save })).outcome, "failed");
  assert.equal((await connectKey(OPENAI, { test: async () => "works", save: async () => { throw new Error("keychain"); } })).outcome, "save-failed");
  // An empty balance still proves the key, so it is kept and the check result shown.
  assert.deepEqual(await connectKey(OPENAI, { test: async () => "no-credit", save }), { outcome: "no-credit", provider: "openai", connected: true });
  assert.deepEqual(saved, [["anthropic", CLAUDE], ["openai", OPENAI]]);
  assert.deepEqual(["works", "no-credit", "offline", "rejected", "busy"].map(keepsKey), [true, true, false, false, false]);
});

test("ChatGPT's own problems map onto the same outcome words", () => {
  assert.equal(chatgptOutcome(new Error("chatgpt_refresh_required")), "signed-out");
  assert.equal(chatgptOutcome(Object.assign(new Error("openai_http_401"), { status: 401 })), "signed-out");
  assert.equal(chatgptOutcome(Object.assign(new Error("openai_http_429"), { apiCode: "subscription_sharing_usage_limit_exceeded" })), "no-credit");
  assert.equal(chatgptOutcome(new Error("no_eligible_models")), "not-allowed");
  assert.equal(chatgptOutcome(new Error("openai_http_429")), "busy");
  assert.equal(chatgptOutcome(new Error("openai_http_503")), "offline");
  assert.equal(issueOutcome(null), "works");
  assert.equal(issueOutcome(connectionIssue(new Error("chatgpt_sign_in_required"))), "signed-out");
});

test("one name for each connection and each problem, wherever it is shown", () => {
  assert.deepEqual([chatgpt, openai, claude, null].map(connectionName), ["ChatGPT", "OpenAI key", "Anthropic key", null]);
  assert.deepEqual([undefined, null, claude].map(connectionValue), [null, "Not connected", "Anthropic key"]);
  assert.deepEqual([chatgpt, claude, null].map(methodOf), ["chatgpt", "key", null]);
  // The same outcome reads the same for both ways, apart from naming whose it is.
  for (const method of ["chatgpt", "key"]) {
    assert.equal(problemFor(method, "works"), null);
    assert.equal(problemFor(method, "cancelled"), null);
    assert.equal(problemFor(method, "offline", "openai").title, "No connection");
    assert.equal(problemFor(method, "failed", "openai").title, "Couldn’t finish");
    assert.equal(problemFor(method, "rejected", "openai").fix, "reconnect");
    assert.equal(problemFor(method, "no-credit", "openai").fix, "provider");
    assert.equal(problemFor(method, "save-failed").title, "Couldn’t save your key");
  }
  assert.equal(problemFor("chatgpt", "signed-out").title, "Signed out");
  assert.equal(problemFor("key", "rejected", "anthropic").title, "Key not accepted");
  assert.match(problemFor("key", "no-credit", "anthropic").message, /Anthropic account has no credit/);
  assert.match(problemFor("key", "unknown").title, /OpenAI or Anthropic/);
  assert.equal(problemFor("key", "wrong-provider", "anthropic").message, "This looks like an OpenAI key, not an Anthropic one.");
  assert.equal(problemFor("key", "rejected", "anthropic").message.split(" ")[0], "Anthropic");
});

test("two cards with nothing connected; once connected, one card for the one in use and a row for the other", () => {
  // Both ways are offered the same way: a title, what it is for and a button. Keys go by their
  // company, signing in by the product.
  assert.deepEqual(["chatgpt", "key"].map(id => [METHODS[id].account, METHODS[id].offer, METHODS[id].start]), [
    ["Your ChatGPT account", "Uses your ChatGPT plan’s limits. Works great if you already have ChatGPT Go, Plus, or Pro.", "Sign in with ChatGPT"],
    ["An API key", "From OpenAI or Anthropic. ChatGPT Pro and Business, and Claude Max, Ultra and Team, include monthly API credits you can use here.", "Paste a key"],
  ]);
  // Where each company explains the credits: its own help page, over HTTPS. No prices anywhere.
  assert.deepEqual(CREDIT_PAGES.map(page => page.name), ["OpenAI", "Anthropic"]);
  assert.deepEqual(CREDIT_PAGES.map(page => new URL(page.url).host), ["help.openai.com", "support.claude.com"]);
  assert.ok(CREDIT_PAGES.every(page => page.url.startsWith("https://")));
  assert.doesNotMatch(JSON.stringify(METHODS), /[$€£]|\bUSD\b/);
  assert.equal(connectionCard({ current: null }), null);
  assert.equal(connectionCard({ current: undefined }), null);
  assert.deepEqual(connectionCard({ current: chatgpt, account: "you@example.com" }),
    { method: "chatgpt", title: "ChatGPT", detail: "you@example.com", attention: false, other: "key" });
  assert.equal(connectionCard({ current: chatgpt }).detail, "Signed in");
  assert.deepEqual(connectionCard({ current: claude }), { method: "key", title: "Anthropic key", detail: "sk-ant-••••WXYZ", attention: false, other: "chatgpt" });
  assert.equal(connectionCard({ current: openai }).title, "OpenAI key");
  assert.deepEqual(["chatgpt", "key"].map(id => METHODS[id].switchTo), ["Switch to ChatGPT", "Switch to an API key"]);
  // Needing to connect again looks the same for both: red detail, tap to fix.
  const expired = connectionCard({ current: chatgpt, account: "you@example.com", attention: "signed-out" });
  const refused = connectionCard({ current: claude, attention: "rejected" });
  assert.deepEqual([expired.attention, expired.detail], [true, "Signed out. Tap to sign in again."]);
  assert.deepEqual([refused.attention, refused.detail], [true, "Key not accepted. Tap to replace it."]);
  assert.equal(isConnected({ current: chatgpt, attention: "signed-out" }), false);
  assert.equal(isConnected({ current: claude }), true);
  assert.equal(isConnected({ current: null }), false);
  assert.deepEqual([METHODS.chatgpt.change, METHODS.key.change], ["Change account", "Replace key"]);
});

test("the connect page's button and its one line say what will happen to the connection in use", () => {
  assert.deepEqual(["chatgpt", "key"].map(method => connectTitle(method, null)), ["Connect", "Connect"]);
  assert.equal(connectTitle("chatgpt", claude), "Switch to ChatGPT");
  assert.equal(connectTitle("key", chatgpt), "Switch to this key");
  assert.equal(connectTitle("key", openai), "Replace key");
  assert.equal(connectTitle("chatgpt", chatgpt), "Sign in again");
  assert.equal(connectTitle("chatgpt", chatgpt, { mode: "change" }), "Change account");
  assert.equal(keepsUntil("chatgpt", null), null);
  assert.equal(keepsUntil("chatgpt", claude), "Your Anthropic key stays until you’re signed in to ChatGPT.");
  assert.equal(keepsUntil("key", chatgpt), "ChatGPT stays signed in until the new key works.");
  assert.equal(keepsUntil("key", openai), "Your current key stays until the new one works.");
  assert.equal(keepsUntil("chatgpt", chatgpt, { mode: "change" }), "You stay signed in until the new account is.");
});

test("a switch is said once it has happened, naming what went", () => {
  assert.equal(switchNotice(null, claude), null);
  assert.equal(switchNotice(claude, null), null);
  assert.equal(switchNotice(claude, chatgpt), "Now using ChatGPT. Your Anthropic key is gone from this iPhone.");
  assert.equal(switchNotice(chatgpt, openai), "Now using your OpenAI key. ChatGPT is signed out.");
  assert.equal(switchNotice(openai, claude), "Now using your Anthropic key. Your OpenAI key is gone from this iPhone.");
  assert.equal(switchNotice(claude, { ...claude, masked: "sk-ant-••••0000" }), "Key replaced.");
  assert.equal(switchNotice(claude, claude), null);
  assert.equal(switchNotice(chatgpt, chatgpt), null);
});

test("small words under the rows: checks, billing, the model and privacy", () => {
  assert.equal(checkResult("key", undefined), null);
  assert.deepEqual(checkResult("chatgpt", "works"), { ok: true, title: "Working", message: null });
  const empty = checkResult("key", "no-credit", "anthropic");
  assert.deepEqual([empty.ok, empty.title], [false, "Out of credit"]);
  assert.equal(checkResult("chatgpt", "signed-out").title, "Signed out");
  assert.equal(billingLine(chatgpt), "Estimates count toward your ChatGPT plan.");
  assert.equal(billingLine(claude), "Estimates are billed to your Anthropic account.");
  const choices = [{ slug: "a", display_name: "Model A" }, { slug: "b" }];
  assert.equal(modelValue({ choices, preferred: null }), "Automatic");
  assert.equal(modelValue({ choices, preferred: "a" }), "Model A");
  assert.equal(modelValue({ choices, preferred: "gone" }), "Automatic", "a model the account lost falls back, as logging does");
  assert.equal(modelValue({ choices: [], preferred: "kept" }), "kept");
  assert.match(privacyLine(null), /no servers/);
  assert.equal(privacyLine(chatgpt), methodPrivacy("chatgpt"));
  assert.match(privacyLine(claude), /goes to Anthropic\. Your key stays in this iPhone’s Keychain/);
  assert.match(methodPrivacy("key", null), /the company it’s from/);
});

// The pages' logic with no screen: the real connection store over a Keychain in memory.
function page(state, overrides = {}) {
  const services = { ...previewConnectionServices(state), ...overrides };
  const states = [];
  const controller = createConnectionController(services, { onChange: value => states.push(value) });
  return { services, controller, states, get state() { return controller.state; } };
}

test("opening reads the one connection and nothing else; a key never reaches the page", async () => {
  const none = page("none");
  assert.equal(none.state, INITIAL_CONNECTION);
  await none.controller.open();
  assert.deepEqual(none.state, { ...INITIAL_CONNECTION, current: null, loaded: true, usage: summarizeUsage([]) });
  const key = page("claude-key");
  await key.controller.open();
  assert.deepEqual([key.state.current, key.state.model], [claude, "Haiku 5.5"]);
  assert.ok(!JSON.stringify(key.states).includes(PREVIEW_KEY));
  const signedIn = page("chatgpt");
  await signedIn.controller.open();
  assert.deepEqual([signedIn.state.current, signedIn.state.account, signedIn.state.model, signedIn.state.attention],
    [chatgpt, "you@example.com", "Automatic", null]);
  // The row shows before ChatGPT's details arrive.
  assert.equal(signedIn.states.find(value => value.current).loaded, false);
});

for (const [method, input, after, previous] of [
  ["chatgpt", {}, chatgpt, "claude-key"],
  ["key", { draft: OPENAI }, openai, "chatgpt"],
]) {
  test(`the same transitions for ${method}: connect, see it checked, check, disconnect`, async () => {
    // Two screens, one store: the connection page stays open under the connect page.
    const hub = page(previous);
    await hub.controller.open();
    const connectPage = createConnectionController(hub.services);
    await connectPage.open();
    const running = connectPage.connect(method, input);
    assert.equal(connectPage.state.busy, "connect");
    assert.equal(await connectPage.connect(method, input), null, "a second tap starts nothing");
    const result = await running;
    assert.equal(result.connected, true);
    assert.deepEqual([connectPage.state.current, connectPage.state.busy, connectPage.state.problem], [after, null, null]);
    // Back on the connection page: the switch is said once, then the card works the same way.
    await hub.controller.open({ outcome: result.outcome });
    assert.deepEqual([hub.state.current, hub.state.check], [after, null]);
    assert.match(hub.state.notice.text, /^Now using/);
    await hub.controller.check();
    assert.deepEqual(hub.state.check, { outcome: "works" });
    await hub.controller.open();
    assert.equal(hub.state.notice, null, "said once");
    await hub.controller.disconnect();
    assert.deepEqual([hub.state.current, await hub.services.read()], [null, null]);
  });
}

test("a failed connect keeps the old connection and says why in the same place for both", async () => {
  const refused = page("chatgpt", { connect: async () => ({ outcome: "rejected", provider: "anthropic", connected: false }) });
  await refused.controller.open();
  await refused.controller.connect("key", { draft: CLAUDE });
  assert.deepEqual([refused.state.current, refused.state.problem], [chatgpt, { method: "key", outcome: "rejected", provider: "anthropic" }]);
  refused.controller.clearProblem();
  assert.equal(refused.state.problem, null, "typing clears it");
  const offline = page("signin-error");
  await offline.controller.open();
  await offline.controller.connect("chatgpt", {});
  assert.deepEqual([offline.state.current, offline.state.problem], [null, { method: "chatgpt", outcome: "offline", provider: null }]);
  // Closing the sign-in sheet says nothing.
  const closed = page("claude-key", { connect: () => connectChatGPT({}, { signIn: async () => { throw cancelled(); } }) });
  await closed.controller.open();
  await closed.controller.connect("chatgpt", {});
  assert.deepEqual([closed.state.current, closed.state.problem, closed.state.notice], [claude, null, null]);
});

test("needing to connect again shows on the row for both ways, and connecting again clears it", async () => {
  const expired = page("expired");
  await expired.controller.open();
  assert.equal(expired.state.attention, "signed-out");
  assert.equal(connectionCard(expired.state).attention, true);
  await expired.controller.connect("chatgpt", {});
  assert.equal(expired.state.attention, null);
  assert.equal(expired.state.notice, null, "signing back in to the same connection isn't a switch");
  const refused = page("claude-key", { check: async () => "rejected" });
  await refused.controller.open();
  await refused.controller.check();
  assert.deepEqual([refused.state.attention, connectionCard(refused.state).attention], ["rejected", true]);
  const empty = page("claude-key", { check: async () => "no-credit" });
  await empty.controller.open();
  await empty.controller.check();
  assert.deepEqual([empty.state.attention, empty.state.check], [null, { outcome: "no-credit" }], "credit is fixed with the provider, not here");
});

test("problems reading ChatGPT's details or the Keychain leave things in place", async () => {
  const quiet = page("chatgpt", { chatgpt: async () => { throw new Error("openai_http_503"); } });
  await quiet.controller.open();
  assert.deepEqual([quiet.state.current, quiet.state.loaded, quiet.state.attention, quiet.state.check], [chatgpt, true, null, null]);
  const limited = page("chatgpt", { chatgpt: async () => { throw Object.assign(new Error("openai_http_429"), { apiCode: "subscription_sharing_usage_limit_exceeded" }); } });
  await limited.controller.open();
  assert.deepEqual(limited.state.check, { outcome: "no-credit" });
  const broken = page("none", { read: async () => { throw new Error("keychain"); } });
  await broken.controller.open();
  assert.deepEqual([broken.state.current, broken.state.loaded, broken.state.notice.tone], [null, true, "bad"]);
  const stuck = page("claude-key", { disconnect: async () => { throw new Error("keychain"); } });
  await stuck.controller.open();
  await stuck.controller.disconnect();
  assert.deepEqual([stuck.state.current, stuck.state.notice], [claude, { tone: "bad", text: "Couldn’t disconnect. Try again." }]);
});

test("a sign-in still running from an earlier visit is waited for, and a page that was left hears nothing", async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const waiting = page("none", { pending: () => pending });
  const opening = waiting.controller.open();
  assert.equal(waiting.state.busy, "connect");
  assert.equal(waiting.state.current, undefined);
  finish(); await opening;
  assert.deepEqual([waiting.state.busy, waiting.state.loaded], [null, true]);
  let release;
  const slow = page("none", { connect: () => new Promise(resolve => { release = resolve; }) });
  await slow.controller.open();
  const connecting = slow.controller.connect("key", { draft: CLAUDE });
  slow.controller.close();
  const seen = slow.states.length;
  release({ outcome: "works", provider: "anthropic", connected: true }); await connecting;
  assert.equal(slow.states.length, seen);
});

test("the connect flow's hand-offs are read once", () => {
  assert.equal(takeLogAfterConnect(), null);
  logAfterConnect("voice");
  assert.deepEqual([takeLogAfterConnect(), takeLogAfterConnect()], ["voice", null]);
  leaveConnectOutcome("no-credit");
  assert.deepEqual([takeConnectOutcome(), takeConnectOutcome()], ["no-credit", null]);
});

test("a connection problem while logging is one alert, in the page's words, leading to what fixes it", () => {
  const key = code => Object.assign(new Error(code), { provider: "anthropic" });
  const refused = loggingProblem(key("apikey_rejected"));
  assert.deepEqual([refused.title, refused.message, refused.action, refused.actionLabel],
    ["Key not accepted", "Anthropic didn’t accept your key. Your meal is still here.", "connection", "Replace Key"]);
  const expired = loggingProblem(new Error("chatgpt_refresh_required"));
  assert.deepEqual([expired.title, expired.action, expired.actionLabel], [problemFor("chatgpt", "signed-out").title, "connection", "Sign In"]);
  // Problems the provider fixes open the provider's page, for a key as for ChatGPT.
  const empty = loggingProblem(key("apikey_no_credit"));
  assert.deepEqual([empty.title, empty.action, empty.actionLabel, empty.url], ["Out of credit", "provider", "Open Billing", "https://platform.claude.com/settings/billing"]);
  const usage = loggingProblem(new Error("plan_usage_unavailable"));
  assert.deepEqual([usage.title, usage.action, usage.url], ["Usage limit reached", "provider", "https://chatgpt.com/settings/usage"]);
  for (const code of ["apikey_network", "apikey_rate_limited", "apikey_provider_busy"]) assert.equal(loggingProblem(key(code)).action, null, code);
  const none = loggingProblem(new Error("ai_connection_required"));
  assert.deepEqual([none.action, none.actionLabel], ["connection", "Connect"]);
  for (const code of ["invalid_estimate", "no_food_detected", "request_cancelled", ""]) assert.equal(loggingProblem(new Error(code)), null, code);
  assert.equal(loggingProblem(null), null);
});

test("from the voice sheet nothing can open over it, so the alert says where to go instead", () => {
  const refused = loggingProblem(Object.assign(new Error("apikey_rejected"), { provider: "openai" }), { inSheet: true });
  assert.deepEqual([refused.action, refused.message],
    [null, "OpenAI didn’t accept your key. Replace it in Settings → AI connection. Your words are still here."]);
  const expired = loggingProblem(new Error("chatgpt_sign_in_required"), { inSheet: true });
  assert.equal(expired.action, null);
  assert.match(expired.message, /Sign in again in Settings → AI connection\./);
  assert.equal(loggingProblem(new Error("plan_usage_unavailable"), { inSheet: true }).action, "provider", "ChatGPT's settings open outside the app");
  assert.match(loggingProblem(new Error("ai_connection_required"), { inSheet: true }).message, /Connect one in Settings → AI connection/);
});

test("the log pages say nothing while the connection works and offer one fix when it doesn't", () => {
  assert.deepEqual(connectionPresentation({ state: "ready", type: "claude-key" }), {});
  assert.deepEqual(connectionPresentation({ state: "checking" }), {});
  assert.deepEqual(connectionPresentation({ state: "none" }), { action: "connect", actionLabel: "Connect an AI to estimate" });
  const expired = connectionPresentation({ state: "sign-in", issue: connectionIssue(new Error("chatgpt_refresh_required")) });
  assert.deepEqual(expired, { title: "ChatGPT signed you out", action: "connect", actionLabel: "Sign in again" });
});
