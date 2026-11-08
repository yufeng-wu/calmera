import test from "node:test";
import assert from "node:assert/strict";
import { mealSaveErrorPresentation } from "../lib/chatgpt/saveErrorPresentation.mjs";
import { createPhoneStore } from "../lib/store/phone.mjs";
import { createMemoryStorage } from "../lib/store/memoryStorage.mjs";

const meal = { foodName: "Synthetic banana", quantity: "1 banana", mealType: "Snack", calories: 105, protein: 1, carbs: 27, fat: 0 };
const createdAt = "2026-10-18T12:00:00-04:00";
async function failureOf(promise) {
  let failure;
  await promise.catch(error => { failure = error; });
  assert.ok(failure, "the synthetic save must fail");
  return failure;
}

test("a save the phone couldn't write presents a failed save, not a maybe-saved one", async () => {
  const data = createPhoneStore({ storage: createMemoryStorage({}, { failWrites: true }) });
  const error = await failureOf(data.createMeals([meal], { createdAt }));
  assert.equal(error.mayHaveSaved, false);
  const presentation = mealSaveErrorPresentation(error);
  assert.equal(presentation.kind, "failed");
  assert.equal(presentation.title, "Couldn’t save meal");
  assert.doesNotMatch(presentation.message, /Check your meals|may already/i);
});

test("a stale save that stopped before writing presents a failed save", async () => {
  const data = createPhoneStore({ storage: createMemoryStorage() });
  const error = await failureOf(data.createMeals([meal], { createdAt, isActive: () => false }));
  assert.equal(error.cancelled, true);
  assert.equal(mealSaveErrorPresentation(error).kind, "failed");
});

test("legacy meal-save errors without outcome metadata remain conservative", () => {
  for (const code of ["meal_save_failed", "meal_save_uncertain", "meal_save_timeout"]) {
    assert.equal(mealSaveErrorPresentation(Error(code)).kind, "uncertain");
  }
});

test("positive and partial write evidence overrides conflicting non-write flags", () => {
  const conflicts = [
    { savedEntries: [{ id: 1 }], mayHaveSaved: false },
    { mayHaveSaved: true, dispatched: false },
    { uncertain: true, mayHaveSaved: false },
  ];
  for (const metadata of conflicts) {
    assert.equal(mealSaveErrorPresentation(Object.assign(Error("meal_save_failed"), metadata)).kind, "uncertain");
  }
  assert.equal(mealSaveErrorPresentation(Object.assign(Error("meal_save_uncertain"), { mayHaveSaved: false })).kind, "uncertain");
});

test("an explicitly undispatched legacy request can be described as a failed save", () => {
  assert.equal(mealSaveErrorPresentation(Object.assign(Error("meal_save_failed"), { dispatched: false })).kind, "failed");
});

test("auth and usage errors remain available to the existing inferenceError branches", () => {
  for (const code of ["chatgpt_sign_in_required", "token_refresh_failed", "http_401", "plan_usage_unavailable", "http_429", "voice_unavailable"]) {
    assert.equal(mealSaveErrorPresentation(Error(code)), null);
  }
});
