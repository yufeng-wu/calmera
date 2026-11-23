import test from "node:test";
import assert from "node:assert/strict";
import { checkApiKey, keyProvider } from "../lib/ai/providers.mjs";
import { chatgptOutcome, connectChatGPT, connectKey, issueOutcome, keepsKey, methodOf } from "../lib/ai/connectionMethods.mjs";
import { CREDIT_PAGES, KEY_PAGE, METHODS, SIGN_IN_FAILED, billingLine, connectionCard, connectionName, connectionValue, isConnected,
  methodPrivacy, modelValue, privacyLine, problemFor, readKeyDraft, searchLine, signInProblem } from "../lib/ai/connectionPresentation.mjs";
import { INITIAL_CONNECTION, createConnectionController, statusId } from "../lib/ai/connectionController.mjs";
import { summarizeUsage, usageRow } from "../lib/ai/usage.mjs";
import { PREVIEW_KEY, PREVIEW_OPENAI_KEY, previewConnectionServices } from "../lib/ai/previewConnection.mjs";
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
  assert.deepEqual(readKeyDraft(` ${CLAUDE}\n`), { provider: "anthropic", key: CLAUDE, caption: "Anthropic API key · sk-ant-••••WXYZ" });
  assert.equal(readKeyDraft(OPENAI).caption, "OpenAI API key · sk-proj-••••ABCD");
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
  // On the AI connection page a key is named by its company; on the Settings row it is just an API key.
  assert.deepEqual([chatgpt, openai, claude, null].map(connectionName), ["ChatGPT", "OpenAI API key", "Anthropic API key", null]);
  assert.deepEqual([undefined, null, chatgpt, claude, openai].map(connectionValue), [null, "Not connected", "ChatGPT Plan", "API key", "API key"]);
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

test("with nothing connected: two option cards, and nothing more about either outside its card", () => {
  assert.deepEqual(["chatgpt", "key"].map(id => [METHODS[id].eyebrow, METHODS[id].title, METHODS[id].description, METHODS[id].start]), [
    ["Option 1", "ChatGPT Plan", "Sign in with your ChatGPT account to use your paid plan’s limits.", "Sign in with ChatGPT"],
    ["Option 2", "API Key", "You may be eligible for free monthly API credits with one of these plans:", "Add API key"],
  ]);
  assert.equal(METHODS.chatgpt.note, "Requires a Go, Plus, or Pro tier.");
  assert.deepEqual(METHODS.key.creditPlans, ["ChatGPT Pro and Business", "Claude Max, Ultra, and Team"]);
  assert.deepEqual([KEY_PAGE.title, KEY_PAGE.hint], ["API key", "Paste it, and Calmera can tell which one it is."]);
  // Where each company explains the credits: its own help page, over HTTPS.
  assert.deepEqual(CREDIT_PAGES.map(page => page.name), ["OpenAI", "Anthropic"]);
  assert.deepEqual(CREDIT_PAGES.map(page => new URL(page.url).host), ["help.openai.com", "support.claude.com"]);
  assert.ok(CREDIT_PAGES.every(page => page.url.startsWith("https://")));
  assert.equal(privacyLine(null), "Your sign-in and API key are stored on your iPhone — Calmera has no access to them.");
  // A sign-in that fails says so in place of the ChatGPT card's description.
  assert.equal(SIGN_IN_FAILED, "Couldn’t reach ChatGPT. Check your connection and try again.");
  assert.deepEqual(["offline", "failed", "busy"].map(signInProblem), [SIGN_IN_FAILED, SIGN_IN_FAILED, SIGN_IN_FAILED]);
  assert.equal(signInProblem("cancelled"), null, "closing the sheet is a decision");
  assert.equal(signInProblem("rejected"), "ChatGPT didn’t allow Calmera. Sign in again and allow Calmera to use your plan.");
});

