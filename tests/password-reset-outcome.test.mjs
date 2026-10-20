import test from "node:test";
import assert from "node:assert/strict";
import { createPasswordResetOutcome } from "../lib/passwordResetOutcome.mjs";
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
const completeReset = { status: "complete", createdSessionId: "synthetic-reset-session" };

test("a reset rejection remains a reset failure without activating or claiming completion", async () => {
  const flow = createPasswordResetOutcome(); let resets = 0;
  const outcome = await flow.run({ resetPassword: async () => { resets++; throw Error("synthetic reset rejection"); },
    activateSession: () => assert.fail("failed reset cannot activate"), onResetComplete: () => assert.fail("password did not change") });
  assert.deepEqual(outcome, { kind: "reset-failed" });
  assert.equal(flow.hasCompletedReset(), false); await nextTurn(); assert.equal(resets, 1);
});

test("an incomplete reset does not activate or mark the password updated", async () => {
  const flow = createPasswordResetOutcome();
  const outcome = await flow.run({ resetPassword: async () => ({ status: "needs_new_password" }),
    activateSession: () => assert.fail("incomplete reset cannot activate"), onResetComplete: () => assert.fail("not complete") });
  assert.deepEqual(outcome, { kind: "reset-incomplete" }); assert.equal(flow.hasCompletedReset(), false);
});

test("duplicate submissions share one deferred reset and one activation", async () => {
  const flow = createPasswordResetOutcome(); const reset = deferred(); let resets = 0, activations = 0, completions = 0;
  const args = { resetPassword: () => { resets++; return reset.promise; },
    activateSession: async session => { activations++; assert.equal(session, completeReset.createdSessionId); },
    onResetComplete: () => { completions++; } };
  const first = flow.run(args), duplicate = flow.run(args);
  assert.equal(first, duplicate); await nextTurn(); assert.equal(resets, 1); assert.equal(flow.hasCompletedReset(), false);
  reset.resolve(completeReset);
  assert.deepEqual(await first, { kind: "complete" });
  assert.equal(activations, 1); assert.equal(completions, 1);
});

test("completed reset clears password state before deferred activation fails and cannot reset again", async () => {
  const flow = createPasswordResetOutcome(); const activation = deferred(), started = deferred();
  let passwordState = "synthetic draft"; let resets = 0, activations = 0;
  const args = { resetPassword: async () => { resets++; return completeReset; },
    onResetComplete: () => { passwordState = ""; },
    activateSession: session => {
      activations++; assert.equal(session, completeReset.createdSessionId);
      assert.equal(passwordState, ""); assert.equal(flow.hasCompletedReset(), true);
      started.resolve(); return activation.promise;
    } };
  const first = flow.run(args); await started.promise;
  assert.equal(flow.run(args), first, "pending activation must not cause another reset");
  activation.reject(Error("synthetic activation rejection"));
  assert.deepEqual(await first, { kind: "activation-failed" });
  assert.equal(passwordState, ""); assert.equal(flow.hasCompletedReset(), true);
  assert.deepEqual(await flow.run({ resetPassword: () => assert.fail("completed password cannot be reset again"),
    activateSession: () => assert.fail("no automatic activation retry") }), { kind: "activation-failed" });
  assert.equal(resets, 1); assert.equal(activations, 1);
});

test("successful activation preserves SDK order and terminal completion", async () => {
  const flow = createPasswordResetOutcome(); const events = [];
  const outcome = await flow.run({ resetPassword: async () => { events.push("reset"); return completeReset; },
    onResetComplete: () => { events.push("clear password"); },
    activateSession: async () => { events.push("activate"); } });
  assert.deepEqual(events, ["reset", "clear password", "activate"]);
  assert.deepEqual(outcome, { kind: "complete" });
  assert.deepEqual(await flow.run({ resetPassword: () => assert.fail("no repeated reset"),
    activateSession: () => assert.fail("no repeated activation") }), { kind: "complete" });
});

test("a failed or incomplete reset permits only an explicit later attempt", async () => {
  for (const kind of ["failed", "incomplete"]) {
    const flow = createPasswordResetOutcome(); let calls = 0, activations = 0;
    const args = { resetPassword: async () => {
      calls++;
      if (calls === 1) { if (kind === "failed") throw Error("synthetic reset failure"); return { status: "incomplete" }; }
      return completeReset;
    }, activateSession: async () => { activations++; } };
    await flow.run(args); await nextTurn(); assert.equal(calls, 1); assert.equal(activations, 0);
    assert.deepEqual(await flow.run(args), { kind: "complete" });
    assert.equal(calls, 2); assert.equal(activations, 1);
  }
});


test("leaving before queued reset dispatch prevents any SDK call", async () => {
  const flow = createPasswordResetOutcome(); let active = true;
  const pending = flow.run({ isActive: () => active,
    resetPassword: () => assert.fail("departed form cannot reset"), activateSession: () => assert.fail("no activation") });
  active = false;
  assert.deepEqual(await pending, { kind: "inactive" }); assert.equal(flow.hasCompletedReset(), false);
});

test("stale reset completion across blur and refocus remains latched without activating or unlocking early", async () => {
  const flow = createPasswordResetOutcome(); const reset = deferred(), started = deferred();
  let generation = 1; let active = true; let resets = 0, activations = 0, completed = 0;
  const ticket = generation;
  const pending = flow.run({ isActive: () => active && generation === ticket,
    resetPassword: () => { resets++; started.resolve(); return reset.promise; },
    onResetComplete: () => { completed++; }, activateSession: async () => { activations++; } });
  await started.promise;
  active = false; generation++;
  active = true; generation++;
  assert.equal(flow.run({ isActive: () => true, resetPassword: () => assert.fail("old reset is still in flight"),
    activateSession: () => assert.fail("duplicate activation") }), pending);
  assert.equal(resets, 1); assert.equal(flow.hasCompletedReset(), false);
  reset.resolve(completeReset);
  assert.deepEqual(await pending, { kind: "activation-failed" });
  assert.equal(flow.hasCompletedReset(), true); assert.equal(completed, 1); assert.equal(activations, 0);
  assert.deepEqual(flow.getOutcome(), { kind: "activation-failed" });
  await flow.run({ resetPassword: () => assert.fail("irreversible completion cannot reset again"),
    activateSession: () => assert.fail("no activation retry") });
});

test("already-dispatched activation holds its mutex across refocus until the SDK actually settles", async () => {
  const flow = createPasswordResetOutcome(); const activation = deferred(), started = deferred();
  let active = true; let activations = 0;
  const pending = flow.run({ isActive: () => active, resetPassword: async () => completeReset,
    activateSession: () => { activations++; started.resolve(); return activation.promise; } });
  await started.promise; active = false;
  assert.equal(flow.hasCompletedReset(), true); assert.equal(flow.getOutcome(), null);
  active = true;
  assert.equal(flow.run({ resetPassword: () => assert.fail("pending activation cannot rerun reset"),
    activateSession: () => assert.fail("pending activation cannot rerun") }), pending);
  activation.resolve(); assert.deepEqual(await pending, { kind: "complete" });
  assert.equal(activations, 1); assert.deepEqual(flow.getOutcome(), { kind: "complete" });
});
