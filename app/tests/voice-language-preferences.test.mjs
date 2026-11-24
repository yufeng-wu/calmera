import test from "node:test";
import assert from "node:assert/strict";
import { createVoiceLanguagePreferences } from "../src/lib/voiceLanguagePreferences.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
const key = owner => `calmera.voice.${owner}`;
async function failureOf(promise, code) {
  let failure;
  await promise.catch(error => { failure = error; });
  assert.ok(failure, "the synthetic operation must reject");
  assert.equal(failure.message, code);
  return failure;
}
function deferredStorage(initial = []) {
  const values = new Map(initial);
  const writes = [];
  const reads = [];
  return { values, writes, reads, adapter: {
    getItem: async itemKey => { reads.push(itemKey); return values.get(itemKey) ?? null; },
    setItem: async (itemKey, value) => {
      const gate = deferred(); writes.push({ key: itemKey, value, gate });
      await gate.promise; values.set(itemKey, value);
    },
  } };
}

test("exact owner keys, English fallback, and the existing two language values are preserved", async () => {
  const calls = []; const values = new Map();
  const preferences = createVoiceLanguagePreferences({
    getItem: async itemKey => { calls.push(["get", itemKey]); return values.get(itemKey); },
    setItem: async (itemKey, value) => { calls.push(["set", itemKey, value]); values.set(itemKey, value); },
  });
  assert.equal(await preferences.load("synthetic-owner"), "en-US");
  assert.equal(await preferences.save("synthetic-owner", "zh-CN"), undefined);
  assert.equal(await preferences.load("synthetic-owner"), "zh-CN");
  await preferences.save("synthetic-owner", "en-US");
  assert.equal(await preferences.load("synthetic-owner"), "en-US");
  assert.deepEqual(calls, [
    ["get", key("synthetic-owner")], ["set", key("synthetic-owner"), "zh-CN"],
    ["get", key("synthetic-owner")], ["set", key("synthetic-owner"), "en-US"],
    ["get", key("synthetic-owner")],
  ]);
});

test("invalid language selections never touch storage or poison later valid selections", async () => {
  let writes = 0;
  const preferences = createVoiceLanguagePreferences({ getItem: async () => null,
    setItem: async () => { writes++; } });
  for (const language of ["en", "zh", "", null, undefined, "fr-FR"]) {
    await failureOf(preferences.save("synthetic-owner", language), "invalid_voice_language");
  }
  assert.equal(writes, 0);
  await preferences.save("synthetic-owner", "en-US"); assert.equal(writes, 1);
});

test("three selections across page instances cannot let an abandoned older write win", async () => {
  const storage = deferredStorage([[key("owner"), "en-US"]]);
  const preferences = createVoiceLanguagePreferences(storage.adapter);
  const abandoned = preferences.save("owner", "zh-CN");
  const reopenedRead = preferences.load("owner");
  const second = preferences.save("owner", "zh-CN");
  const latest = preferences.save("owner", "en-US");
  await nextTurn(); assert.equal(storage.writes.length, 1); assert.equal(storage.reads.length, 0);
  storage.writes[0].gate.resolve(); await abandoned; await nextTurn();
  assert.deepEqual(storage.writes.map(write => write.value), ["zh-CN", "zh-CN"]);
  assert.equal(storage.reads.length, 0);
  storage.writes[1].gate.resolve(); await second; await nextTurn();
  assert.deepEqual(storage.writes.map(write => write.value), ["zh-CN", "zh-CN", "en-US"]);
  assert.equal(storage.reads.length, 0);
  storage.writes[2].gate.resolve(); await latest;
  assert.equal(await reopenedRead, "en-US");
  assert.equal(storage.values.get(key("owner")), "en-US");
});

test("a load drains a newer write added while it waits for the older one", async () => {
  const storage = deferredStorage([[key("owner"), "en-US"]]);
  const preferences = createVoiceLanguagePreferences(storage.adapter);
  const first = preferences.save("owner", "zh-CN");
  let published = false;
  const load = preferences.load("owner").then(value => { published = true; return value; });
  await nextTurn(); const second = preferences.save("owner", "en-US");
  storage.writes[0].gate.resolve(); await first; await nextTurn();
  assert.equal(storage.writes.length, 2); assert.equal(storage.reads.length, 0); assert.equal(published, false);
  storage.writes[1].gate.resolve(); await second;
  assert.equal(await load, "en-US"); assert.equal(storage.reads.length, 1);
});

