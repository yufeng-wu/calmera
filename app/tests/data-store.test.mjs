import test from "node:test";
import assert from "node:assert/strict";
import { createPhoneStore, DEFAULT_GOALS } from "../src/lib/store/phone.mjs";
import { createMemoryStorage } from "../src/lib/store/memoryStorage.mjs";
import { createNutritionStore, dataLoader } from "../src/lib/store/nutritionStore.mjs";

// The data module (lib/store) on the iPhone's app storage: every read and write the app
// makes for meals, goals and the profile, and what callers see when one can't happen.
const at = (iso) => () => new Date(iso).getTime();
const food = (change = {}) => ({ foodName: "Synthetic oats", quantity: "1 bowl", mealType: "Breakfast",
  calories: 300, protein: 10, carbs: 50, fat: 6, ...change });
function setup({ now = at("2026-11-08T15:00:00-05:00"), storage = createMemoryStorage() } = {}) {
  return { storage, data: createPhoneStore({ storage, now }) };
}
async function rejection(promise) {
  let failure;
  await promise.then(() => assert.fail("expected a rejection"), (error) => { failure = error; });
  return failure;
}
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const keys = (storage) => [...storage.data.keys()].sort();
// The person who started on Nov 1 with a goal change on Nov 5 and a few meals logged.
async function seeded() {
  const { storage, data } = setup({ now: at("2026-11-01T09:00:00-04:00") });
  await data.readProfile();
  await data.saveGoals({ calorieGoal: 2200, proteinGoal: 160, carbsGoal: 240, fatGoal: 70 }, { startDate: "2026-11-05" });
  await data.createMeals([food({ foodName: "Synthetic stew", mealType: "Dinner", calories: 520 })], { createdAt: "2026-11-03T19:30:00-05:00" });
  await data.createMeals([food()], { createdAt: "2026-11-03T08:10:00-05:00" });
  await data.createMeals([food({ foodName: "Synthetic salad", mealType: "Lunch", calories: 180.5 })], { createdAt: "2026-11-06T12:45:00-05:00" });
  return { storage, data };
}

test("the first read starts the profile today with the default goals", async () => {
  const { storage, data } = setup();
  assert.deepEqual(await data.readProfile(), { createdAtLocalDate: "2026-11-08", ...DEFAULT_GOALS });
  assert.deepEqual(await data.readGoals(), DEFAULT_GOALS);
  assert.deepEqual(keys(storage), ["calmera.data.v1.goals", "calmera.data.v1.profile"]);
  // A later launch keeps the same start date.
  const later = createPhoneStore({ storage, now: at("2026-12-01T09:00:00-05:00") });
  assert.equal((await later.readProfile()).createdAtLocalDate, "2026-11-08");
});

test("a reviewed meal saves one meal per food, filed under the day and time it was eaten", async () => {
  const { data } = setup();
  const createdAt = "2026-11-08T08:15:00-05:00";
  const saved = await data.createMeals([food(), food({ foodName: "Synthetic tea", quantity: "2", calories: 2,
    protein: 0, carbs: 0, fat: 0, ingredients: { vegetables: [], fruits: ["Lemon"] } })], { createdAt });
  assert.deepEqual(saved.map((meal) => [meal.id, meal.foodName, meal.localTime]),
    [[1, "Synthetic oats", "08:15:00"], [2, "Synthetic tea", "08:15:00"]]);
  assert.equal(saved[1].quantity, "2 counts", "a bare number is a count");
  assert.deepEqual(saved[1].ingredients, { vegetables: [], fruits: ["Lemon"] });
  const day = await data.readDay("2026-11-08");
  assert.deepEqual(day.foodEntries.map((meal) => meal.id), [1, 2]);
  assert.equal(day.dailyTotals.calories, 302);
  assert.equal(day.mealTotals.Breakfast.calories, 302);
  assert.deepEqual(day.goals, DEFAULT_GOALS);
});

