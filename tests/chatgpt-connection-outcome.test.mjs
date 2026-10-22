import test from "node:test";
import assert from "node:assert/strict";
import { readChatGPTConnection } from "../lib/chatgpt/connectionOutcome.mjs";

const catalog = [{ slug: "synthetic-model", display_name: "Synthetic model" }, { slug: "synthetic-fast" }];
const fakeClient = (overrides = {}) => ({
  connected: async () => true,
  connect: async () => {},
  models: async () => catalog,
  getSelectedModel: async () => "synthetic-fast",
  hasWelcomed: async () => true,
  ...overrides,
});

test("successful authorization is reported before model details fail", async () => {
  const events = [];
  const outcome = await readChatGPTConnection(fakeClient({
    connect: async () => { events.push("authorized"); },
    models: async () => { events.push("catalog"); throw new Error("synthetic catalog failure"); },
  }), { authorize: true, onConnection: value => events.push(value) });
  assert.deepEqual(events, ["authorized", true, "catalog"]);
  assert.equal(outcome.connected, true);
  assert.equal(outcome.state, "temporary");
  assert.equal(outcome.issue.action, "retry");
  assert.deepEqual(outcome.choices, []);
  assert.equal(outcome.selected, "");
});

test("confirmed credential presence remains connected when catalog lookup fails", async () => {
  const outcome = await readChatGPTConnection(fakeClient({ models: async () => { throw new Error("synthetic failure"); } }));
  assert.equal(outcome.connected, true);
  assert.equal(outcome.detailsError, true);
  assert.equal(outcome.selected, "");
});

test("selected-model lookup failure never confirms a fallback checkmark", async () => {
  const outcome = await readChatGPTConnection(fakeClient({ getSelectedModel: async () => { throw new Error("synthetic storage failure"); } }));
  assert.equal(outcome.connected, true);
  assert.deepEqual(outcome.choices, []);
  assert.equal(outcome.selected, "");
  assert.equal(outcome.detailsError, true);
});

test("optional welcome-read failure preserves connection and confirmed model details", async () => {
  const outcome = await readChatGPTConnection(fakeClient({ hasWelcomed: async () => { throw new Error("synthetic welcome failure"); } }), { authorize: true, readWelcome: true });
  assert.equal(outcome.connected, true);
  assert.equal(outcome.detailsError, false);
  assert.equal(outcome.selected, "synthetic-fast");
  assert.equal(outcome.welcomed, null);
});

test("model-only retry reads details without authorization or a connection lookup", async () => {
  let catalogs = 0;
  const client = fakeClient({
    connect: async () => assert.fail("retry must not authorize"),
    connected: async () => assert.fail("retry must not read connection credentials"),
    models: async () => { if (++catalogs === 1) throw new Error("synthetic first failure"); return catalog; },
  });
  assert.equal((await readChatGPTConnection(client, { knownConnected: true })).detailsError, true);
  const outcome = await readChatGPTConnection(client, { knownConnected: true });
  assert.equal(outcome.detailsError, false);
  assert.equal(outcome.selected, "synthetic-fast");
  assert.equal(catalogs, 2);
});

test("successful selected-model read retains the existing default when no preference is stored", async () => {
  const outcome = await readChatGPTConnection(fakeClient({ getSelectedModel: async () => null }));
  assert.equal(outcome.selected, "synthetic-model");
  assert.equal(outcome.detailsError, false);
});

test("not connected skips model and welcome reads", async () => {
  const outcome = await readChatGPTConnection(fakeClient({
    connected: async () => false,
    models: async () => assert.fail("disconnected must not read models"),
    hasWelcomed: async () => assert.fail("disconnected must not read welcome"),
  }), { readWelcome: true });
  assert.equal(outcome.connected, false);
  assert.equal(outcome.detailsError, false);
});

test("authorization failure stays a connection error rather than a details outcome", async () => {
  await assert.rejects(readChatGPTConnection(fakeClient({ connect: async () => { throw new Error("synthetic authorization denied"); } }), {
    authorize: true, onConnection: () => assert.fail("authorization was not confirmed"),
  }), /synthetic authorization denied/);
});

test("stale authorization completion cannot start details or update presentation", async () => {
  let active = true;
  const result = await readChatGPTConnection(fakeClient({
    connect: async () => { active = false; },
    models: async () => assert.fail("stale flow must not start details"),
  }), { authorize: true, isCurrent: () => active, onConnection: () => assert.fail("stale flow must not present") });
  assert.equal(result, null);
});

test("stale model completion cannot read selection or welcome details", async () => {
  let active = true;
  const result = await readChatGPTConnection(fakeClient({
    models: async () => { active = false; return catalog; },
    getSelectedModel: async () => assert.fail("stale flow must not read selection"),
    hasWelcomed: async () => assert.fail("stale flow must not read welcome"),
  }), { isCurrent: () => active, readWelcome: true });
  assert.equal(result, null);
});


