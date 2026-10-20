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
  assert.deepEqual(outcome, { connected: true, choices: [], selected: "", detailsError: true, welcomed: null });
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