test("a day comes with its meals in time order, its totals and the goals in effect that day", async () => {
  const { data } = await seeded();
  const before = await data.readDay("2026-11-03");
  assert.equal(before.date, "2026-11-03");
  assert.deepEqual(before.foodEntries.map((meal) => [meal.foodName, meal.localTime]),
    [["Synthetic oats", "08:10:00"], ["Synthetic stew", "19:30:00"]]);
  assert.equal(before.dailyTotals.calories, 820);
  assert.equal(before.mealTotals.Dinner.calories, 520);
  assert.equal(before.goals.calorieGoal, 2000, "goals that started later don't apply");
  assert.equal((await data.readDay("2026-11-06")).goals.calorieGoal, 2200);
  assert.deepEqual((await data.readDay("2026-11-04")).foodEntries, []);
});

test("every logged day is listed by date, and empty days aren't", async () => {
  const { data } = await seeded();
  const days = await data.readDays();
  assert.deepEqual(Object.keys(days).sort(), ["2026-11-03", "2026-11-06"]);
  assert.equal(days["2026-11-06"].foodEntries[0].foodName, "Synthetic salad");
  assert.equal(days["2026-11-06"].dailyTotals.calories, 180.5);
  assert.equal(days["2026-11-03"].goals.calorieGoal, 2000);
  assert.equal(days["2026-11-06"].goals.calorieGoal, 2200);
});

test("a single meal can be read, updated and deleted", async () => {
  const { data, storage } = await seeded();
  const [oats] = (await data.readDay("2026-11-03")).foodEntries;
  assert.equal((await data.readMeal(oats.id)).foodName, "Synthetic oats");
  assert.equal((await data.readMeal(String(oats.id))).foodName, "Synthetic oats", "route params are strings");

  const change = { foodName: " Synthetic porridge ", quantity: "2 bowls", calories: 420, protein: 12, carbs: 70, fat: 8, mealType: "Lunch" };
  assert.equal(await data.updateMeal(oats.id, { ...change, id: 999, localTime: "23:59:00" }), undefined);
  const updated = await data.readMeal(oats.id);
  assert.deepEqual([updated.id, updated.foodName, updated.quantity, updated.calories, updated.mealType, updated.localTime],
    [oats.id, "Synthetic porridge", "2 bowls", 420, "Lunch", "08:10:00"]);

  assert.deepEqual(await data.deleteMeal(oats.id), { deleted: true });
  assert.equal((await rejection(data.readMeal(oats.id))).code, "meal_not_found");
  assert.deepEqual((await data.readDay("2026-11-03")).foodEntries.map((meal) => meal.foodName), ["Synthetic stew"]);
  const [stew] = (await data.readDay("2026-11-03")).foodEntries;
  await data.deleteMeal(stew.id);
  assert.equal(storage.data.has("calmera.data.v1.day.2026-11-03"), false, "an emptied day is removed");
  assert.deepEqual(Object.keys(await data.readDays()), ["2026-11-06"]);
});

test("a renamed food loses the ingredients of the old one", async () => {
  const { data } = setup();
  const ingredients = { vegetables: ["Carrot"], fruits: [] };
  const [stew] = await data.createMeals([food({ foodName: "Stew", ingredients })], { createdAt: "2026-11-08T12:00:00-05:00" });
  await data.updateMeal(stew.id, { ...food({ foodName: "Stew", calories: 350 }) });
  assert.deepEqual((await data.readMeal(stew.id)).ingredients, ingredients);
  await data.updateMeal(stew.id, { ...food({ foodName: "Soup" }) });
  assert.equal((await data.readMeal(stew.id)).ingredients, undefined);
});

test("a missing meal can't be read, updated or deleted, and says nothing changed", async () => {
  const { data } = setup();
  assert.equal((await rejection(data.readMeal(404))).code, "meal_not_found");
  const update = await rejection(data.updateMeal(404, food()));
  assert.equal(update.code, "meal_not_found");
  assert.equal(update.mayHaveSaved, false);
  assert.match(update.message, /no longer in your log/);
  const removal = await rejection(data.deleteMeal(404));
  assert.equal(removal.code, "meal_delete_failed");
  assert.equal(removal.mayHaveDeleted, false);
});