test("a write completed during a pending raw read invalidates the older storage snapshot", async () => {
  const oldRead = deferred(); const values = new Map([[key("owner"), "en-US"]]); let reads = 0;
  const preferences = createVoiceLanguagePreferences({
    getItem: async itemKey => ++reads === 1 ? oldRead.promise : values.get(itemKey),
    setItem: async (itemKey, value) => { values.set(itemKey, value); },
  });
  const load = preferences.load("owner");
  await preferences.save("owner", "zh-CN");
  oldRead.resolve("en-US");
  assert.equal(await load, "zh-CN"); assert.equal(reads, 2);
});

test("a blocked owner does not block another owner's independent read or write", async () => {
  const storage = deferredStorage([[key("first"), "en-US"]]);
  const preferences = createVoiceLanguagePreferences(storage.adapter);
  const first = preferences.save("first", "zh-CN");
  const other = preferences.save("second", "zh-CN");
  await nextTurn(); assert.equal(storage.writes.length, 2);
  storage.writes.find(write => write.key === key("second")).gate.resolve(); await other;
  assert.equal(await preferences.load("second"), "zh-CN");
  storage.writes.find(write => write.key === key("first")).gate.resolve(); await first;
});

test("a read timeout while awaiting persistence retains its actual write barrier", async () => {
  const storage = deferredStorage([[key("owner"), "en-US"]]);
  const preferences = createVoiceLanguagePreferences(storage.adapter);
  const first = preferences.save("owner", "zh-CN");
  const error = await failureOf(preferences.load("owner", { timeoutMs: 10 }), "voice_language_timeout");
  assert.equal(error.timedOut, true); assert.equal(error.cancelled, false); assert.equal(storage.reads.length, 0);
  const second = preferences.save("owner", "en-US"); await nextTurn();
  assert.equal(storage.writes.length, 1, "observation timeout cannot release an unfinished native write");
  const freshRead = preferences.load("owner");
  storage.writes[0].gate.resolve(); await first; await nextTurn();
  assert.equal(storage.writes.length, 2); assert.equal(storage.reads.length, 0);
  storage.writes[1].gate.resolve(); await second;
  assert.equal(await freshRead, "en-US"); assert.equal(storage.reads.length, 1);
});

test("a stalled raw read times out without poisoning future loads or publishing late data", async () => {
  const oldRead = deferred(); let reads = 0, published = 0;
  const preferences = createVoiceLanguagePreferences({ getItem: () => ++reads === 1 ? oldRead.promise : "zh-CN",
    setItem: async () => {} });
  await failureOf(preferences.load("owner", { timeoutMs: 10 }).then(value => { published++; return value; }), "voice_language_timeout");
  assert.equal(await preferences.load("owner"), "zh-CN");
  oldRead.resolve("en-US"); await nextTurn();
  assert.equal(published, 0); assert.equal(reads, 2);
});

test("external cancellation while waiting for a write stops only that read's observation", async () => {
  const storage = deferredStorage(); const preferences = createVoiceLanguagePreferences(storage.adapter);
  const save = preferences.save("owner", "zh-CN"); const controller = new AbortController();
  const read = preferences.load("owner", { signal: controller.signal });
  controller.abort(); const error = await failureOf(read, "voice_language_cancelled");
  assert.equal(error.name, "AbortError"); assert.equal(error.cancelled, true);
  const freshRead = preferences.load("owner"); await nextTurn();
  assert.equal(storage.reads.length, 0);
  storage.writes[0].gate.resolve(); await save;
  assert.equal(await freshRead, "zh-CN"); assert.equal(storage.reads.length, 1);
});

test("external cancellation during an uncancellable get suppresses its late value", async () => {
  const raw = deferred(); const controller = new AbortController(); let published = 0, reads = 0;
  const preferences = createVoiceLanguagePreferences({ getItem: () => { reads++; return raw.promise; }, setItem: async () => {} });
  const read = preferences.load("owner", { signal: controller.signal }).then(value => { published++; return value; });
  controller.abort(); await failureOf(read, "voice_language_cancelled");
  raw.resolve("zh-CN"); await nextTurn(); assert.equal(published, 0); assert.equal(reads, 1);
});