test("a failed credential-presence read does not report a disconnected outcome", async () => {
  await assert.rejects(readChatGPTConnection(fakeClient({ connected: async () => { throw new Error("synthetic credential read failure"); } }), {
    onConnection: () => assert.fail("the connection state is unknown"),
  }), /synthetic credential read failure/);
});


test("synchronous connection presentation invalidation prevents all optional reads", async () => {
  let active = true;
  let modelCalls = 0;
  const result = await readChatGPTConnection(fakeClient({
    models: async () => { modelCalls++; return catalog; },
    getSelectedModel: async () => assert.fail("stale flow must not read selection"),
    hasWelcomed: async () => assert.fail("stale flow must not read welcome"),
  }), {
    isCurrent: () => active,
    onConnection: () => { active = false; },
    readWelcome: true,
  });
  assert.equal(result, null);
  assert.equal(modelCalls, 0);
});

test("new-account authorization is forwarded explicitly before publishing a connection", async () => {
  let authorized = false;
  const outcome = await readChatGPTConnection(fakeClient({
    connect: async options => { assert.deepEqual(options, { newAccount: true }); authorized = true; },
  }), {
    authorize: true, connectOptions: { newAccount: true },
    onConnection: value => { assert.equal(authorized, true); assert.equal(value, true); },
  });
  assert.equal(outcome.connected, true);
});


test("stored credentials with an expired authorization never publish the ready state", async () => {
  const error = Object.assign(new Error("openai_http_400"), { status: 400, apiCode: "invalid_grant" });
  const outcome = await readChatGPTConnection(fakeClient({ models: async () => { throw error; } }));
  assert.equal(outcome.connected, true);
  assert.equal(outcome.state, "sign-in");
  assert.equal(outcome.issue.action, "sign-in");
  assert.equal(outcome.choices.length, 0);
});

test("an empty eligible catalog is unavailable rather than a successful connection", async () => {
  const outcome = await readChatGPTConnection(fakeClient({ models: async () => [] }));
  assert.equal(outcome.state, "restricted");
  assert.equal(outcome.issue.action, null);
});

test("an explicit model choice and optional account metadata survive a successful availability check", async () => {
  const account = { email: "person@example.com", hasRegistration: true };
  const outcome = await readChatGPTConnection(fakeClient({ account: async () => account }));
  assert.equal(outcome.state, "ready");
  assert.equal(outcome.account, account);
  assert.equal(outcome.preferred, "synthetic-fast");
});

test("missing optional display metadata cannot turn a usable connection into an error", async () => {
  const outcome = await readChatGPTConnection(fakeClient({ account: async () => { throw new Error("synthetic metadata failure"); } }));
  assert.equal(outcome.state, "ready");
  assert.equal(outcome.account, null);
});

test("a model-list outage preserves the linked email and the user's saved API default without another OAuth flow", async () => {
  const account = { email: "person@example.com", hasRegistration: true };
  const outcome = await readChatGPTConnection(fakeClient({
    account: async () => account,
    connect: async () => assert.fail("a catalog outage must not start sign-in"),
    models: async () => { throw new TypeError("synthetic model-list outage"); },
    getSelectedModel: async () => "synthetic-fast",
  }));
  assert.equal(outcome.connected, true);
  assert.equal(outcome.account, account);
  assert.equal(outcome.preferred, "synthetic-fast");
  assert.equal(outcome.preferenceError, false);
  assert.notEqual(outcome.issue.kind, "sign-in");
  assert.equal(outcome.selected, "");
});

test("recovering the model list restores the saved default without rewriting the preference", async () => {
  let attempts = 0;
  const client = fakeClient({
    models: async () => { if (++attempts === 1) throw new TypeError("synthetic outage"); return catalog; },
    setSelectedModel: async () => assert.fail("loading model choices must not change the API default"),
  });
  assert.equal((await readChatGPTConnection(client)).preferred, "synthetic-fast");
  const recovered = await readChatGPTConnection(client);
  assert.equal(recovered.state, "ready");
  assert.equal(recovered.preferred, "synthetic-fast");
  assert.equal(recovered.selected, "synthetic-fast");
});

test("a failed preference read cannot invent an Automatic checkmark or hide a confirmed expired login", async () => {
  const expired = Object.assign(new Error("openai_http_400"), { status: 400, apiCode: "invalid_grant" });
  const outcome = await readChatGPTConnection(fakeClient({
    models: async () => { throw expired; },
    getSelectedModel: async () => { throw new Error("synthetic keychain read failure"); },
  }));
  assert.equal(outcome.preferenceError, true);
  assert.equal(outcome.selected, "");
  assert.equal(outcome.state, "sign-in");
});

test("a departed page cannot read a saved default after its model-list failure arrives late", async () => {
  let active = true;
  const result = await readChatGPTConnection(fakeClient({
    models: async () => { active = false; throw new TypeError("synthetic late outage"); },
    getSelectedModel: async () => assert.fail("the old focus cannot read preferences"),
  }), { isCurrent: () => active });
  assert.equal(result, null);
});
