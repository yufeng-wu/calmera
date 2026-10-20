import test from "node:test";
import assert from "node:assert/strict";
import { completeAccountSetup } from "../lib/accountSetup.mjs";

const options = {
  url: "https://calmera.invalid/api/users/", email: " calmera@example.invalid ", localDate: "2026-10-20",
  getToken: async () => "synthetic-token", pollIntervalMs: 0,
};
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
async function failureOf(promise, code) {
  let failure;
  await promise.catch(error => { failure = error; });
  assert.ok(failure, "synthetic setup must reject");
  assert.equal(failure.code, code);
  assert.equal(failure.message, code, "errors must contain only sanitized setup codes");
  return failure;
}
function scriptedFetch(steps) {
  const calls = [];
  const fetchImpl = (url, request) => {
    calls.push({ url, ...request, method: request.method || "GET" });
    assert.ok(steps.length, "no extra requests are allowed");
    const step = steps.shift();
    return typeof step === "function" ? step(request) : Promise.resolve({ status: step });
  };
  return { calls, fetchImpl };
}

test("an existing profile completes with one GET and no create or profile-body read", async () => {
  const { calls, fetchImpl } = scriptedFetch([() => Promise.resolve({ status: 200,
    json: () => assert.fail("setup does not need profile contents") })]);
  const result = await completeAccountSetup({ ...options, fetchImpl });
  assert.deepEqual(result, { existing: true, creationAttempted: false, verificationAttempts: 0 });
  assert.deepEqual(calls.map(call => call.method), ["GET"]);
  assert.equal(calls[0].url, "https://calmera.invalid/api/users/get-user");
});

test("known absence permits one create with the original payload, then GET verification", async () => {
  const { calls, fetchImpl } = scriptedFetch([404, 201, 404, 200]);
  const result = await completeAccountSetup({ ...options, fetchImpl });
  assert.deepEqual(result, { existing: false, creationAttempted: true, verificationAttempts: 2 });
  assert.deepEqual(calls.map(call => call.method), ["GET", "POST", "GET", "GET"]);
  assert.equal(calls[1].url, "https://calmera.invalid/api/users/create-user");
  assert.deepEqual(JSON.parse(calls[1].body), { email: "calmera@example.invalid", username: "calmera", localDate: options.localDate });
  assert.ok(calls.every(call => call.headers.Authorization === "Bearer synthetic-token"));
});

test("unknown or rejected preflight responses never authorize a create", async () => {
  for (const status of [201, 400, 401, 403, 429, 500, undefined]) {
    const { calls, fetchImpl } = scriptedFetch([status]);
    const error = await failureOf(completeAccountSetup({ ...options, fetchImpl }), "account_setup_check_failed");
    assert.equal(error.creationAttempted, false);
    assert.equal(error.mayHaveCreated, false);
    assert.equal(calls.length, 1);
  }
});

test("preflight network and token failures are sanitized and cannot create a user", async () => {
  const raw = "synthetic private provider/server detail";
  const { calls, fetchImpl } = scriptedFetch([() => { throw Error(raw); }]);
  const readError = await failureOf(completeAccountSetup({ ...options, fetchImpl }), "account_setup_check_failed");
  assert.doesNotMatch(readError.message, /private|provider|server/);
  assert.equal(calls.length, 1);
  const tokenError = await failureOf(completeAccountSetup({ ...options, getToken: async () => { throw Error(raw); },
    fetchImpl: () => assert.fail("failed credentials cannot dispatch") }), "account_setup_check_failed");
  assert.equal(tokenError.creationAttempted, false);
});

test("missing credentials fail before any request", async () => {
  await failureOf(completeAccountSetup({ ...options, getToken: async () => null,
    fetchImpl: () => assert.fail("missing token cannot dispatch") }), "account_setup_sign_in_required");
});

test("an unknown or failed POST response is recovered by GET without another POST", async () => {
  for (const post of [500, 400, () => Promise.reject(Error("synthetic lost response"))]) {
    const { calls, fetchImpl } = scriptedFetch([404, post, 200]);
    const result = await completeAccountSetup({ ...options, fetchImpl });
    assert.equal(result.creationAttempted, true);
    assert.equal(result.verificationAttempts, 1);
    assert.deepEqual(calls.map(call => call.method), ["GET", "POST", "GET"]);
  }
});

test("verification read failures may recover without retrying the create", async () => {
  const { calls, fetchImpl } = scriptedFetch([404, 500, () => Promise.reject(Error("synthetic read outage")), 500, 200]);
  const result = await completeAccountSetup({ ...options, pollCount: 3, fetchImpl });
  assert.equal(result.verificationAttempts, 3);
  assert.equal(calls.filter(call => call.method === "POST").length, 1);
});

test("the default verification cap is ten GETs after the one optional POST", async () => {
  const { calls, fetchImpl } = scriptedFetch([404, 201, ...Array(10).fill(404)]);
  const error = await failureOf(completeAccountSetup({ ...options, fetchImpl }), "account_setup_not_ready");
  assert.equal(error.verificationAttempts, 10);
  assert.equal(error.mayHaveCreated, true);
  assert.equal(calls.length, 12);
  assert.equal(calls.filter(call => call.method === "POST").length, 1);
});

test("exhausting the final verification read does not sleep again", async () => {
  const { calls, fetchImpl } = scriptedFetch([404, 201, 404]);
  const error = await failureOf(completeAccountSetup({ ...options, timeoutMs: 1000, pollCount: 1,
    pollIntervalMs: 60000, fetchImpl }), "account_setup_not_ready");
  assert.equal(error.timedOut, false);
  assert.equal(calls.length, 3);
});