test("connected: one status card, the email or real masked key, then what the last check found", () => {
  assert.equal(connectionCard({ current: null }), null);
  assert.equal(connectionCard({ current: undefined }), null);
  assert.deepEqual(connectionCard({ current: chatgpt, account: "you@example.com", status: "works" }), {
    method: "chatgpt", title: "ChatGPT", detail: "you@example.com", status: { tone: "good", text: "Connected" },
    note: { tone: "plain", text: "Estimates count toward your ChatGPT plan." } });
  assert.deepEqual(connectionCard({ current: claude, status: "works" }), {
    method: "key", title: "Anthropic API key", detail: "sk-ant-••••WXYZ", status: { tone: "good", text: "Connected" },
    note: null });
  const open = connectionCard({ current: openai, status: "works" });
  assert.deepEqual([open.title, open.detail, open.note], ["OpenAI API key", "sk-proj-••••ABCD", null]);
  // Before any check has ever finished, nothing is claimed.
  assert.equal(connectionCard({ current: claude, status: null }).status, null);
  // Needing to connect again: red status, and the note says how, since there is one connection at a time.
  const expired = connectionCard({ current: chatgpt, account: "you@example.com", status: "signed-out" });
  assert.deepEqual([expired.status, expired.note], [{ tone: "bad", text: "Signed out" }, { tone: "bad", text: "Disconnect, then sign in with ChatGPT again." }]);
  const refused = connectionCard({ current: claude, status: "rejected" });
  assert.deepEqual([refused.status.text, refused.note.text], ["Key not accepted", "Disconnect, then add a new API key."]);
  const limited = connectionCard({ current: chatgpt, status: "no-credit" });
  assert.deepEqual([limited.status.text, limited.note.text], ["Usage limit reached", "Review your plan or Calmera’s limit in ChatGPT settings."]);
  assert.equal(isConnected({ current: chatgpt, status: "signed-out" }), false);
  assert.equal(isConnected({ current: claude, status: null }), true);
  assert.equal(isConnected({ current: chatgpt, status: "no-credit" }), true);
  assert.equal(isConnected({ current: null }), false);
});

test("small words under the cards: billing, online search, the model and privacy; no prices", () => {
  assert.equal(billingLine(chatgpt), "Estimates count toward your ChatGPT plan.");
  assert.equal(billingLine(claude), null);
  assert.equal(searchLine(chatgpt), "When enabled, the AI can automatically look up nutrition information for restaurants and brands you mention. Searches count toward your plan.");
  assert.equal(searchLine(claude), "When enabled, the AI can automatically look up nutrition information for restaurants and brands you mention.");
  assert.match(searchLine(claude, { searchable: false }), /can’t search the web/);
  assert.equal(searchLine(null), null);
  const choices = [{ slug: "a", display_name: "Model A" }, { slug: "b" }];
  assert.equal(modelValue({ choices, preferred: null }), "Automatic");
  assert.equal(modelValue({ choices, preferred: "a" }), "Model A");
  assert.equal(modelValue({ choices, preferred: "gone" }), "Automatic", "a model the account lost falls back, as logging does");
  assert.equal(modelValue({ choices: [], preferred: "kept" }), "kept");
  assert.equal(privacyLine(chatgpt), "Your sign-in stays on this iPhone.");
  assert.equal(privacyLine(claude), "Your API key stays in this iPhone’s Keychain.");
  assert.equal(privacyLine(openai), "Your API key stays in this iPhone’s Keychain.");
  assert.match(methodPrivacy("key", "anthropic"), /^Only what you log goes to Anthropic\./);
  assert.match(methodPrivacy("key", null), /the company it’s from/);
  // Every sentence these pages say: no prices, and the brand written Calmera.
  const words = JSON.stringify([METHODS, KEY_PAGE, CREDIT_PAGES.map(page => page.name), SIGN_IN_FAILED, privacyLine(null), privacyLine(chatgpt),
    privacyLine(claude), searchLine(chatgpt), searchLine(claude), billingLine(chatgpt), billingLine(claude),
    ...["rejected", "signed-out", "no-credit", "not-allowed"].map(outcome => connectionCard({ current: chatgpt, status: outcome })),
    ...["rejected", "no-credit"].map(outcome => connectionCard({ current: claude, status: outcome }))]);
  assert.doesNotMatch(words, /[$€£¢]|\bUSD\b|\d+¢/);
  assert.doesNotMatch(words, /calmera/);
});

