import test from "node:test";
import assert from "node:assert/strict";
import { createSettingsOperations } from "../lib/chatgpt/settingsOperations.mjs";
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };

test("settings claim synchronously rejects duplicate taps without queuing another action", async () => {
  const operations = createSettingsOperations(); const save = deferred(); let calls = 0;
  const first = operations.start("synthetic-owner", "model", () => { calls++; return save.promise; });
  assert.equal(operations.start("synthetic-owner", "model", () => { calls++; }), null);
  assert.equal(operations.current("synthetic-owner"), first);
  await Promise.resolve(); assert.equal(calls, 1);
  save.resolve("synthetic-model"); assert.equal(await first.promise, "synthetic-model");
  assert.equal(operations.current("synthetic-owner"), null); assert.equal(calls, 1);
});

test("connect and model persistence share one owner lock until the real operation settles", async () => {
  const operations = createSettingsOperations(); const connect = deferred();
  const originalPage = operations.start("synthetic-owner", "connect", () => connect.promise);
  // A new page instance observes the same mutex; discarding UI state cannot
  // imply cancellation of the already-dispatched provider/storage operation.
  const reopenedPagePending = operations.current("synthetic-owner");
  assert.equal(reopenedPagePending, originalPage);
  assert.equal(operations.start("synthetic-owner", "model", () => "competing write"), null);
  connect.resolve(); await reopenedPagePending.promise;
  const next = operations.start("synthetic-owner", "model", () => "explicit next choice");
  assert.equal(await next.promise, "explicit next choice");
});

test("another owner can connect alongside an earlier independent model write", async () => {
  const operations = createSettingsOperations(); const first = deferred();
  const a = operations.start("synthetic-a", "model", () => first.promise);
  const b = operations.start("synthetic-b", "connect", () => "b complete");
  assert.equal(await b.promise, "b complete"); assert.equal(operations.current("synthetic-a"), a);
  first.resolve(); await a.promise;
});

test("a failed write releases the owner lock without retrying automatically", async () => {
  const operations = createSettingsOperations(); const write = deferred(); let calls = 0;
  const first = operations.start("synthetic-owner", "model", () => { calls++; return write.promise; });
  const rejected = assert.rejects(first.promise, /synthetic write failure/);
  write.reject(new Error("synthetic write failure")); await rejected;
  assert.equal(operations.current("synthetic-owner"), null); assert.equal(calls, 1);
  const retry = operations.start("synthetic-owner", "model", () => { calls++; return "retry complete"; });
  assert.equal(await retry.promise, "retry complete"); assert.equal(calls, 2);
});

test("refocus waits for dispatched persistence before reading the confirmed selection", async () => {
  const operations = createSettingsOperations(); const write = deferred(); let saved = "old synthetic model"; let reads = 0;
  operations.start("synthetic-owner", "model", async () => { await write.promise; saved = "new synthetic model"; });
  const refocusRead = (async () => {
    const pending = operations.current("synthetic-owner");
    if (pending) await pending.promise.catch(() => {});
    reads++; return saved;
  })();
  assert.equal(reads, 0); write.resolve();
  assert.equal(await refocusRead, "new synthetic model"); assert.equal(reads, 1);
});


test("different owners cannot overlap native provider Connect callbacks", async () => {
  const operations = createSettingsOperations(); const provider = deferred(); let secondCalls = 0;
  const first = operations.start("synthetic-a", "connect", () => provider.promise);
  assert.equal(operations.current("synthetic-b"), first);
  assert.equal(operations.start("synthetic-b", "connect", () => { secondCalls++; }), null);
  assert.equal(secondCalls, 0);
  provider.resolve(); await first.promise;
  assert.equal(operations.current("synthetic-b"), null);
  const second = operations.start("synthetic-b", "connect", () => { secondCalls++; return "second owner connected"; });
  assert.equal(await second.promise, "second owner connected"); assert.equal(secondCalls, 1);
});

test("a rejected provider Connect releases the shared listener lock for another owner", async () => {
  const operations = createSettingsOperations(); const provider = deferred();
  const first = operations.start("synthetic-a", "connect", () => provider.promise);
  const rejected = assert.rejects(first.promise, /synthetic provider cancellation/);
  provider.reject(new Error("synthetic provider cancellation")); await rejected;
  assert.equal(operations.current("synthetic-a"), null);
  assert.equal(operations.current("synthetic-b"), null);
  const second = operations.start("synthetic-b", "connect", () => "new callback listener");
  assert.equal(await second.promise, "new callback listener");
});

test("independent owners can persist model choices concurrently", async () => {
  const operations = createSettingsOperations(); const first = deferred(), second = deferred();
  const a = operations.start("synthetic-a", "model", () => first.promise);
  const b = operations.start("synthetic-b", "model", () => second.promise);
  assert.ok(a); assert.ok(b);
  assert.equal(operations.current("synthetic-a"), a); assert.equal(operations.current("synthetic-b"), b);
  first.resolve("a saved"); second.resolve("b saved");
  assert.deepEqual(await Promise.all([a.promise, b.promise]), ["a saved", "b saved"]);
});

test("refocus drains a provider blocker and an older own-model write before reading", async () => {
  const operations = createSettingsOperations(); const model = deferred(), provider = deferred(); let saved = "old model"; let reads = 0;
  operations.start("synthetic-a", "model", async () => { await model.promise; saved = "confirmed model"; });
  const connect = operations.start("synthetic-b", "connect", () => provider.promise);
  assert.equal(operations.current("synthetic-a"), connect);
  const refocusRead = (async () => {
    let pending = operations.current("synthetic-a");
    while (pending) { await pending.promise.catch(() => {}); pending = operations.current("synthetic-a"); }
    reads++; return saved;
  })();
  provider.resolve(); await connect.promise; await Promise.resolve();
  assert.equal(reads, 0);
  model.resolve(); assert.equal(await refocusRead, "confirmed model"); assert.equal(reads, 1);
});
