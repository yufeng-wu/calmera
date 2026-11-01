import test from "node:test";
import assert from "node:assert/strict";
import { saveEstimatedEntries } from "../lib/chatgpt/entryPersistence.mjs";
import { mealSaveErrorPresentation } from "../lib/chatgpt/saveErrorPresentation.mjs";

const meal = { foodName: "Synthetic banana", quantity: "1 banana", mealType: "Snack", calories: 105, protein: 1, carbs: 27, fat: 0 };
const options = { createdAt: "2026-10-18T12:00:00-04:00", getToken: async () => "synthetic-token", url: "https://calmera.invalid/food-entries" };
async function failureOf(promise) {
  let failure;
  await promise.catch(error => { failure = error; });
  assert.ok(failure, "the synthetic save must fail");
  return failure;
}

test("known HTTP rejection presents a failed save without claiming an uncertain write or retrying", async () => {
  let calls = 0;
  const error = await failureOf(saveEstimatedEntries([meal], { ...options, fetchImpl: async () => {
    calls++;
    return { ok: false, status: 400, json: async () => ({ error: "Synthetic validation failure" }) };
  } }));
  assert.equal(error.mayHaveSaved, false);
  const presentation = mealSaveErrorPresentation(error);
  assert.equal(presentation.kind, "failed");
  assert.equal(presentation.title, "Couldn’t save meal");
  assert.doesNotMatch(presentation.message, /Check your meals|may already/i);
  assert.equal(calls, 1);
});

test("pre-dispatch timeout presents a known non-write and never reaches fetch", async () => {
  let calls = 0;
  const error = await failureOf(saveEstimatedEntries([meal], { ...options, timeoutMs: 10,
    getToken: () => new Promise(() => {}), fetchImpl: async () => { calls++; } }));
  assert.equal(error.dispatched, false);
  assert.equal(error.timedOut, true);
  const presentation = mealSaveErrorPresentation(error);
  assert.equal(presentation.kind, "failed");
  assert.match(presentation.message, /took too long/);
  assert.equal(calls, 0);
});

test("server uncertainty presents Check your meals and never retries automatically", async () => {
  let calls = 0;
  const error = await failureOf(saveEstimatedEntries([meal], { ...options, fetchImpl: async () => {
    calls++;
    return { ok: false, status: 503, json: async () => null };
  } }));
  assert.equal(mealSaveErrorPresentation(error).kind, "uncertain");
  assert.equal(mealSaveErrorPresentation(error).title, "Check your meals");
  assert.equal(calls, 1);
});

test("a dropped POST response stays uncertain instead of suggesting a known non-write", async () => {
  let calls = 0;
  const error = await failureOf(saveEstimatedEntries([meal], { ...options, fetchImpl: async () => {
    calls++;
    throw Error("Synthetic dropped connection");
  } }));
  assert.equal(mealSaveErrorPresentation(error).kind, "uncertain");
  assert.equal(calls, 1);
});

test("partial success followed by a known rejection still requires checking meals", async () => {
  let calls = 0;
  const error = await failureOf(saveEstimatedEntries([meal, meal], { ...options, fetchImpl: async () => {
    calls++;
    return calls === 1 ? { ok: true, json: async () => ({ id: 1 }) }
      : { ok: false, status: 400, json: async () => null };
  } }));
  assert.equal(error.savedEntries.length, 1);
  assert.equal(mealSaveErrorPresentation(error).kind, "uncertain");
  assert.equal(calls, 2);
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

test("auth and usage errors remain available to the existing inferenceError branches", async () => {
  for (const code of ["chatgpt_sign_in_required", "token_refresh_failed", "http_401", "plan_usage_unavailable", "http_429", "voice_unavailable"]) {
    assert.equal(mealSaveErrorPresentation(Error(code)), null);
  }
  const error = await failureOf(saveEstimatedEntries([meal], { ...options, getToken: async () => null,
    fetchImpl: () => assert.fail("missing auth cannot dispatch") }));
  assert.equal(mealSaveErrorPresentation(error), null);
  assert.match(error.message, /sign_in/);
});
