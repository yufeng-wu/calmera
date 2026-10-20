import test from "node:test";
import assert from "node:assert/strict";
import { fetchGoalProfile, saveGoalProfile, goalSaveErrorMessage } from "../lib/goalProfile.mjs";
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


const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
const saveOptions = { url, getToken: async () => "synthetic-token", body: {
  calorieGoal: 2025, proteinGoal: 157, carbsGoal: 200, fatGoal: 50, localDate: "2026-10-20",
} };
async function failureOf(promise, code) {
  let failure;
  await promise.catch(error => { failure = error; });
  assert.ok(failure, "synthetic goal operation must reject");
  assert.equal(failure.message, code); assert.equal(failure.code, code);
  return failure;
}

test("a stalled save token times out without late PUT or a false saved-state claim", async () => {
  const token = deferred(); let calls = 0;
  const error = await failureOf(saveGoalProfile({ ...saveOptions, timeoutMs: 10, getToken: () => token.promise,
    fetchImpl: () => { calls++; } }), "goals_request_timeout");
  assert.equal(error.dispatched, false); assert.equal(error.mayHaveSaved, false); assert.equal(error.timedOut, true);
  assert.match(goalSaveErrorMessage(error), /try again/);
  assert.doesNotMatch(goalSaveErrorMessage(error), /Check Today/);
  token.resolve("late synthetic-token"); await nextTurn(); assert.equal(calls, 0);
});

test("an uncancellable PUT times out as uncertain and a late success cannot publish", async () => {
  const response = deferred(); let calls = 0; let confirmed = 0; let receivedSignal;
  const pending = saveGoalProfile({ ...saveOptions, timeoutMs: 10, fetchImpl: (_, options) => {
    calls++; receivedSignal = options.signal; return response.promise;
  } }).then(() => { confirmed++; });
  const error = await failureOf(pending, "goals_request_timeout");
  assert.equal(error.dispatched, true); assert.equal(error.mayHaveSaved, true); assert.equal(receivedSignal.aborted, true);
  assert.equal(goalSaveErrorMessage(error), "We couldn’t confirm whether your goals were saved. Your changes are still here. Check Today before saving again.");
  response.resolve({ ok: true, json: () => assert.fail("PUT must not parse a response") });
  await nextTurn(); assert.equal(confirmed, 0); assert.equal(calls, 1);
});

test("external cancellation before save credentials finish cannot dispatch later", async () => {
  const token = deferred(); const controller = new AbortController(); let calls = 0;
  const pending = saveGoalProfile({ ...saveOptions, signal: controller.signal, getToken: () => token.promise,
    fetchImpl: () => { calls++; } });
  controller.abort(); const error = await failureOf(pending, "goals_request_cancelled");
  assert.equal(error.cancelled, true); assert.equal(error.timedOut, false); assert.equal(error.mayHaveSaved, false);
  token.resolve("late synthetic-token"); await nextTurn(); assert.equal(calls, 0);
});

test("external cancellation after PUT dispatch remains uncertain without an automatic retry", async () => {
  const response = deferred(), started = deferred(); const controller = new AbortController(); let calls = 0;
  const pending = saveGoalProfile({ ...saveOptions, signal: controller.signal, fetchImpl: () => {
    calls++; started.resolve(); return response.promise;
  } });
  await started.promise; controller.abort();
  const error = await failureOf(pending, "goals_request_cancelled");
  assert.equal(error.cancelled, true); assert.equal(error.dispatched, true); assert.equal(error.mayHaveSaved, true);
  response.resolve({ ok: true }); await nextTurn(); assert.equal(calls, 1);
});

test("inactive owners cannot begin a save or dispatch after a token handoff", async () => {
  await failureOf(saveGoalProfile({ ...saveOptions, isActive: () => false,
    getToken: () => assert.fail("inactive owner cannot acquire credentials"), fetchImpl: () => assert.fail("no PUT") }), "goals_request_cancelled");
  let active = true;
  const error = await failureOf(saveGoalProfile({ ...saveOptions, isActive: () => active,
    getToken: async () => { active = false; return "new-owner synthetic-token"; }, fetchImpl: () => assert.fail("stale owner cannot PUT") }), "goals_request_cancelled");
  assert.equal(error.dispatched, false); assert.equal(error.mayHaveSaved, false); assert.equal(error.cancelled, true);
});