test("stalled token lookup times out and a late token cannot dispatch", async () => {
  const token = deferred(); let calls = 0;
  const error = await failureOf(completeAccountSetup({ ...options, timeoutMs: 10, getToken: () => token.promise,
    fetchImpl: async () => { calls++; } }), "account_setup_timeout");
  assert.equal(error.timedOut, true); assert.equal(error.cancelled, false); assert.equal(error.creationAttempted, false);
  token.resolve("late synthetic-token"); await nextTurn();
  assert.equal(calls, 0);
});

test("stalled preflight times out even when fetch ignores abort; late404 cannot create", async () => {
  const read = deferred();
  const { calls, fetchImpl } = scriptedFetch([() => read.promise]);
  await failureOf(completeAccountSetup({ ...options, timeoutMs: 10, fetchImpl }), "account_setup_timeout");
  assert.equal(calls[0].signal.aborted, true);
  read.resolve({ status: 404 }); await nextTurn();
  assert.equal(calls.length, 1);
});

test("stalled POST is bounded and cannot start verification after its late response", async () => {
  const write = deferred();
  const { calls, fetchImpl } = scriptedFetch([404, () => write.promise]);
  const error = await failureOf(completeAccountSetup({ ...options, timeoutMs: 10, fetchImpl }), "account_setup_timeout");
  assert.equal(error.creationAttempted, true); assert.equal(error.mayHaveCreated, true);
  write.resolve({ status: 201 }); await nextTurn();
  assert.equal(calls.length, 2);
});

test("stalled verification is bounded and a late200 cannot revive a failed attempt", async () => {
  const read = deferred();
  const { calls, fetchImpl } = scriptedFetch([404, 201, () => read.promise]);
  const error = await failureOf(completeAccountSetup({ ...options, timeoutMs: 10, fetchImpl }), "account_setup_timeout");
  assert.equal(error.verificationAttempts, 1);
  read.resolve({ status: 200 }); await nextTurn();
  assert.equal(calls.length, 3);
});

test("the whole deadline bounds polling sleeps and cancels their timers", async () => {
  const { calls, fetchImpl } = scriptedFetch([404, 201, 404]);
  const error = await failureOf(completeAccountSetup({ ...options, timeoutMs: 15, pollIntervalMs: 60000, fetchImpl }), "account_setup_timeout");
  assert.equal(error.creationAttempted, true); assert.equal(error.verificationAttempts, 1);
  assert.equal(calls.length, 3);
});

test("external cancellation during token lookup blocks a late dispatch", async () => {
  const token = deferred(); const controller = new AbortController(); let calls = 0;
  const pending = completeAccountSetup({ ...options, signal: controller.signal, getToken: () => token.promise,
    fetchImpl: () => { calls++; } });
  controller.abort();
  const error = await failureOf(pending, "account_setup_cancelled");
  assert.equal(error.cancelled, true); assert.equal(error.timedOut, false);
  token.resolve("late synthetic-token"); await nextTurn(); assert.equal(calls, 0);
});

test("external cancellation during preflight blocks a late create", async () => {
  const read = deferred(); const controller = new AbortController();
  const { calls, fetchImpl } = scriptedFetch([() => read.promise]);
  const pending = completeAccountSetup({ ...options, signal: controller.signal, fetchImpl });
  await nextTurn(); controller.abort();
  await failureOf(pending, "account_setup_cancelled");
  read.resolve({ status: 404 }); await nextTurn(); assert.equal(calls.length, 1);
});

test("external cancellation interrupts a polling sleep without another GET", async () => {
  const controller = new AbortController();
  const { calls, fetchImpl } = scriptedFetch([404, 201, () => {
    setTimeout(() => controller.abort(), 5);
    return Promise.resolve({ status: 404 });
  }]);
  const error = await failureOf(completeAccountSetup({ ...options, signal: controller.signal, pollIntervalMs: 60000, fetchImpl }), "account_setup_cancelled");
  assert.equal(error.creationAttempted, true); assert.equal(calls.length, 3);
});

test("already-cancelled setup never begins credential lookup", async () => {
  const controller = new AbortController(); controller.abort();
  const error = await failureOf(completeAccountSetup({ ...options, signal: controller.signal,
    getToken: () => assert.fail("cancelled setup cannot start"), fetchImpl: () => assert.fail("no request") }), "account_setup_cancelled");
  assert.equal(error.creationAttempted, false);
});


test("a later explicit retry rechecks for a previously completed create before any new POST", async () => {
  const { calls, fetchImpl } = scriptedFetch([404, () => Promise.reject(Error("synthetic lost create response")), 404, 200]);
  const first = await failureOf(completeAccountSetup({ ...options, pollCount: 1, fetchImpl }), "account_setup_not_ready");
  assert.equal(first.mayHaveCreated, true);
  assert.equal(calls.length, 3);
  const retry = await completeAccountSetup({ ...options, fetchImpl });
  assert.equal(retry.existing, true);
  assert.equal(calls.length, 4);
  assert.equal(calls.filter(call => call.method === "POST").length, 1);
});

test("external cancellation of a stalled create cannot launch late verification", async () => {
  const write = deferred(); const controller = new AbortController();
  const { calls, fetchImpl } = scriptedFetch([404, () => write.promise]);
  const pending = completeAccountSetup({ ...options, signal: controller.signal, fetchImpl });
  await nextTurn(); controller.abort();
  const error = await failureOf(pending, "account_setup_cancelled");
  assert.equal(error.creationAttempted, true); assert.equal(error.mayHaveCreated, true);
  write.resolve({ status: 201 }); await nextTurn();
  assert.equal(calls.length, 2);
});
