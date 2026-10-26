import test from "node:test";
import assert from "node:assert/strict";
import { editorNumber, mealEditorChanged, mealEditorValues, storedMealDateKey, storedMealForEditor } from "../lib/mealEditorDraft.mjs";
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

test("the editor finds the day a stored meal is filed under, for this account only", async () => {
  const store = createNutritionStore({ ownerKey: owner });
  await store.loadDay(day, async () => ({ foodEntries: [entry] }));
  assert.equal(storedMealDateKey(store, owner, "42"), day);
  assert.equal(storedMealDateKey(store, "other-owner", 42), null);
  assert.equal(storedMealDateKey(store, owner, 43), null);
});

test("fixed-point API decimals show only the digits that carry value", () => {
  assert.equal(editorNumber("450.00"), "450");
  assert.equal(editorNumber("42.50"), "42.5");
  assert.equal(editorNumber("0.00"), "0");
  assert.equal(editorNumber(23), "23");
  assert.equal(editorNumber(null), "");
  assert.equal(editorNumber(""), "");
  assert.deepEqual(mealEditorValues({ food_name: "Stew", calories: "450.00", protein: "42.00", carbs: "18.25", fat: 23 }),
    { foodName: "Stew", quantity: "", calories: "450", protein: "42", carbs: "18.25", fat: "23", mealType: "Breakfast" });
});

test("the editor counts a draft as changed only when a value really differs", () => {
  const base = { foodName: "Stew", quantity: "1 bowl", mealType: "Dinner", calories: "450", protein: "42", carbs: "18", fat: "23" };
  assert.equal(mealEditorChanged(base, { ...base }), false);
  assert.equal(mealEditorChanged(base, { ...base, foodName: " Stew ", calories: "450.0" }), false);
  assert.equal(mealEditorChanged(base, { ...base, mealType: "Lunch" }), true);
  assert.equal(mealEditorChanged(base, { ...base, fat: "24" }), true);
  assert.equal(mealEditorChanged(base, { ...base, protein: "" }), true);
  assert.equal(mealEditorChanged(null, base), false);
});