test("the free check: a key lists its provider's models, which spends nothing", async () => {
  const calls = [];
  const answer = status => async (url, init) => { calls.push([url, init.method]); return { ok: status < 400, status, json: async () => ({ data: [] }) }; };
  assert.equal(await checkApiKey({ fetch: answer(200), provider: "anthropic", key: CLAUDE }), "works");
  assert.equal(await checkApiKey({ fetch: answer(401), provider: "openai", key: OPENAI }), "rejected");
  // A key that can't list models, a busy provider or no network can't tell either way.
  for (const status of [403, 429, 500]) assert.equal(await checkApiKey({ fetch: answer(status), provider: "openai", key: OPENAI }), null, String(status));
  assert.equal(await checkApiKey({ fetch: async () => { throw new TypeError("Network request failed"); }, provider: "openai", key: OPENAI }), null);
  assert.ok(calls.every(([url, method]) => method === "GET" && new URL(url).pathname === "/v1/models"), "only the model lists, never a request that is billed");
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
  assert.deepEqual([key.state.current, key.state.model, key.state.status], [claude, "Haiku 5.5", "works"]);
  assert.ok(!JSON.stringify(key.states).includes(PREVIEW_KEY));
  const other = page("openai-key");
  await other.controller.open();
  assert.deepEqual(other.state.current, { type: "openai-key", provider: "openai", masked: `sk-proj-••••${PREVIEW_OPENAI_KEY.slice(-4)}` });
  assert.ok(!JSON.stringify(other.states).includes(PREVIEW_OPENAI_KEY));
  const signedIn = page("chatgpt");
  await signedIn.controller.open();
  assert.deepEqual([signedIn.state.current, signedIn.state.account, signedIn.state.model, signedIn.state.status],
    [chatgpt, "you@example.com", "Automatic", "works"]);
  // The card and the email, which are on this iPhone, show before ChatGPT's details arrive.
  const early = signedIn.states.find(value => value.current);
  assert.deepEqual([early.loaded, early.account], [false, "you@example.com"]);
});

test("every visit checks for free; the last status shows at once and changes only when the result does", async () => {
  let answer = "works";
  const checks = [];
  const key = page("claude-key", { check: async () => { checks.push(answer); return answer; } });
  await key.controller.open();
  assert.equal(key.state.status, "works");
  assert.deepEqual(await key.services.lastStatus(), { of: statusId(claude), outcome: "works" });
  // Next visit: "works" is there before the check runs, and the same answer changes nothing.
  key.states.length = 0;
  await key.controller.open();
  assert.equal(key.states.find(value => value.current).status, "works", "shown at once");
  assert.ok(key.states.every(value => value.status === "works"), "no flicker, no spinner");
  // Not reaching the provider says nothing about the key: the last status stays.
  answer = null;
  await key.controller.open();
  assert.equal(key.state.status, "works");
  answer = "rejected";
  await key.controller.open();
  assert.equal(key.state.status, "rejected");
  assert.equal(checks.length, 4, "one check per visit");
  // ChatGPT is checked as its details are read: an expired sign-in turns the status red.
  const expired = page("expired");
  await expired.controller.open();
  assert.equal(expired.state.status, "signed-out");
  const quiet = page("chatgpt", { chatgpt: async () => { throw new Error("openai_http_503"); } });
  await quiet.services.saveStatus({ of: "chatgpt", outcome: "works" });
  await quiet.controller.open();
  assert.deepEqual([quiet.state.loaded, quiet.state.status], [true, "works"], "ChatGPT being down isn't news");
  // A status belongs to the connection it was found for: a new key starts with none.
  const fresh = page("claude-key", { check: async () => null });
  await fresh.services.saveStatus({ of: "claude-key:sk-ant-••••0000", outcome: "rejected" });
  await fresh.controller.open();
  assert.equal(fresh.state.status, null);
});

