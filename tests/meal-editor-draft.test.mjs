import test from "node:test";
import assert from "node:assert/strict";
import { mealEditorValues, storedMealForEditor } from "../lib/mealEditorDraft.mjs";
import { createNutritionStore } from "../lib/nutritionStore.mjs";

const owner = "meal-editor-test-owner";
const day = "2026-10-20";
const entry = { id: 42, food_name: "Toast", quantity: "2 slices", meal_type: "Lunch",
  calories: 180, protein: 5, carbs: 33, fat: 0 };
const draft = { foodName: "Toast", quantity: "2 slices", mealType: "Lunch",
  calories: "180", protein: "5", carbs: "33", fat: "0" };

test("Today and History meals open with the same complete draft including zero values", async () => {
  const todayStore = createNutritionStore({ ownerKey: owner });
  await todayStore.loadDay(day, async () => ({ foodEntries: [{ id: 42, ...draft, calories: 180, fat: 0 }] }));
  const historyStore = createNutritionStore({ ownerKey: owner });
  await historyStore.loadHistory(async () => ({ [day]: { foodEntries: [entry] } }));
  assert.deepEqual(mealEditorValues(storedMealForEditor(todayStore, owner, "42")), draft);
  assert.deepEqual(mealEditorValues(storedMealForEditor(historyStore, owner, "42")), draft);
  assert.deepEqual(mealEditorValues(entry), draft);
});

test("editor seed is scoped to its active account and never reuses disposed data", async () => {
  const store = createNutritionStore({ ownerKey: owner });
  await store.loadDay(day, async () => ({ foodEntries: [entry] }));
  assert.equal(storedMealForEditor(store, "other-owner", 42), null);
  assert.equal(storedMealForEditor(store, null, 42), null);
  assert.equal(storedMealForEditor(store, owner, undefined), null);
  store.dispose();
  assert.equal(storedMealForEditor(store, owner, 42), null);
});

test("removed and unknown meals fall back to an explicit editor load", async () => {
  const store = createNutritionStore({ ownerKey: owner });
  await store.loadDay(day, async () => ({ foodEntries: [entry] }));
  assert.equal(storedMealForEditor(store, owner, 43), null);
  store.removeOptimistically(day, 42);
  assert.equal(storedMealForEditor(store, owner, 42), null);
});

test("the form draft is detached from cached entry values", async () => {
  const store = createNutritionStore({ ownerKey: owner });
  await store.loadDay(day, async () => ({ foodEntries: [entry] }));
  const cached = storedMealForEditor(store, owner, 42);
  const editing = mealEditorValues(cached);
  editing.foodName = "Changed draft";
  editing.calories = "250";
  assert.equal(cached.foodName, "Toast");
  assert.equal(cached.calories, 180);
});
