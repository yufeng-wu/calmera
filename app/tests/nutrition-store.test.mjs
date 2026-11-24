import test from "node:test";
import assert from "node:assert/strict";
import { createNutritionStore } from "../src/lib/nutritionStore.mjs";
const date = "2026-10-19";
const row = (id, calories = 100) => ({ id, food_name: `Synthetic meal ${id}`, meal_type: "Breakfast", local_time: "09:00:00", calories, protein: 2, carbs: 3, fat: 4 });
const summary = (...entries) => ({ foodEntries: entries, dailyTotals: { calories: entries.reduce((sum, item) => sum + Number(item.calories), 0) } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test("rapid Today/History consumers deduplicate in-flight requests and reuse fresh data", async () => {
  const store = createNutritionStore();
  const waits = { profile: deferred(), day: deferred(), history: deferred() };
  const calls = { profile: 0, day: 0, history: 0 };
  const load = ({ resource }) => { calls[resource]++; return waits[resource].promise; };
  const requests = [];
  for (let i = 0; i < 10; i++) { requests.push(store.loadProfile(load), store.loadDay(date, load), store.loadHistory(load)); }
  await Promise.resolve();
  assert.deepEqual(calls, { profile: 1, day: 1, history: 1 });
  waits.profile.resolve({ calorieGoal: 2000 }); waits.day.resolve(summary(row(1))); waits.history.resolve({ [date]: summary(row(1)) });
  await Promise.all(requests);
  for (let i = 0; i < 20; i++) await Promise.all([store.loadDay(date, load), store.loadHistory(load), store.loadProfile(load)]);
  assert.deepEqual(calls, { profile: 1, day: 1, history: 1 });
  assert.equal(store.getSnapshot().days[date].entries[0].foodName, "Synthetic meal 1");
  assert.equal(store.getDiagnostics().pendingRequests, 0);
});

test("a valid empty history is cached and does not trigger perpetual reloads", async () => {
  const store = createNutritionStore(); let calls = 0;
  const load = async () => { calls++; return {}; };
  await store.loadHistory(load); await store.loadHistory(load); await store.loadDay(date, load);
  assert.equal(calls, 1); assert.equal(store.getSnapshot().days[date].entries.length, 0);
});

test("an older whole-history response cannot replace a newer daily response", async () => {
  const store = createNutritionStore(); const old = deferred();
  const history = store.loadHistory(() => old.promise);
  await store.loadDay(date, async () => summary(row(2)), { force: true });
  old.resolve({ [date]: summary(row(1)) }); await history;
  assert.deepEqual(store.getSnapshot().days[date].entries.map((entry) => entry.id), [2]);
});

test("confirmed additions survive stale requests and duplicate save results", async () => {
  const store = createNutritionStore();
  await store.loadDay(date, async () => summary(row(1)));
  const stale = deferred(); const request = store.loadDay(date, () => stale.promise, { force: true });
  await Promise.resolve(); store.addConfirmed(date, [row(2), row(2)]);
  stale.resolve(summary(row(1))); await request;
  const day = store.getSnapshot().days[date];
  assert.deepEqual(day.entries.map((entry) => entry.id), [1, 2]);
  assert.equal(day.summary.dailyTotals.calories, 200);
});

test("failed background refresh keeps visible data, and retry clears the error", async () => {
  let time = 1000; const store = createNutritionStore({ now: () => time, dayTTL: 10 });
  await store.loadDay(date, async () => summary(row(1)));
  time += 20;
  await assert.rejects(store.loadDay(date, async () => { throw new Error("synthetic network failure"); }));
  assert.equal(store.getSnapshot().days[date].entries[0].id, 1);
  assert.ok(store.getSnapshot().errors[`day:${date}`]);
  await store.loadDay(date, async () => summary(row(2)), { force: true });
  assert.equal(store.getSnapshot().errors[`day:${date}`], null);
  assert.equal(store.getSnapshot().days[date].entries[0].id, 2);
});

test("a retry keeps the failure visible until it succeeds, so a cold error never shows as loading", async () => {
  const store = createNutritionStore(); const retry = deferred();
  await assert.rejects(store.loadDay(date, async () => { throw new Error("synthetic network failure"); }));
  const request = store.loadDay(date, () => retry.promise, { force: true });
  await Promise.resolve();
  assert.ok(store.getSnapshot().errors[`day:${date}`]);
  assert.equal(store.getSnapshot().pending[`day:${date}`], true);
  retry.resolve(summary(row(1))); await request;
  assert.equal(store.getSnapshot().errors[`day:${date}`], null);
  assert.equal(store.getSnapshot().days[date].entries[0].id, 1);
});

test("invalidation starts a fresh request and stale completion cannot clear its loading state", async () => {
  const store = createNutritionStore(); const old = deferred(), fresh = deferred();
  const before = store.loadDay(date, () => old.promise); await Promise.resolve();
  store.invalidateEntries();
  const after = store.loadDay(date, () => fresh.promise); await Promise.resolve();
  old.resolve(summary(row(1))); await before;
  assert.equal(store.getSnapshot().pending[`day:${date}`], true);
  fresh.resolve(summary(row(2))); await after;
  assert.equal(store.getSnapshot().pending[`day:${date}`], false);
  assert.equal(store.getSnapshot().days[date].entries[0].id, 2);
});

test("overlapping optimistic deletions roll back only the failed row", async () => {
  const store = createNutritionStore(); await store.loadDay(date, async () => summary(row(1), row(2)));
  const first = store.removeOptimistically(date, 1), second = store.removeOptimistically(date, 2);
  let reads = 0; await store.loadDay(date, async () => { reads++; return summary(row(1), row(2)); });
  assert.equal(reads, 0);
  store.finishRemoval(first, false); store.finishRemoval(second, true);
  assert.deepEqual(store.getSnapshot().days[date].entries.map((entry) => entry.id), [1]);
  assert.equal(store.getSnapshot().days[date].summary.dailyTotals.calories, 100);
});

test("account disposal clears data and ignores late responses", async () => {
  const first = createNutritionStore({ ownerKey: "synthetic-a" }); const late = deferred();
  const request = first.loadHistory(() => late.promise); await Promise.resolve(); first.dispose();
  late.resolve({ [date]: summary(row(1)) }); await request;
  const second = createNutritionStore({ ownerKey: "synthetic-b" });
  assert.equal(first.belongsTo("synthetic-a"), false);
  assert.equal(second.belongsTo("synthetic-a"), false);
  assert.equal(second.belongsTo("synthetic-b"), true);
  assert.deepEqual(first.getSnapshot().days, {}); assert.deepEqual(second.getSnapshot().days, {});
});

test("a Strict Mode release/reacquire does not dispose the active store", async () => {
  const store = createNutritionStore(); store.retain(); store.release(); store.retain();
  await Promise.resolve(); assert.equal(store.isActive(), true);
  store.release(); await Promise.resolve(); assert.equal(store.isActive(), false);
});


test("age alone re-reads today but never a past day, which waits for an edit or a pull", async () => {
  let time = new Date(2026, 9, 20, 12).getTime(), today = 0, past = 0;
  const store = createNutritionStore({ now: () => time });
  const readToday = async () => { today++; return summary(row(1)); };
  const readPast = async () => { past++; return summary(row(2)); };
  await store.loadDay("2026-10-20", readToday); await store.loadDay(date, readPast);
  time += 24 * 3600000;
  await store.loadDay("2026-10-21", readToday);
  time += 300001;
  await store.loadDay("2026-10-21", readToday);
  assert.equal(today, 3);
  await store.loadDay(date, readPast);
  assert.equal(past, 1);
  await store.loadDay(date, readPast, { force: true });
  assert.equal(past, 2);
  store.invalidateEntries();
  await store.loadDay(date, readPast);
  assert.equal(past, 3);
});

test("failed automatic refresh backs off while an explicit retry remains immediate", async () => {
  let time = 1000, calls = 0;
  const store = createNutritionStore({ now: () => time });
  const fail = async () => { calls++; throw new Error("synthetic offline"); };
  await assert.rejects(store.loadHistory(fail));
  for (let i = 0; i < 20; i++) await store.loadHistory(fail);
  assert.equal(calls, 1);
  await assert.rejects(store.loadHistory(fail, { force: true }));
  assert.equal(calls, 2);
  time += 15001;
  await assert.rejects(store.loadHistory(fail));
  assert.equal(calls, 3);
});
