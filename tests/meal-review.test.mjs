import test from "node:test";
import assert from "node:assert/strict";
import { createMealReview, updateReviewFood, reviewTotals, saveMealReview, setReviewField } from "../lib/mealReview.mjs";
import { createConfirmedMealSave } from "../lib/confirmedMealSave.mjs";
const food = { foodName: "Rice", quantity: "1 cup", mealType: "Lunch", calories: 200, protein: 4, carbs: 45, fat: 1 };
const time = "2026-10-21T12:00:00-04:00";
const draft = entries => createMealReview(entries, "owner-a", time);
const options = fetchImpl => ({ url: "https://test.invalid/meals", getToken: async () => "test-token", fetchImpl });

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
  const sent = [];
  await saveMealReview(renamedInline, "owner-a", options(async (_url, request) => {
    sent.push(JSON.parse(request.body));
    return new Response(JSON.stringify({ id: sent.length }), { status: 201, headers: { "Content-Type": "application/json" } });
  }));
  assert.deepEqual(sent.map((body) => body.ingredients), [ingredients, undefined, undefined]);
});

test("final save uses edits, removals, additions and chosen meal category, never original estimates", async () => {
  let review = draft([food, { ...food, foodName: "Remove me" }]);
  review = updateReviewFood(review, review.entries[0].id, { ...food, foodName: "Brown rice", quantity: "150 g", calories: "180", protein: "3.5", carbs: "39", fat: "1.5" });
  review = { ...review, entries: review.entries.slice(0, 1), mealType: "Dinner" };
  review = updateReviewFood(review, null, { ...food, foodName: "Broccoli", quantity: "100 g", calories: 35, carbs: 7, protein: 2.5, fat: 0.5 });
  const payloads = [];
  await saveMealReview(review, "owner-a", options(async (_, request) => {
    payloads.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ id: payloads.length }) };
  }));
  assert.deepEqual(payloads.map(entry => entry.foodName), ["Brown rice", "Broccoli"]);
  assert.equal(payloads[0].calories, 180);
  assert.equal(payloads[0].quantity, "150 g");
  assert.ok(payloads.every(entry => entry.mealType === "Dinner" && entry.createdAt === time && !('id' in entry)));
  assert.deepEqual(reviewTotals(review), { calories: 215, protein: 6, carbs: 46, fat: 2 });
});

test("invalid or empty reviews and a changed account never begin a write", () => {
  let calls = 0;
  const opt = options(async () => { calls++; });
  assert.throws(() => saveMealReview(draft([]), "owner-a", opt), /at least one/);
  assert.throws(() => saveMealReview(draft([food]), "owner-b", opt), /another session/);
  const review = draft([food, food]); review.entries[1].calories = "3,000";
  assert.throws(() => saveMealReview(review, "owner-a", opt), /Check calories/);
  assert.equal(calls, 0);
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
  review = updateReviewFood(review, null, food);
  assert.notEqual(review.entries[1].id, removed);
  assert.throws(() => updateReviewFood(draft(Array(20).fill(food)), null, food), /up to 20/);
});

test("a rapid duplicate save is coalesced and a confirmed save cannot be repeated", async () => {
  const guard = createConfirmedMealSave(); const review = draft([food]); let writes = 0;
  const request = { key: review.owner, persist: () => saveMealReview(review, review.owner, options(async () => {
    writes++; return { ok: true, json: async () => ({ id: 1 }) };
  })), exit: () => { throw Error("navigation failed"); } };
  const first = guard.run(request); const second = guard.run(request);
  assert.equal(first, second);
  assert.equal((await first).kind, "confirmed-staying");
  assert.equal((await guard.run(request)).kind, "already-confirmed");
  assert.equal(writes, 1);
});

test("partial-save uncertainty is retained and never automatically retried", async () => {
  let writes = 0;
  await assert.rejects(saveMealReview(draft([food, food]), "owner-a", options(async () => {
    writes++;
    if (writes === 1) return { ok: true, json: async () => ({ id: 1 }) };
    throw Error("connection lost");
  })), error => error.mayHaveSaved && error.savedEntries.length === 1);
  assert.equal(writes, 2);
});
