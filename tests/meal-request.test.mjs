import test from "node:test";
import assert from "node:assert/strict";
import { mealRequest } from "../lib/mealRequest.mjs";
import { createUiTaskScope } from "../lib/uiTaskScope.mjs";
const options = { url: "https://calmera.invalid/meals", body: { foodName: "Synthetic oats" }, getToken: async () => "synthetic" };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test("credential timeout settles and never dispatches after a late token", async () => {
  const token = deferred(); let calls = 0;
  await assert.rejects(mealRequest({ ...options, timeoutMs: 10, getToken: () => token.promise,
    fetchImpl: async () => { calls++; } }), e => e.timedOut && !e.dispatched && !e.uncertain);
  token.resolve("late synthetic token"); await new Promise(r => setImmediate(r));
  assert.equal(calls, 0);
});
test("a lost POST response is uncertain and is not retried", async () => {
  let calls = 0;
  await assert.rejects(mealRequest({ ...options, timeoutMs: 10, fetchImpl: () => { calls++; return new Promise(() => {}); } }),
    e => e.uncertain && e.dispatched && e.timedOut);
  assert.equal(calls, 1);
});
test("explicit validation rejection preserves server explanation without uncertainty", async () => {
  await assert.rejects(mealRequest({ ...options, fetchImpl: async () => ({ ok: false, status: 400,
    json: async () => ({ details: ["Synthetic amount is invalid"] }) }) }),
  e => !e.uncertain && e.message === "Synthetic amount is invalid");
});
test("response parsing remains inside the complete-operation deadline", async () => {
  await assert.rejects(mealRequest({ ...options, timeoutMs: 10,
    fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }), readResult: r => r.json() }),
  e => e.timedOut && e.uncertain);
});
test("cancelled credentials cannot begin a later write", async () => {
  const controller = new AbortController(); const token = deferred(); let calls = 0;
  const pending = mealRequest({ ...options, signal: controller.signal, getToken: () => token.promise,
    fetchImpl: async () => { calls++; } });
  controller.abort();
  await assert.rejects(pending, e => e.cancelled && !e.dispatched);
  token.resolve("late"); await new Promise(r => setImmediate(r)); assert.equal(calls, 0);
});
test("leaving aborts active work and a later focus never revives old completion", () => {
  const scope = createUiTaskScope(); assert.equal(scope.start(), null);
  scope.activate(); const old = scope.start(); assert.equal(old.isCurrent(), true);
  scope.deactivate(); assert.equal(old.signal.aborted, true);
  scope.activate(); const next = scope.start(); assert.equal(old.isCurrent(), false); assert.equal(next.isCurrent(), true);
  old.finish(); assert.equal(next.isCurrent(), true);
  next.finish(); scope.deactivate(); assert.equal(next.signal.aborted, false);
});

test("payload serialization failure never marks a request dispatched", async () => {
  const body = {}; body.self = body; let calls = 0;
  await assert.rejects(mealRequest({ ...options, body, fetchImpl: async () => { calls++; } }),
    e => !e.dispatched && !e.uncertain && !e.mayHaveSaved);
  assert.equal(calls, 0);
});


test("inactive ownership before token lookup or during handoff prevents dispatch", async () => {
  await assert.rejects(mealRequest({ ...options, isActive: () => false,
    getToken: () => assert.fail("inactive owner cannot acquire credentials"), fetchImpl: () => assert.fail("no write") }),
  error => error.cancelled && !error.dispatched && !error.mayHaveSaved);
  const token = deferred(); let owner = "old"; let calls = 0;
  const pending = mealRequest({ ...options, isActive: () => owner === "old", getToken: () => token.promise,
    fetchImpl: () => { calls++; } });
  owner = "new"; token.resolve("new-owner synthetic-token");
  await assert.rejects(pending, error => error.cancelled && !error.dispatched);
  assert.equal(calls, 0);
});

test("a departed owner cannot read error JSON or successful readResult after fetch", async () => {
  for (const ok of [true, false]) {
    let active = true; let reads = 0;
    await assert.rejects(mealRequest({ ...options, isActive: () => active,
      fetchImpl: async () => { active = false; return { ok, status: 400, json: async () => { reads++; return {}; } }; },
      readResult: async () => { reads++; return {}; },
    }), error => error.cancelled && error.dispatched);
    assert.equal(reads, 0);
  }
});

test("ownership is rechecked after awaited validation details without exposing stale explanation", async () => {
  const details = deferred(), started = deferred(); let active = true;
  const pending = mealRequest({ ...options, isActive: () => active,
    fetchImpl: async () => ({ ok: false, status: 400, json: () => { started.resolve(); return details.promise; } }),
  });
  await started.promise; active = false; details.resolve({ details: ["Synthetic validation detail"] });
  await assert.rejects(pending, error => error.message === "meal_request_cancelled" && error.cancelled && !error.mayHaveSaved);
});

test("late readResult after cancellation cannot return success or mutate its published error", async () => {
  const result = deferred(), started = deferred(); const controller = new AbortController(); let published = 0;
  const pending = mealRequest({ ...options, signal: controller.signal,
    fetchImpl: async () => ({ ok: true }), readResult: () => { started.resolve(); return result.promise; },
  }).then(value => { published++; return value; });
  await started.promise; controller.abort();
  let failure;
  await assert.rejects(pending, error => { failure = error; return error.cancelled && error.uncertain; });
  assert.equal(failure.acknowledgedResult, undefined);
  result.resolve({ id: 1 }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(published, 0); assert.equal(failure.acknowledgedResult, undefined);
});

test("a result acknowledged before owner cleanup stays available as confirmed write bookkeeping", async () => {
  let active = true;
  await assert.rejects(mealRequest({ ...options, isActive: () => active,
    fetchImpl: async () => ({ ok: true }), readResult: async () => { active = false; return { id: 7 }; },
  }), error => error.cancelled && error.uncertain && error.acknowledgedResult?.id === 7);
});

test("wall-clock expiry after synchronous result work cannot publish beyond the deadline", async () => {
  let published = 0;
  const pending = mealRequest({ ...options, timeoutMs: 10, fetchImpl: async () => ({ ok: true }),
    readResult: () => { const until = Date.now() + 20; while (Date.now() < until) { /* occupy one event turn */ } return { id: 1 }; },
  }).then(value => { published++; return value; });
  await assert.rejects(pending, error => error.timedOut && error.uncertain && !error.acknowledgedResult);
  assert.equal(published, 0);
});

test("PUT method, payload, headers and response semantics are preserved", async () => {
  let calls = 0; const response = { ok: true };
  const result = await mealRequest({ ...options, method: "PUT", fetchImpl: async (url, request) => {
    calls++; assert.equal(url, options.url); assert.equal(request.method, "PUT");
    assert.deepEqual(JSON.parse(request.body), options.body);
    assert.deepEqual(request.headers, { Authorization: "Bearer synthetic", "Content-Type": "application/json" });
    return response;
  } });
  assert.equal(result, response); assert.equal(calls, 1);
});