test("goals start on their start date, and earlier days keep the goals they had", async () => {
  const { data } = await seeded();
  await data.saveGoals({ calorieGoal: 1800, proteinGoal: 120, carbsGoal: 180, fatGoal: 60, username: "not a goal" }, { startDate: "2026-11-08" });
  assert.deepEqual(await data.readGoals(), { calorieGoal: 1800, proteinGoal: 120, carbsGoal: 180, fatGoal: 60 });
  assert.equal((await data.readProfile()).calorieGoal, 1800);
  assert.equal((await data.readDay("2026-11-06")).goals.calorieGoal, 2200);
  assert.equal((await data.readDay("2026-11-08")).goals.calorieGoal, 1800);
  // Goals left out keep their latest value; the same start date is replaced, not added.
  await data.saveGoals({ calorieGoal: 1900 }, { startDate: "2026-11-08" });
  assert.deepEqual(await data.readGoals(), { calorieGoal: 1900, proteinGoal: 120, carbsGoal: 180, fatGoal: 60 });
});

test("invalid meals and goals are refused before anything is written", async () => {
  const { data, storage } = setup();
  await data.readProfile();
  const before = new Map(storage.data);
  assert.equal((await rejection(data.createMeals([], { createdAt: "2026-11-08T12:00:00-05:00" }))).message, "no_food_detected");
  assert.equal((await rejection(data.createMeals(Array(21).fill(food()), { createdAt: "2026-11-08T12:00:00-05:00" }))).message, "no_food_detected");
  await rejection(data.createMeals([food({ calories: -5 })], { createdAt: "2026-11-08T12:00:00-05:00" }));
  await rejection(data.createMeals([food()], { createdAt: "not a time" }));
  const invalid = await rejection(data.updateMeal(1, food({ foodName: " ", mealType: "Brunch" })));
  assert.equal(invalid.code, "meal_invalid");
  assert.match(invalid.message, /food name/);
  assert.match(invalid.message, /Meal type/);
  assert.equal((await rejection(data.saveGoals({ calorieGoal: -1 }, { startDate: "2026-11-08" }))).code, "goals_save_failed");
  assert.equal((await rejection(data.saveGoals({ calorieGoal: 1800 }, { startDate: "11/08/2026" }))).code, "goals_save_failed");
  assert.deepEqual(storage.data, before);
});

test("a cancelled or stale call never writes", async () => {
  const { data, storage } = setup();
  await data.readProfile();
  const before = new Map(storage.data);
  const controller = new AbortController();
  controller.abort();
  const read = await rejection(data.readDay("2026-11-08", { signal: controller.signal }));
  assert.equal(read.name, "AbortError");
  const save = await rejection(data.createMeals([food()], { createdAt: "2026-11-08T12:00:00-05:00", isActive: () => false }));
  assert.equal(save.message, "meal_save_failed");
  assert.equal(save.cancelled, true);
  assert.equal(save.mayHaveSaved, false);
  assert.equal((await rejection(data.deleteMeal(1, { signal: controller.signal }))).code, "meal_delete_cancelled");
  assert.equal((await rejection(data.saveGoals({ calorieGoal: 1 }, { startDate: "2026-11-08", isActive: () => false }))).code, "goals_save_cancelled");
  // A review that stops being current while the save waits its turn doesn't write either.
  const gate = deferred();
  let current = true;
  const busy = data.readDays().then(() => gate.promise);
  const late = data.createMeals([food()], { createdAt: "2026-11-08T12:00:00-05:00", isActive: () => current });
  current = false;
  gate.resolve();
  await busy;
  assert.equal((await rejection(late)).cancelled, true);
  assert.deepEqual(storage.data, before);
});

