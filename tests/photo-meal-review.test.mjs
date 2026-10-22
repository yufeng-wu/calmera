import test from "node:test";
import assert from "node:assert/strict";
import { createPhotoMealReview, updatePhotoReviewFood, photoReviewTotals, savePhotoMealReview } from "../lib/photoMealReview.mjs";
import { createConfirmedMealSave } from "../lib/confirmedMealSave.mjs";
const food = { foodName: "Rice", quantity: "1 cup", mealType: "Lunch", calories: 200, protein: 4, carbs: 45, fat: 1 };
const time = "2026-10-21T12:00:00-04:00";
const draft = entries => createPhotoMealReview(entries, "owner-a", time);
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

test("final save uses edits, removals, additions and chosen meal category, never original estimates", async () => {
  let review = draft([food, { ...food, foodName: "Remove me" }]);
  review = updatePhotoReviewFood(review, review.entries[0].id, { ...food, foodName: "Brown rice", quantity: "150 g", calories: "180", protein: "3.5", carbs: "39", fat: "1.5" });
  review = { ...review, entries: review.entries.slice(0, 1), mealType: "Dinner" };
  review = updatePhotoReviewFood(review, null, { ...food, foodName: "Broccoli", quantity: "100 g", calories: 35, carbs: 7, protein: 2.5, fat: 0.5 });
  const payloads = [];
  await savePhotoMealReview(review, "owner-a", options(async (_, request) => {
    payloads.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ id: payloads.length }) };
  }));
  assert.deepEqual(payloads.map(entry => entry.foodName), ["Brown rice", "Broccoli"]);
  assert.equal(payloads[0].calories, 180);
  assert.equal(payloads[0].quantity, "150 g");
  assert.ok(payloads.every(entry => entry.mealType === "Dinner" && entry.createdAt === time && !('id' in entry)));
  assert.deepEqual(photoReviewTotals(review), { calories: 215, protein: 6, carbs: 46, fat: 2 });
});

test("invalid or empty reviews and a changed account never begin a write", () => {
  let calls = 0;
  const opt = options(async () => { calls++; });
  assert.throws(() => savePhotoMealReview(draft([]), "owner-a", opt), /at least one/);
  assert.throws(() => savePhotoMealReview(draft([food]), "owner-b", opt), /another session/);
  const review = draft([food, food]); review.entries[1].calories = "3,000";
  assert.throws(() => savePhotoMealReview(review, "owner-a", opt), /Check calories/);
  assert.equal(calls, 0);
});

test("food validation rejects unsupported amounts, negative macros and excessive values", () => {
  const review = draft([food]);
  for (const change of [{ foodName: " " }, { quantity: "0 g" }, { quantity: "unknown" }, { calories: "" }, { fat: "-1" }, { calories: 20001 }]) {
    assert.throws(() => updatePhotoReviewFood(review, review.entries[0].id, { ...food, ...change }));
  }
});

test("IDs survive removals and never collide with later additions", () => {
  let review = draft([food, food]); const removed = review.entries[1].id;
  review = { ...review, entries: review.entries.slice(0, 1) };
  review = updatePhotoReviewFood(review, null, food);
  assert.notEqual(review.entries[1].id, removed);
  assert.throws(() => updatePhotoReviewFood(draft(Array(20).fill(food)), null, food), /up to 20/);
});

test("a rapid duplicate save is coalesced and a confirmed save cannot be repeated", async () => {
  const guard = createConfirmedMealSave(); const review = draft([food]); let writes = 0;
  const request = { key: review.owner, persist: () => savePhotoMealReview(review, review.owner, options(async () => {
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
  await assert.rejects(savePhotoMealReview(draft([food, food]), "owner-a", options(async () => {
    writes++;
    if (writes === 1) return { ok: true, json: async () => ({ id: 1 }) };
    throw Error("connection lost");
  })), error => error.mayHaveSaved && error.savedEntries.length === 1);
  assert.equal(writes, 2);
});
