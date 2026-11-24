import test from "node:test";
import assert from "node:assert/strict";
import { addReviewFood, createMealReview, updateReviewFood, reviewTotals, saveMealReview, setReviewField } from "../lib/mealReview.mjs";
import { createConfirmedMealSave } from "../lib/confirmedMealSave.mjs";
import { createPhoneStore } from "../lib/store/phone.mjs";
import { createMemoryStorage } from "../lib/store/memoryStorage.mjs";
const food = { foodName: "Rice", quantity: "1 cup", mealType: "Lunch", calories: 200, protein: 4, carbs: 45, fat: 1 };
const time = "2026-10-21T12:00:00-04:00";
const draft = entries => createMealReview(entries, "owner-a", time);
// Saves go through the data module, kept here in synthetic storage.
const store = (options) => createPhoneStore({ storage: createMemoryStorage({}, options) });
const savedMeals = async data => Object.values(await data.readDays()).flatMap(day => day.foodEntries);

test("analysis creates a separate local draft and does not mutate model results", () => {
  const original = { ...food, image: "private-image", access_token: "private-token" };
  const review = draft([original, food]);
  assert.notEqual(review.entries[0].id, review.entries[1].id);
  assert.equal(review.entries[0].image, undefined);
  assert.equal(review.entries[0].access_token, undefined);
  review.entries[0].foodName = "Edited";
  assert.equal(original.foodName, "Rice");
});

test("vegetables and fruits reach the save, unless the food was renamed", async () => {
  const ingredients = { vegetables: ["Carrot"], fruits: [] };
  const review = draft([{ ...food, ingredients }, { ...food, foodName: "Stew", ingredients }, { ...food, foodName: "Soup", ingredients }]);
  assert.deepEqual(review.entries[0].ingredients, ingredients);
  const keptName = updateReviewFood(review, "meal-food-0", { ...food, calories: 300 });
  assert.deepEqual(keptName.entries[0].ingredients, ingredients);
  const renamedInForm = updateReviewFood(keptName, "meal-food-1", { ...food, foodName: "Steak" });
  const renamedInline = setReviewField(renamedInForm, "meal-food-2", "foodName", "Toast");
  assert.deepEqual(setReviewField(renamedInline, "meal-food-0", "calories", "310").entries[0].ingredients, ingredients);
  const data = store();
  await saveMealReview(renamedInline, "owner-a", data);
  assert.deepEqual((await savedMeals(data)).map((meal) => meal.ingredients), [ingredients, undefined, undefined]);
});

test("final save uses edits, removals, additions and chosen meal category, never original estimates", async () => {
  let review = draft([food, { ...food, foodName: "Remove me" }]);
  review = updateReviewFood(review, review.entries[0].id, { ...food, foodName: "Brown rice", quantity: "150 g", calories: "180", protein: "3.5", carbs: "39", fat: "1.5" });
  review = { ...review, entries: review.entries.slice(0, 1), mealType: "Dinner" };
  review = addReviewFood(review);
  review = updateReviewFood(review, review.entries.at(-1).id, { ...food, foodName: "Broccoli", quantity: "100 g", calories: 35, carbs: 7, protein: 2.5, fat: 0.5 });
  const data = store();
  const saved = await saveMealReview(review, "owner-a", data);
  const meals = await savedMeals(data);
  assert.deepEqual(meals.map(entry => entry.foodName), ["Brown rice", "Broccoli"]);
  assert.equal(meals[0].calories, 180);
  assert.equal(meals[0].quantity, "150 g");
  // Saved under the time the meal was analyzed, with ids from the data module, not the review's.
  assert.ok(meals.every(entry => entry.mealType === "Dinner" && entry.localTime === "12:00:00" && Number.isInteger(entry.id)));
  assert.deepEqual(saved.map(entry => entry.id), meals.map(entry => entry.id));
  assert.deepEqual(reviewTotals(review), { calories: 215, protein: 6, carbs: 46, fat: 2 });
});

test("a newly added item must receive an estimate before the journal can save it", async () => {
  const data = store();
  const review = addReviewFood(draft([food]));
  const added = review.entries.at(-1);
  Object.assign(added, food);
  assert.throws(() => saveMealReview(review, "owner-a", data), /Estimate nutrition/);
  const estimated = updateReviewFood(review, added.id, food);
  const corrected = setReviewField(estimated, added.id, "calories", "240");
  await saveMealReview(corrected, "owner-a", data);
  assert.equal((await savedMeals(data))[1].calories, 240);
});

test("invalid or empty reviews and a changed owner never begin a write", async () => {
  const opt = store();
  assert.throws(() => saveMealReview(draft([]), "owner-a", opt), /at least one/);
  assert.throws(() => saveMealReview(draft([food]), "owner-b", opt), /another session/);
  const review = draft([food, food]); review.entries[1].calories = "3,000";
  assert.throws(() => saveMealReview(review, "owner-a", opt), /Check calories/);
  assert.deepEqual(await savedMeals(opt), []);
});

test("food validation rejects unsupported amounts, negative macros and excessive values", () => {
  const review = draft([food]);
  for (const change of [{ foodName: " " }, { quantity: "0 g" }, { quantity: "--" }, { calories: "" }, { fat: "-1" }, { calories: 20001 }]) {
    assert.throws(() => updateReviewFood(review, review.entries[0].id, { ...food, ...change }));
  }
  const words = updateReviewFood(review, review.entries[0].id, { ...food, quantity: "a bowl" });
  assert.equal(words.entries[0].quantity, "a bowl");
});

test("IDs survive removals and never collide with later additions", () => {
  let review = draft([food, food]); const removed = review.entries[1].id;
  review = { ...review, entries: review.entries.slice(0, 1) };
  review = addReviewFood(review);
  assert.notEqual(review.entries[1].id, removed);
  assert.throws(() => addReviewFood(draft(Array(20).fill(food))), /up to 20/);
});

test("a rapid duplicate save is coalesced and a confirmed save cannot be repeated", async () => {
  const guard = createConfirmedMealSave(); const review = draft([food]); const data = store();
  const request = { key: review.owner, persist: () => saveMealReview(review, review.owner, data),
    exit: () => { throw Error("navigation failed"); } };
  const first = guard.run(request); const second = guard.run(request);
  assert.equal(first, second);
  assert.equal((await first).kind, "confirmed-staying");
  assert.equal((await guard.run(request)).kind, "already-confirmed");
  assert.equal((await savedMeals(data)).length, 1);
});

test("a meal saves whole or not at all, and a failed save can be tried again", async () => {
  const data = store({ failWrites: 1 });
  const review = draft([food, { ...food, foodName: "Miso soup" }]);
  await assert.rejects(saveMealReview(review, "owner-a", data), error => error.message === "meal_save_failed" && error.mayHaveSaved === false
    && error.savedEntries.length === 0);
  assert.deepEqual(await savedMeals(data), []);
  assert.deepEqual((await saveMealReview(review, "owner-a", data)).map(entry => entry.foodName), ["Rice", "Miso soup"]);
});