test("saves made at the same moment never overwrite each other", async () => {
  const { data } = setup({ storage: createMemoryStorage({}, { delayMs: 1 }) });
  const saves = Array.from({ length: 8 }, (_, index) =>
    data.createMeals([food({ foodName: `Synthetic snack ${index}`, mealType: "Snack" })], { createdAt: "2026-11-08T15:00:00-05:00" }));
  const ids = (await Promise.all(saves)).flat().map((meal) => meal.id);
  assert.equal(new Set(ids).size, 8);
  assert.equal((await data.readDay("2026-11-08")).foodEntries.length, 8);
});

test("ids stay unique after deletes and across launches, even if the index is lost", async () => {
  const { storage, data } = setup();
  const [first, second] = await data.createMeals([food(), food()], { createdAt: "2026-11-08T08:00:00-05:00" });
  await data.deleteMeal(second.id);
  const relaunched = createPhoneStore({ storage, now: at("2026-11-09T09:00:00-05:00") });
  const [third] = await relaunched.createMeals([food()], { createdAt: "2026-11-09T08:00:00-05:00" });
  assert.equal(third.id, 3);
  storage.data.delete("calmera.data.v1.meta");
  const rebuilt = createPhoneStore({ storage });
  assert.equal((await rebuilt.readMeal(first.id)).id, first.id);
  const [fourth] = await rebuilt.createMeals([food()], { createdAt: "2026-11-09T12:00:00-05:00" });
  assert.equal(fourth.id, 4);
  await rebuilt.updateMeal(third.id, food({ foodName: "Synthetic rice" }));
  assert.equal((await rebuilt.readMeal(third.id)).foodName, "Synthetic rice");
});

test("a failed write says nothing was saved, and the next one works", async () => {
  const { data } = setup({ storage: createMemoryStorage({}, { failWrites: 2 }) });
  // The first read writes the profile; that write fails and the read reports it.
  await rejection(data.readProfile());
  const save = await rejection(data.createMeals([food()], { createdAt: "2026-11-08T12:00:00-05:00" }));
  assert.equal(save.mayHaveSaved, false);
  const [meal] = await data.createMeals([food()], { createdAt: "2026-11-08T12:00:00-05:00" });
  assert.equal(meal.id, 1);
  assert.equal((await data.readDay("2026-11-08")).foodEntries.length, 1);
});

test("erasing removes every meal, goal and the profile, and the next read starts over", async () => {
  const { storage, data } = await seeded();
  storage.data.set("calmera.theme.v1:local", "grove");
  assert.ok((await data.eraseAll()).erased >= 4);
  assert.deepEqual(keys(storage), ["calmera.theme.v1:local"], "other settings are left to Erase all data's own sweep");
  // Opening calmera again starts a new profile from that day.
  const restarted = createPhoneStore({ storage, now: at("2026-11-10T09:00:00-05:00") });
  assert.deepEqual(await restarted.readProfile(), { createdAtLocalDate: "2026-11-10", ...DEFAULT_GOALS });
  assert.deepEqual(await restarted.readDays(), {});
  // The store that erased forgets what it held in memory too.
  assert.equal((await rejection(data.readMeal(1))).code, "meal_not_found");
  assert.deepEqual(await data.readProfile(), { createdAtLocalDate: "2026-11-10", ...DEFAULT_GOALS });
});

test("the shared in-memory store loads a day, history and the profile through the data module", async () => {
  const { data } = await seeded();
  const store = createNutritionStore({ ownerKey: "local" });
  const loader = dataLoader(data, () => store.belongsTo("local"));
  await Promise.all([store.loadDay("2026-11-06", loader), store.loadProfile(loader)]);
  await store.loadHistory(loader, { force: true });
  const { days, profile, historyLoaded } = store.getSnapshot();
  assert.equal(historyLoaded, true);
  assert.equal(days["2026-11-06"].entries[0].foodName, "Synthetic salad");
  assert.deepEqual(days["2026-11-03"].entries.map((meal) => meal.foodName), ["Synthetic oats", "Synthetic stew"]);
  assert.equal(profile.calorieGoal, 2200);
  assert.equal(profile.createdAtLocalDate, "2026-11-01");
  store.dispose();
});
