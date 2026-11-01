import test from "node:test";
import assert from "node:assert/strict";
import { createNutritionStore, normalizeDay } from "../lib/nutritionStore.mjs";
import { createTodayCache } from "../lib/todayCache.mjs";

const date = "2026-11-01";
const profile = { calorieGoal: 2000 };
const day = normalizeDay({ foodEntries: [{ id: 1, food_name: "Synthetic banana", meal_type: "Snack", local_time: "09:00:00", calories: 105 }], dailyTotals: { calories: 105 } });
const memory = () => {
  const saved = new Map();
  return { getItem: async key => saved.get(key) ?? null, setItem: async (key, value) => { saved.set(key, value); },
    removeItem: async key => { saved.delete(key); } };
};

test("a saved Today comes back per account, and a new day keeps only the goals", async () => {
  const cache = createTodayCache(memory());
  assert.equal(await cache.read("synthetic-a", date), null);
  await cache.write("synthetic-a", { date, day, profile });
  assert.deepEqual(await cache.read("synthetic-a", date), { date, day, profile });
  assert.equal(await cache.read("synthetic-b", date), null);
  assert.deepEqual(await cache.read("synthetic-a", "2026-11-02"), { date: "2026-11-02", day: null, profile });
  await cache.clear("synthetic-a");
  assert.equal(await cache.read("synthetic-a", date), null);
});

test("unreadable or failing storage reads as nothing saved", async () => {
  const garbled = memory();
  await garbled.setItem("calmera.today.v1.synthetic-a", "{not json");
  assert.equal(await createTodayCache(garbled).read("synthetic-a", date), null);
  const fail = async () => { throw Error("synthetic_storage_failure"); };
  const broken = createTodayCache({ getItem: fail, setItem: fail, removeItem: fail });
  assert.equal(await broken.read("synthetic-a", date), null);
  await broken.write("synthetic-a", { date });
  await broken.clear("synthetic-a");
});

test("a saved Today shows at once, but the network read still runs and replaces it", async () => {
  const store = createNutritionStore({ now: () => new Date(2026, 10, 1, 12).getTime() });
  store.hydrate({ date, day, profile });
  assert.equal(store.getSnapshot().days[date], day);
  assert.equal(store.getSnapshot().profile, profile);
  let reads = 0;
  await store.loadDay(date, async () => { reads++; return { foodEntries: [], dailyTotals: { calories: 0 } }; });
  await store.loadProfile(async () => { reads++; return { calorieGoal: 1800 }; });
  assert.equal(reads, 2);
  assert.equal(store.getSnapshot().days[date].entries.length, 0);
  assert.equal(store.getSnapshot().profile.calorieGoal, 1800);
});

test("a saved Today never replaces a read that landed first", async () => {
  const store = createNutritionStore();
  await store.loadDay(date, async () => ({ foodEntries: [], dailyTotals: { calories: 0 } }));
  await store.loadProfile(async () => ({ calorieGoal: 1800 }));
  store.hydrate({ date, day, profile });
  assert.equal(store.getSnapshot().days[date].entries.length, 0);
  assert.equal(store.getSnapshot().profile.calorieGoal, 1800);
});

test("disposing the store reports it once the account is gone, and ignores late saved data", async () => {
  let disposed = 0;
  const store = createNutritionStore({ onDispose: () => { disposed++; } });
  store.retain(); store.release();
  await Promise.resolve();
  assert.equal(disposed, 1);
  store.hydrate({ date, day, profile });
  assert.deepEqual(store.getSnapshot().days, {});
  assert.equal(store.getSnapshot().profile, null);
});
