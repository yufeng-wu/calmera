import test from "node:test";
import assert from "node:assert/strict";
import { createConfirmedMealSave } from "../src/lib/confirmedMealSave.mjs";

const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test("a confirmed write whose navigation throws cannot be submitted a second time", async () => {
  const flow = createConfirmedMealSave(); const gate = deferred(); let writes = 0, exits = 0;
  const options = { key: "synthetic-owner", persist: async () => { writes++; await gate.promise; },
    exit: () => { exits++; throw Error("synthetic navigation failure"); } };
  const first = flow.run(options); const repeatedWhilePending = flow.run(options);
  await nextTurn(); assert.equal(writes, 1); assert.equal(flow.hasConfirmed(options.key), false);
  gate.resolve();
  assert.deepEqual(await first, { kind: "confirmed-staying" });
  assert.deepEqual(await repeatedWhilePending, { kind: "confirmed-staying" });
  assert.equal(flow.hasConfirmed(options.key), true);
  assert.deepEqual(await flow.run(options), { kind: "already-confirmed" });
  assert.equal(writes, 1); assert.equal(exits, 1);
});

test("confirmation is synchronous before cache and exit callbacks, in their original order", async () => {
  const flow = createConfirmedMealSave(); const events = [];
  const result = await flow.run({ key: "owner:entry", persist: async () => { events.push("write"); },
    onConfirmed: () => { assert.equal(flow.hasConfirmed("owner:entry"), true); events.push("refresh"); },
    isCurrent: () => { events.push("current"); return true; },
    exit: () => { assert.equal(flow.hasConfirmed("owner:entry"), true); events.push("exit"); },
  });
  assert.deepEqual(result, { kind: "left" });
  assert.deepEqual(events, ["current", "write", "refresh", "current", "exit"]);
});

test("a rejected persist retains its exact error and permits a later explicit retry", async () => {
  const flow = createConfirmedMealSave(); const rejection = Object.assign(Error("synthetic write failure"), { uncertain: true });
  let writes = 0, callbacks = 0;
  const persist = async () => { if (++writes === 1) throw rejection; };
  await assert.rejects(flow.run({ key: "owner", persist, onConfirmed: () => { callbacks++; }, exit: () => { callbacks++; } }), error => error === rejection);
  assert.equal(flow.hasConfirmed("owner"), false); assert.equal(callbacks, 0); assert.equal(writes, 1);
  assert.deepEqual(await flow.run({ key: "owner", persist, exit: () => {} }), { kind: "left" });
  assert.equal(writes, 2);
});

test("confirmation stays isolated by owner and entry, including mounted-form refocus", async () => {
  const flow = createConfirmedMealSave(); let writes = 0;
  const save = key => flow.run({ key, persist: async () => { writes++; }, exit: () => {} });
  await save("owner-a:entry-1");
  assert.equal(flow.hasConfirmed("owner-a:entry-1"), true);
  assert.equal(flow.hasConfirmed("owner-b:entry-1"), false); assert.equal(flow.hasConfirmed("owner-a:entry-2"), false);
  assert.deepEqual(await save("owner-a:entry-1"), { kind: "already-confirmed" });
  await save("owner-b:entry-1"); await save("owner-a:entry-2"); assert.equal(writes, 3);
});

test("inactive work cannot dispatch persistence", async () => {
  const flow = createConfirmedMealSave();
  assert.deepEqual(await flow.run({ key: "owner", isCurrent: () => false,
    persist: () => assert.fail("departed draft cannot write"), exit: () => assert.fail("cannot navigate") }), { kind: "inactive" });
  assert.equal(flow.hasConfirmed("owner"), false);
});

test("a late confirmed result records its latch but never navigates a departed draft", async () => {
  const flow = createConfirmedMealSave(); const gate = deferred(); let active = true, refreshes = 0;
  const pending = flow.run({ key: "owner", isCurrent: () => active, persist: () => gate.promise,
    onConfirmed: () => { refreshes++; }, exit: () => assert.fail("no stale navigation") });
  await nextTurn(); active = false; gate.resolve();
  assert.deepEqual(await pending, { kind: "confirmed-inactive" });
  assert.equal(flow.hasConfirmed("owner"), true); assert.equal(refreshes, 1);
  active = true;
  assert.deepEqual(await flow.run({ key: "owner", persist: () => assert.fail("refocus cannot repeat a known write"), exit: () => {} }), { kind: "already-confirmed" });
});

test("cache callbacks that throw or reject keep success and never become write failures", async () => {
  for (const callback of [() => { throw Error("synthetic cache error"); }, async () => { throw Error("synthetic cache error"); }]) {
    const flow = createConfirmedMealSave(); let writes = 0;
    assert.deepEqual(await flow.run({ key: "owner", persist: async () => { writes++; }, onConfirmed: callback,
      exit: () => assert.fail("a failed settlement callback does not navigate") }), { kind: "confirmed-staying" });
    assert.equal(flow.hasConfirmed("owner"), true);
    assert.deepEqual(await flow.run({ key: "owner", persist: () => assert.fail("no retry"), exit: () => {} }), { kind: "already-confirmed" });
    assert.equal(writes, 1);
  }
});

test("post-confirmation current and async exit failures remain confirmed outcomes", async () => {
  for (const kind of ["current", "exit"]) {
    const flow = createConfirmedMealSave(); let checks = 0;
    const result = await flow.run({ key: "owner", persist: async () => {},
      isCurrent: () => { if (++checks > 1 && kind === "current") throw Error("synthetic activity error"); return true; },
      exit: async () => { throw Error("synthetic async exit error"); },
    });
    assert.deepEqual(result, { kind: "confirmed-staying" }); assert.equal(flow.hasConfirmed("owner"), true);
  }
});
