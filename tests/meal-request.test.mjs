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