for (const [method, input, after] of [
  ["chatgpt", {}, chatgpt],
  ["key", { draft: OPENAI }, openai],
]) {
  test(`the same transitions for ${method}: connect, see it connected, disconnect, and usage stays`, async () => {
    // Two screens, one store: the connection page stays open under the key page.
    const hub = page("none", { usageRows: async () => [usageRow({ provider: "openai", model: "gpt-6-luna", input: 10, output: 2 })] });
    await hub.controller.open();
    assert.equal(hub.state.usage.total.requests, 1);
    const connectPage = createConnectionController(hub.services);
    await connectPage.open();
    const running = connectPage.connect(method, input);
    assert.equal(connectPage.state.busy, "connect");
    assert.equal(await connectPage.connect(method, input), null, "a second tap starts nothing");
    const result = await running;
    assert.equal(result.connected, true);
    assert.deepEqual([connectPage.state.current, connectPage.state.busy, connectPage.state.problem, connectPage.state.status], [after, null, null, "works"]);
    await hub.controller.open({ outcome: result.outcome });
    assert.deepEqual([hub.state.current, hub.state.status], [after, "works"]);
    assert.equal(connectionCard(hub.state).status.text, "Connected");
    await hub.controller.disconnect();
    assert.deepEqual([hub.state.current, hub.state.status, await hub.services.read(), await hub.services.lastStatus()], [null, null, null, null]);
    await hub.controller.open();
    assert.equal(hub.state.usage.total.requests, 1, "usage is kept after a disconnect");
  });
}

test("a failed connect leaves nothing connected and says why where it was asked", async () => {
  const refused = page("none", { connect: async () => ({ outcome: "rejected", provider: "anthropic", connected: false }) });
  await refused.controller.open();
  await refused.controller.connect("key", { draft: CLAUDE });
  assert.deepEqual([refused.state.current, refused.state.problem], [null, { method: "key", outcome: "rejected", provider: "anthropic" }]);
  refused.controller.clearProblem();
  assert.equal(refused.state.problem, null, "typing clears it");
  const offline = page("signin-error");
  await offline.controller.open();
  await offline.controller.connect("chatgpt", {});
  assert.deepEqual([offline.state.current, offline.state.problem], [null, { method: "chatgpt", outcome: "offline", provider: null }]);
  assert.equal(signInProblem(offline.state.problem.outcome), SIGN_IN_FAILED);
  // Closing the sign-in sheet says nothing.
  const closed = page("none", { connect: () => connectChatGPT({}, { signIn: async () => { throw cancelled(); } }) });
  await closed.controller.open();
  await closed.controller.connect("chatgpt", {});
  assert.deepEqual([closed.state.current, closed.state.problem, closed.state.notice], [null, null, null]);
});

test("problems reading ChatGPT's details or the Keychain leave things in place", async () => {
  const limited = page("chatgpt", { chatgpt: async () => { throw Object.assign(new Error("openai_http_429"), { apiCode: "subscription_sharing_usage_limit_exceeded" }); } });
  await limited.controller.open();
  assert.equal(limited.state.status, "no-credit");
  const broken = page("none", { read: async () => { throw new Error("keychain"); } });
  await broken.controller.open();
  assert.deepEqual([broken.state.current, broken.state.loaded, broken.state.notice.at], [null, true, "page"]);
  const stuck = page("claude-key", { disconnect: async () => { throw new Error("keychain"); } });
  await stuck.controller.open();
  await stuck.controller.disconnect();
  assert.deepEqual([stuck.state.current, stuck.state.notice], [claude, { at: "disconnect", text: "Couldn’t disconnect. Try again." }]);
  const unsaved = page("claude-key", { setSearch: async () => { throw new Error("storage"); } });
  await unsaved.controller.open();
  await unsaved.controller.setSearch(false);
  assert.deepEqual([unsaved.state.search, unsaved.state.notice.at], [true, "search"]);
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
