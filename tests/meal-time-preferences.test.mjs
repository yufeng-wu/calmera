import test from "node:test";
import assert from "node:assert/strict";
import { createMealTimePreferences } from "../lib/mealTimePreferences.mjs";
import { DEFAULT_MEAL_TIMES } from "../lib/mealTimes.mjs";
const custom = { Breakfast: 360, Lunch: 720, Dinner: 1080, Snack: 1380 };
const key = owner => `calmera.meal-times.${owner}`;
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const next = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const values = new Map(), calls = [];
  const preferences = createMealTimePreferences({
    getItem: async k => { calls.push(["get", k]); return values.get(k); },
    setItem: async (k,v) => { calls.push(["set", k]); values.set(k,v); },
  });
  return { values, calls, preferences };
}
test("first use gets independent defaults without writing, and custom values persist per user", async () => {
  const { values, calls, preferences } = fixture();
  const defaults = await preferences.load("a"); defaults.Breakfast = 0;
  assert.equal(DEFAULT_MEAL_TIMES.Breakfast, 300);
  assert.equal(values.size, 0);
  await preferences.save("a", custom);
  assert.deepEqual(await preferences.load("a"), custom);
  assert.deepEqual(await preferences.load("b"), DEFAULT_MEAL_TIMES);
  assert.deepEqual(calls, [["get",key("a")],["set",key("a")],["get",key("a")],["get",key("b")]]);
});
test("corrupt and obsolete stored values use safe defaults without rewriting storage", async () => {
  const { values, calls, preferences } = fixture();
  for (const value of ["not-json", "null", "[]", JSON.stringify({ ...custom, Lunch: 0 })]) {
    values.set(key("a"), value);
    assert.deepEqual(await preferences.load("a"), DEFAULT_MEAL_TIMES);
    assert.equal(values.get(key("a")), value);
  }
  assert.ok(calls.every(([action]) => action === "get"));
});
test("missing owners and invalid times cannot read or write another user's preference", async () => {
  const { calls, preferences } = fixture();
  for (const owner of [null,undefined,"","bad.key"]) {
    await assert.rejects(preferences.load(owner), /owner_required/);
    await assert.rejects(preferences.save(owner, custom), /owner_required/);
  }
  await assert.rejects(preferences.save("a", { ...custom, Lunch: 360 }), /invalid_meal_times/);
  assert.deepEqual(calls, []);
});
test("serialized writes snapshot the draft and reopened reads wait for the latest write", async () => {
  const values = new Map(); const writes = [];
  const p = createMealTimePreferences({ getItem: async k => values.get(k), setItem: async (k,v) => {
    const gate = deferred(); writes.push({ gate, k, v }); await gate.promise; values.set(k,v);
  } });
  const mutable = { ...custom }; const first = p.save("a", mutable); mutable.Breakfast = 0;
  const read = p.load("a"); const latest = p.save("a", DEFAULT_MEAL_TIMES);
  await next(); assert.equal(writes.length, 1); assert.deepEqual(JSON.parse(writes[0].v), custom);
  writes[0].gate.resolve(); await first; await next(); assert.equal(writes.length, 2);
  writes[1].gate.resolve(); await latest;
  assert.deepEqual(await read, DEFAULT_MEAL_TIMES);
});
test("a stale raw read cannot overwrite a newer saved schedule", async () => {
  const gate = deferred(); let reads = 0, stored = null;
  const p = createMealTimePreferences({ getItem: () => ++reads === 1 ? gate.promise : stored,
    setItem: async (_key,value) => { stored = value; } });
  const read = p.load("a"); await p.save("a", custom); gate.resolve(null);
  assert.deepEqual(await read, custom); assert.equal(reads, 2);
});
test("save timeout leaves its actual barrier intact; explicit recovery confirms late persistence", async () => {
  const gate = deferred(); let stored = null, writes = 0;
  const p = createMealTimePreferences({ getItem: async () => stored, setItem: async (_k,v) => { writes++; await gate.promise; stored = v; } });
  await assert.rejects(p.save("a", custom, { timeoutMs: 5 }), /meal_times_timeout/);
  let published = false; const read = p.load("a").then(v => { published = true; return v; });
  await next(); assert.equal(published, false); gate.resolve();
  assert.deepEqual(await read, custom); assert.equal(writes, 1);
});
test("read abort and timeout suppress late data without poisoning the next read", async () => {
  for (const abort of [false,true]) {
    const gate = deferred(); let reads = 0;
    const p = createMealTimePreferences({ getItem: () => ++reads === 1 ? gate.promise : JSON.stringify(custom), setItem: async () => {} });
    const controller = new AbortController();
    const read = p.load("a", { signal: controller.signal, timeoutMs: 5 });
    if (abort) controller.abort();
    await assert.rejects(read, abort ? /meal_times_cancelled/ : /meal_times_timeout/);
    gate.resolve(null); assert.deepEqual(await p.load("a"), custom);
  }
});
test("failed persistence is reported once and explicit reload confirms a committed write", async () => {
  let stored = null, writes = 0;
  const p = createMealTimePreferences({ getItem: async () => stored,
    setItem: async (_k,v) => { writes++; stored = v; throw Error("synthetic lost ack"); } });
  await assert.rejects(p.save("a", custom), /meal_times_save_failed/);
  assert.deepEqual(await p.load("a"), custom); assert.equal(writes, 1);
});