test("owner departure after a dispatched response rejects stale completion", async () => {
  let active = true; let confirmed = 0;
  const pending = saveGoalProfile({ ...saveOptions, isActive: () => active, fetchImpl: async () => {
    active = false; return { ok: true };
  } }).then(() => { confirmed++; });
  const error = await failureOf(pending, "goals_request_cancelled");
  assert.equal(error.dispatched, true); assert.equal(error.mayHaveSaved, true); assert.equal(confirmed, 0);
});

test("known pre-write rejection differs from backend404/500 and unknown write outcomes", async () => {
  let calls = 0;
  for (const status of [400, 401, 403, 404, 409, 429, 500, undefined]) {
    const error = await failureOf(saveGoalProfile({ ...saveOptions, fetchImpl: async () => {
      calls++; return { ok: false, status, json: () => assert.fail("no PUT failure-body parsing") };
    } }), "goals_save_failed");
    const uncertain = ![400, 401, 403].includes(status);
    assert.equal(error.dispatched, true); assert.equal(error.mayHaveSaved, uncertain, `HTTP ${status}`);
    if (uncertain) assert.match(goalSaveErrorMessage(error), /Check Today/);
    else assert.doesNotMatch(goalSaveErrorMessage(error), /Check Today/);
  }
  assert.equal(calls, 8);
});

test("lost PUT responses are sanitized and marked uncertain; token errors are known non-writes", async () => {
  const raw = "synthetic private server or provider detail"; let calls = 0;
  const network = await failureOf(saveGoalProfile({ ...saveOptions, fetchImpl: async () => { calls++; throw Error(raw); } }), "goals_save_failed");
  assert.equal(network.mayHaveSaved, true); assert.equal(calls, 1);
  const token = await failureOf(saveGoalProfile({ ...saveOptions, getToken: async () => { throw Error(raw); },
    fetchImpl: () => assert.fail("failed credentials cannot PUT") }), "goals_save_failed");
  assert.equal(token.dispatched, false); assert.equal(token.mayHaveSaved, false);
});

test("one PUT preserves the complete integer recommendation/date and does not read its response", async () => {
  let calls = 0;
  await saveGoalProfile({ ...saveOptions, fetchImpl: async (target, request) => {
    calls++; assert.equal(target, url); assert.equal(request.method, "PUT");
    assert.deepEqual(JSON.parse(request.body), saveOptions.body);
    assert.deepEqual(request.headers, { "Content-Type": "application/json", Authorization: "Bearer synthetic-token" });
    return { ok: true, json: () => assert.fail("PUT response is unnecessary") };
  } });
  assert.equal(calls, 1);
});

test("GET JSON parsing is bounded and late data cannot return after timeout", async () => {
  const data = deferred(); let published = 0;
  const pending = fetchGoalProfile({ url, timeoutMs: 10, getToken: async () => "synthetic-token",
    fetchImpl: async () => ({ ok: true, json: () => data.promise }) }).then(value => { published++; return value; });
  const error = await failureOf(pending, "goals_request_timeout");
  assert.equal(error.mayHaveSaved, false);
  data.resolve({ calorieGoal: 2025 }); await nextTurn(); assert.equal(published, 0);
});

test("GET owner checks run before parsing and after JSON completion", async () => {
  let active = true;
  await failureOf(fetchGoalProfile({ url, getToken: async () => "synthetic-token", isActive: () => active,
    fetchImpl: async () => { active = false; return { ok: true, json: () => assert.fail("stale owner cannot parse") }; } }), "goals_request_cancelled");
  active = true;
  await failureOf(fetchGoalProfile({ url, getToken: async () => "synthetic-token", isActive: () => active,
    fetchImpl: async () => ({ ok: true, json: async () => { active = false; return { calorieGoal: 2025 }; } }) }), "goals_request_cancelled");
});

test("malformed GET JSON is sanitized and legacy unknown save errors remain conservative", async () => {
  await failureOf(fetchGoalProfile({ url, getToken: async () => "synthetic-token",
    fetchImpl: async () => ({ ok: true, json: async () => { throw Error("synthetic private JSON body"); } }) }), "goals_load_failed");
  assert.match(goalSaveErrorMessage(Error("goals_save_failed")), /Check Today/);
  assert.match(goalSaveErrorMessage(Error("synthetic arbitrary failure")), /Check Today/);
});