test("an already inactive or aborted owner never starts a storage read", async () => {
  const preferences = createVoiceLanguagePreferences({ getItem: () => assert.fail("no old-owner read"), setItem: async () => {} });
  const controller = new AbortController(); controller.abort();
  await failureOf(preferences.load("owner", { signal: controller.signal }), "voice_language_cancelled");
  await failureOf(preferences.load("owner", { isActive: () => false }), "voice_language_cancelled");
});

test("render-current owner handoff during a raw read prevents publication before focus cleanup", async () => {
  const raw = deferred(); let owner = "first", published = 0;
  const preferences = createVoiceLanguagePreferences({ getItem: () => raw.promise, setItem: async () => {} });
  const read = preferences.load("first", { isActive: () => owner === "first" }).then(value => { published++; return value; });
  owner = "second"; raw.resolve("en-US");
  await failureOf(read, "voice_language_cancelled"); assert.equal(published, 0);
});

test("owner handoff while waiting for a write prevents any subsequent old-owner get", async () => {
  const storage = deferredStorage(); const preferences = createVoiceLanguagePreferences(storage.adapter); let active = true;
  const save = preferences.save("owner", "zh-CN");
  const read = preferences.load("owner", { isActive: () => active });
  await nextTurn(); active = false; storage.writes[0].gate.resolve(); await save;
  await failureOf(read, "voice_language_cancelled"); assert.equal(storage.reads.length, 0);
  assert.equal(await preferences.load("owner"), "zh-CN");
});

test("a rejected write is not retried, and later reads and explicit saves can recover", async () => {
  const values = new Map([[key("owner"), "en-US"]]); const gate = deferred(); let writes = 0;
  const preferences = createVoiceLanguagePreferences({
    getItem: async itemKey => values.get(itemKey),
    setItem: async (itemKey, value) => { writes++; if (writes === 1) await gate.promise; values.set(itemKey, value); },
  });
  const save = preferences.save("owner", "zh-CN");
  const load = preferences.load("owner");
  gate.reject(new Error("synthetic private storage detail"));
  await failureOf(save, "voice_language_save_failed");
  assert.equal(await load, "en-US"); assert.equal(writes, 1);
  await preferences.save("owner", "zh-CN");
  assert.equal(await preferences.load("owner"), "zh-CN"); assert.equal(writes, 2);
});

test("raw read failures are sanitized without automatic retries", async () => {
  let reads = 0;
  const preferences = createVoiceLanguagePreferences({ getItem: async () => { reads++; throw Error("synthetic private storage detail"); },
    setItem: async () => {} });
  const error = await failureOf(preferences.load("owner"), "voice_language_load_failed");
  assert.equal(error.code, "voice_language_load_failed"); assert.equal(reads, 1);
});

test("the wall-clock deadline rejects a synchronous late read even before its timer runs", async () => {
  const preferences = createVoiceLanguagePreferences({ getItem: () => {
    const until = Date.now() + 15; while (Date.now() < until) { /* synthetic blocking storage */ }
    return "zh-CN";
  }, setItem: async () => {} });
  await failureOf(preferences.load("owner", { timeoutMs: 5 }), "voice_language_timeout");
});

test("invalid observation options cannot start a read", async () => {
  const preferences = createVoiceLanguagePreferences({ getItem: () => assert.fail("invalid options cannot read"), setItem: async () => {} });
  for (const timeoutMs of [0, -1, NaN, Infinity]) {
    await failureOf(preferences.load("owner", { timeoutMs }), "voice_language_load_failed");
  }
});


test("a write that commits before rejecting is confirmed only by an explicit read, without a retry", async () => {
  const values = new Map([[key("owner"), "en-US"]]); let writes = 0, reads = 0;
  const preferences = createVoiceLanguagePreferences({
    getItem: async itemKey => { reads++; return values.get(itemKey); },
    setItem: async (itemKey, value) => {
      writes++; values.set(itemKey, value);
      throw Error("synthetic storage acknowledgement lost after commit");
    },
  });
  await failureOf(preferences.save("owner", "zh-CN"), "voice_language_save_failed");
  assert.equal(writes, 1); assert.equal(reads, 0, "save failure cannot silently reread or retry");
  assert.equal(await preferences.load("owner"), "zh-CN");
  assert.equal(reads, 1); assert.equal(writes, 1, "explicit recovery must remain read-only");
});
