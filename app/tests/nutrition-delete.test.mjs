import test from "node:test";
import assert from "node:assert/strict";
import { removeStoredNutritionEntry } from "../src/lib/nutritionDelete.mjs";
import { createNutritionStore, dataLoader } from "../src/lib/nutritionStore.mjs";
import { createPhoneStore } from "../src/lib/store/phone.mjs";
import { createMemoryStorage } from "../src/lib/store/memoryStorage.mjs";

// Deleting from Today or the editor: the meal leaves the shared store at once, comes back
// if the delete fails, and only the still-current owner hears about the outcome.
const ownerKey = "synthetic-delete-owner", dateKey = "2026-10-20";
const rows = [
  { id: 1, foodName: "Synthetic banana", mealType: "Breakfast", localTime: "09:00:00", calories: 100 },
  { id: 2, foodName: "Synthetic toast", mealType: "Lunch", localTime: "12:00:00", calories: 200 },
];
const rawDay = entries => ({ foodEntries: entries, dailyTotals: { calories: entries.reduce((sum, row) => sum + row.calories, 0) } });
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
async function seededStore(t) {
  const store = createNutritionStore({ ownerKey });
  t.after(() => store.dispose());
  await store.loadDay(dateKey, async () => rawDay(rows));
  return store;
}
const ids = store => store.getSnapshot().days[dateKey]?.entries.map(row => row.id);
const failed = () => Object.assign(new Error("meal_delete_failed"), { code: "meal_delete_failed", mayHaveDeleted: false });

test("a confirmed delete settles bookkeeping before the owner's refresh", async t => {
  const store = await seededStore(t); const reply = deferred(); let refresh; let reads = 0; let callbacks = 0;
  const calls = [];
  const pending = removeStoredNutritionEntry({ store, ownerKey, dateKey, id: 1,
    deleteMeal: options => { calls.push(options); return reply.promise; }, onSettled: () => {
      callbacks++; assert.deepEqual(ids(store), [2]);
      refresh = store.loadDay(dateKey, async () => { reads++; return rawDay([rows[1]]); }, { force: true });
    },
  });
  assert.deepEqual(ids(store), [2], "the row leaves at once");
  assert.equal(store.getSnapshot().days[dateKey].summary.dailyTotals.calories, 200);
  reply.resolve({ deleted: true }); assert.equal(await pending, true); await refresh;
  assert.equal(callbacks, 1); assert.equal(reads, 1);
  assert.deepEqual(ids(store), [2]);
  assert.equal(typeof calls[0].isActive, "function", "the delete can tell when its owner is gone");
});

test("a failed delete puts the meal back first, then tells the owner", async t => {
  const store = await seededStore(t); let callbacks = 0;
  let failure;
  await removeStoredNutritionEntry({ store, ownerKey, dateKey, id: 1, deleteMeal: async () => { throw failed(); },
    onSettled: () => { callbacks++; assert.deepEqual(ids(store), [1, 2]); } }).catch(error => { failure = error; });
  assert.equal(failure.code, "meal_delete_failed");
  assert.equal(callbacks, 1);
  assert.deepEqual(ids(store), [1, 2]);
  assert.equal(store.getSnapshot().days[dateKey].summary.dailyTotals.calories, 300);
});

test("a pending delete keeps a refresh from bringing the meal back early", async t => {
  const store = await seededStore(t); const reply = deferred(); let reads = 0;
  const pending = removeStoredNutritionEntry({ store, ownerKey, dateKey, id: 1, deleteMeal: () => reply.promise });
  await store.loadDay(dateKey, async () => { reads++; return rawDay(rows); }, { force: true });
  assert.equal(reads, 0, "pending optimistic removal blocks premature replacement");
  assert.deepEqual(ids(store), [2]);
  reply.resolve({ deleted: true }); await pending;
});

test("removing a row that's already hidden doesn't delete twice", async t => {
  const store = await seededStore(t); const reply = deferred(); let calls = 0; let callbacks = 0;
  const args = { store, ownerKey, dateKey, id: 1, deleteMeal: () => { calls++; return reply.promise; }, onSettled: () => { callbacks++; } };
  const first = removeStoredNutritionEntry(args);
  assert.equal(await removeStoredNutritionEntry(args), false);
  reply.resolve({ deleted: true }); assert.equal(await first, true);
  assert.equal(calls, 1); assert.equal(callbacks, 1);
});

test("an inactive or different owner can't even remove optimistically", async t => {
  const store = await seededStore(t);
  for (const extra of [{ ownerKey: "synthetic-other-owner" }, { isActive: () => false }]) {
    assert.equal(await removeStoredNutritionEntry({ store, ownerKey, dateKey, id: 1, ...extra,
      deleteMeal: () => assert.fail("an inactive owner cannot delete"),
      onSettled: () => assert.fail("an inactive owner cannot refresh"),
    }), false);
    assert.deepEqual(ids(store), [1, 2]);
  }
});

test("a delete that finishes after its owner left can't touch the new owner's screen", async t => {
  const store = await seededStore(t); const reply = deferred(); let active = true; let callbacks = 0;
  const pending = removeStoredNutritionEntry({ store, ownerKey, dateKey, id: 1, isActive: () => active,
    deleteMeal: () => reply.promise, onSettled: () => { callbacks++; } });
  active = false; reply.resolve({ deleted: true });
  assert.equal(await pending, false); assert.equal(callbacks, 0); assert.deepEqual(ids(store), [1, 2]);
});

test("disposing the store while a delete runs drops its outcome", async t => {
  const store = await seededStore(t); const reply = deferred(); let callbacks = 0;
  const pending = removeStoredNutritionEntry({ store, ownerKey, dateKey, id: 1, deleteMeal: () => reply.promise,
    onSettled: () => { callbacks++; } });
  store.dispose(); reply.reject(failed());
  assert.equal(await pending, false); assert.equal(callbacks, 0);
  assert.deepEqual(store.getSnapshot().days, {});
});

test("deleting through the data module removes the saved meal and the refreshed day agrees", async t => {
  const data = createPhoneStore({ storage: createMemoryStorage(), now: () => new Date("2026-10-20T12:00:00-04:00").getTime() });
  const [banana] = await data.createMeals([{ foodName: "Synthetic banana", quantity: "1 medium", mealType: "Breakfast",
    calories: 100, protein: 1, carbs: 27, fat: 0 }], { createdAt: "2026-10-20T09:00:00-04:00" });
  const store = createNutritionStore({ ownerKey });
  t.after(() => store.dispose());
  const loader = dataLoader(data, () => store.belongsTo(ownerKey));
  await store.loadDay(dateKey, loader);
  let refresh;
  assert.equal(await removeStoredNutritionEntry({ store, ownerKey, dateKey, id: banana.id,
    deleteMeal: options => data.deleteMeal(banana.id, options),
    onSettled: () => { refresh = store.loadDay(dateKey, loader, { force: true }); } }), true);
  await refresh;
  assert.deepEqual(ids(store), []);
  assert.equal((await data.readDay(dateKey)).foodEntries.length, 0);
});
