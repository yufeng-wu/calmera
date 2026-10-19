import test from "node:test";
import assert from "node:assert/strict";
import { fetchGoalProfile, saveGoalProfile } from "../lib/goalProfile.mjs";
const url = "https://synthetic.invalid/profile";

test("one profile request preserves the exact returned targets", async () => {
  let calls = 0;
  const result = await fetchGoalProfile({ url, getToken: async () => "synthetic-token", fetchImpl: async (_, options) => {
    calls++; assert.equal(options.headers.Authorization, "Bearer synthetic-token");
    return { ok: true, json: async () => ({ calorieGoal: 6123.45 }) };
  }});
  assert.equal(calls, 1); assert.equal(result.calorieGoal, 6123.45);
});
test("a stalled token cannot leave the editor loading forever", async () => {
  let calls = 0;
  await assert.rejects(fetchGoalProfile({ url, timeoutMs: 10, getToken: () => new Promise(() => {}),
    fetchImpl: () => { calls++; } }), /goals_request_timeout/);
  assert.equal(calls, 0);
});
test("a stalled network request times out and is aborted", async () => {
  let receivedSignal;
  await assert.rejects(fetchGoalProfile({ url, timeoutMs: 10, getToken: async () => "synthetic-token",
    fetchImpl: (_, { signal }) => { receivedSignal = signal; return new Promise(() => {}); } }), /goals_request_timeout/);
  assert.equal(receivedSignal.aborted, true);
});
test("unmount cancellation ignores a late token and never starts fetch", async () => {
  const controller = new AbortController(); let complete; let calls = 0;
  const loading = fetchGoalProfile({ url, signal: controller.signal,
    getToken: () => new Promise(resolve => { complete = resolve; }), fetchImpl: () => { calls++; } });
  controller.abort(); await assert.rejects(loading, /goals_request_cancelled/);
  complete("synthetic-token"); await Promise.resolve(); assert.equal(calls, 0);
});
test("HTTP errors terminate loading instead of retrying automatically", async () => {
  let calls = 0;
  await assert.rejects(fetchGoalProfile({ url, getToken: async () => "synthetic-token",
    fetchImpl: async () => { calls++; return { ok: false }; } }), /goals_load_failed/);
  assert.equal(calls, 1);
});


test("save sends one integer PUT and accepts a successful empty response", async () => {
  let calls = 0;
  await saveGoalProfile({ url, getToken: async () => "synthetic-token", body: { calorieGoal: 2025, proteinGoal: 157 },
    fetchImpl: async (_, options) => {
      calls++; assert.equal(options.method, "PUT");
      assert.deepEqual(JSON.parse(options.body), { calorieGoal: 2025, proteinGoal: 157 });
      return { ok: true }; // Saving does not require a JSON response body.
    } });
  assert.equal(calls, 1);
});
test("save errors reject once and leave retry decisions to the editor", async () => {
  let calls = 0;
  await assert.rejects(saveGoalProfile({ url, getToken: async () => "synthetic-token", body: { fatGoal: 50 },
    fetchImpl: async () => { calls++; return { ok: false }; } }), /goals_save_failed/);
  assert.equal(calls, 1);
});
