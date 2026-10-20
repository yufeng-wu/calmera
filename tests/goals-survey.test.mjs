import test from "node:test";
import assert from "node:assert/strict";
import { surveyBmr, surveyGoals, surveyPickerCommit, surveyInputSignature } from "../lib/goalsSurvey.mjs";

const canonical = Object.freeze({ weightKg: 70, heightCm: 175, age: 30, sex: "female", bodyFat: null,
  workActivity: "moderate", exerciseActivity: "moderate", goal: "maintain" });

test("switching displayed kg/lbs leaves canonical-weight goals and BMR unchanged", () => {
  const kgView = { ...canonical, weightUnit: "kg" };
  const lbView = { ...canonical, weightUnit: "lbs" };
  assert.deepEqual(surveyGoals(kgView), { calorieGoal: 2298, proteinGoal: 140, carbsGoal: 309, fatGoal: 56 });
  assert.deepEqual(surveyGoals(lbView), surveyGoals(kgView));
  assert.equal(surveyBmr(lbView), surveyBmr(kgView));
});

test("body-fat formula and displayed BMR use the same canonical lean mass in either unit", () => {
  const kgView = { ...canonical, bodyFat: 20, weightUnit: "kg" };
  const lbView = { ...kgView, weightUnit: "lbs" };
  assert.equal(surveyBmr(kgView), 370 + 21.6 * 70 * 0.8);
  assert.equal(surveyBmr(lbView), surveyBmr(kgView));
  assert.deepEqual(surveyGoals(lbView), surveyGoals(kgView));
});

test("Done commits the visible defaults without wheel movement", () => {
  const empty = { weightKg: null, heightCm: null, bodyFat: null, weightUnit: "kg", heightUnit: "cm" };
  assert.deepEqual(surveyPickerCommit("age", { ...empty, pendingAge: 25 }), { age: 25 });
  assert.deepEqual(surveyPickerCommit("weight", empty), { weightKg: 70 });
  assert.deepEqual(surveyPickerCommit("height", empty), { heightCm: 175 });
  assert.deepEqual(surveyPickerCommit("bodyFat", empty), { bodyFat: 20 });
  assert.equal(surveyPickerCommit("weight", { ...empty, weightUnit: "lbs" }).weightKg * 2.20462, 154);
  assert.equal(surveyPickerCommit("height", { ...empty, heightUnit: "ft", feet: 5, inches: 9 }).heightCm, 175.26);
});

test("Done preserves precision of existing canonical values across display-unit switches", () => {
  const state = { weightKg: 70.15, heightCm: 175.3, bodyFat: 20.4, weightUnit: "lbs", heightUnit: "ft" };
  assert.deepEqual(surveyPickerCommit("weight", state), { weightKg: 70.15 });
  assert.deepEqual(surveyPickerCommit("height", state), { heightCm: 175.3 });
  assert.deepEqual(surveyPickerCommit("bodyFat", state), { bodyFat: 20.4 });
});

test("changing any canonical survey detail invalidates its recommendation", () => {
  const original = surveyInputSignature(canonical);
  const changes = { age: 31, sex: "male", weightKg: 71, heightCm: 176, bodyFat: 20,
    workActivity: "light", exerciseActivity: "high", goal: "lose" };
  for (const [key, value] of Object.entries(changes)) {
    assert.notEqual(surveyInputSignature({ ...canonical, [key]: value }), original, key);
  }
});

test("switching display units does not invalidate the canonical recommendation", () => {
  assert.equal(surveyInputSignature({ ...canonical, weightUnit: "kg", heightUnit: "cm" }),
    surveyInputSignature({ ...canonical, weightUnit: "lbs", heightUnit: "ft" }));
});
