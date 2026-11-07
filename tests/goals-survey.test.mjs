import test from "node:test";
import assert from "node:assert/strict";
import { surveyBmr, surveyActivityFactor, surveyGoals, surveyPickerCommit, surveyInputSignature,
  CALORIE_FLOORS, CARBS_RDA, DEFICIT } from "../lib/goalsSurvey.mjs";

const canonical = Object.freeze({ weightKg: 70, heightCm: 175, age: 30, sex: "female",
  workActivity: "moderate", exerciseActivity: "moderate", goal: "maintain" });
const macros = ({ calorieGoal, proteinGoal, carbsGoal, fatGoal }) => ({ calorieGoal, proteinGoal, carbsGoal, fatGoal });

test("switching displayed kg/lbs leaves canonical-weight goals and BMR unchanged", () => {
  const kgView = { ...canonical, weightUnit: "kg" };
  const lbView = { ...canonical, weightUnit: "lbs" };
  assert.deepEqual(macros(surveyGoals(kgView)), { calorieGoal: 2370, proteinGoal: 110, carbsGoal: 305, fatGoal: 80 });
  assert.deepEqual(surveyGoals(lbView), surveyGoals(kgView));
  assert.equal(surveyBmr(lbView), surveyBmr(kgView));
});

test("Mifflin–St Jeor with the midpoint constant for an unspecified sex", () => {
  assert.equal(surveyBmr(canonical), 10 * 70 + 6.25 * 175 - 5 * 30 - 161);
  assert.equal(surveyBmr({ ...canonical, sex: "male" }), surveyBmr(canonical) + 166);
  assert.equal(surveyBmr({ ...canonical, sex: "na" }), surveyBmr(canonical) + 83);
});

test("workouts add to the job's activity factor, capped at 1.9", () => {
  assert.equal(surveyActivityFactor({ workActivity: "sedentary", exerciseActivity: "sedentary" }), 1.2);
  assert.equal(surveyActivityFactor({ workActivity: "sedentary", exerciseActivity: "very_high" }), 1.4);
  assert.equal(surveyActivityFactor({ workActivity: "active", exerciseActivity: "sedentary" }), 1.7);
  assert.equal(surveyActivityFactor({ workActivity: "active", exerciseActivity: "very_high" }), 1.9);
});

test("losing cuts 500 kcal from estimated needs, gaining adds about 10%", () => {
  const heavy = { weightKg: 120, heightCm: 165, age: 40, sex: "female", workActivity: "sedentary", exerciseActivity: "sedentary", goal: "lose" };
  const result = surveyGoals(heavy);
  assert.equal(result.details.tdee, 2240);
  assert.equal(result.calorieGoal, 2240 - DEFICIT);
  assert.equal(result.details.change, -DEFICIT);
  const gain = surveyGoals({ ...canonical, goal: "gain" });
  assert.equal(gain.calorieGoal, 2370 + 240);
  const bigGain = surveyGoals({ weightKg: 100, heightCm: 185, age: 28, sex: "male", workActivity: "active", exerciseActivity: "very_high", goal: "gain" });
  assert.equal(bigGain.calorieGoal - bigGain.details.tdee, 350);
});

test("protein scales to a healthy-range weight, so heavier people are not sent to extremes", () => {
  const heavy = surveyGoals({ weightKg: 120, heightCm: 165, age: 40, sex: "female", workActivity: "sedentary", exerciseActivity: "sedentary", goal: "lose" });
  assert.equal(heavy.details.referenceKg, 68);
  assert.equal(heavy.details.scaledToHealthyWeight, true);
  assert.equal(heavy.proteinGoal, 110);
  assert.ok(heavy.proteinGoal >= 0.8 * 120, "never under the RDA for actual weight");
  assert.ok(heavy.proteinGoal * 4 <= 0.35 * heavy.calorieGoal, "never over 35% of calories");
  assert.equal(heavy.details.proteinCapped, false);
  const capped = surveyGoals({ ...canonical, age: 25, workActivity: "sedentary", goal: "lose" });
  assert.equal(capped.details.proteinCapped, true);
  assert.equal(capped.proteinGoal, 130);
  const lean = surveyGoals(canonical);
  assert.equal(lean.details.scaledToHealthyWeight, false);
  assert.equal(lean.details.proteinPerKg, 1.6);
  assert.equal(surveyGoals({ ...canonical, exerciseActivity: "light" }).details.proteinPerKg, 1.2);
  assert.equal(surveyGoals({ ...canonical, goal: "lose" }).details.proteinPerKg, 2.0);
  assert.equal(surveyGoals({ ...canonical, goal: "gain", exerciseActivity: "sedentary" }).details.proteinPerKg, 1.4);
});

test("a cut never goes under the adult calorie minimum for the chosen sex", () => {
  const small = { weightKg: 50, heightCm: 160, age: 25, sex: "female", workActivity: "sedentary", exerciseActivity: "sedentary", goal: "lose" };
  const result = surveyGoals(small);
  assert.equal(result.calorieGoal, CALORIE_FLOORS.female);
  assert.equal(result.details.atFloor, true);
  assert.equal(result.details.reason, null);
  const unspecified = surveyGoals({ ...small, sex: "na" });
  assert.equal(unspecified.calorieGoal, CALORIE_FLOORS.na);
  assert.equal(CALORIE_FLOORS.na, CALORIE_FLOORS.male);
});

test("under 18, underweight, or already at the minimum: no cut, with the reason", () => {
  const minor = surveyGoals({ weightKg: 70, heightCm: 170, age: 16, sex: "na", workActivity: "moderate", exerciseActivity: "light", goal: "lose" });
  assert.equal(minor.details.reason, "minor");
  assert.equal(minor.calorieGoal, minor.details.tdee);
  assert.equal(surveyGoals({ ...minor, age: 16, goal: "gain" }).details.reason, "minor");
  const underweight = surveyGoals({ weightKg: 45, heightCm: 170, age: 30, sex: "female", workActivity: "sedentary", exerciseActivity: "sedentary", goal: "lose" });
  assert.equal(underweight.details.reason, "underweight");
  assert.equal(underweight.calorieGoal, underweight.details.tdee);
  const tiny = surveyGoals({ weightKg: 40, heightCm: 150, age: 70, sex: "female", workActivity: "sedentary", exerciseActivity: "sedentary", goal: "lose" });
  assert.equal(tiny.details.reason, "underweight");
  const low = surveyGoals({ weightKg: 44, heightCm: 150, age: 75, sex: "female", workActivity: "sedentary", exerciseActivity: "sedentary", goal: "lose" });
  assert.equal(low.details.reason, "at-minimum");
  assert.equal(low.calorieGoal, low.details.tdee);
  assert.equal(surveyGoals({ ...canonical, goal: "lose" }).details.reason, null);
});

test("every suggestion stays inside the Dietary Reference Intake ranges", () => {
  const sexes = ["female", "male", "na"];
  const works = ["sedentary", "light", "moderate", "active"];
  const workouts = ["sedentary", "light", "moderate", "high", "very_high"];
  const aims = ["lose", "maintain", "gain"];
  let checked = 0;
  for (const weightKg of [40, 55, 70, 90, 120, 160, 200]) for (const heightCm of [150, 165, 180, 195])
    for (const age of [16, 25, 45, 70]) for (const sex of sexes) for (const workActivity of works)
      for (const exerciseActivity of workouts) for (const goal of aims) {
        const result = surveyGoals({ weightKg, heightCm, age, sex, workActivity, exerciseActivity, goal });
        const { calorieGoal, proteinGoal, carbsGoal, fatGoal, details } = result;
        const label = JSON.stringify({ weightKg, heightCm, age, sex, workActivity, exerciseActivity, goal });
        const macroKcal = proteinGoal * 4 + carbsGoal * 4 + fatGoal * 9;
        assert.ok(Math.abs(macroKcal - calorieGoal) <= 40, `macros add up ${label}`);
        assert.ok(carbsGoal >= CARBS_RDA, `carbs RDA ${label}`);
        assert.ok(proteinGoal >= 0.8 * weightKg - 2.5, `protein RDA ${label}`);
        assert.ok(proteinGoal * 4 <= 0.35 * calorieGoal + 20, `protein share ${label}`);
        assert.ok(fatGoal * 9 >= 0.2 * calorieGoal - 25 && fatGoal * 9 <= 0.35 * calorieGoal + 25, `fat share ${label}`);
        if (details.aim === "lose") assert.ok(calorieGoal >= CALORIE_FLOORS[sex], `floor ${label}`);
        if (details.aim === "lose") assert.ok(calorieGoal < details.tdee, `a cut is a cut ${label}`);
        if (details.aim === "gain") assert.ok(calorieGoal > details.tdee, `a surplus is a surplus ${label}`);
        assert.equal(calorieGoal % 10, 0); assert.equal(proteinGoal % 5, 0); assert.equal(carbsGoal % 5, 0); assert.equal(fatGoal % 5, 0);
        checked += 1;
      }
  assert.equal(checked, 7 * 4 * 4 * 3 * 4 * 5 * 3);
});

test("Done commits the visible defaults without wheel movement", () => {
  const empty = { weightKg: null, heightCm: null, weightUnit: "kg", heightUnit: "cm" };
  assert.deepEqual(surveyPickerCommit("age", { ...empty, pendingAge: 25 }), { age: 25 });
  assert.deepEqual(surveyPickerCommit("weight", empty), { weightKg: 70 });
  assert.deepEqual(surveyPickerCommit("height", empty), { heightCm: 175 });
  assert.equal(surveyPickerCommit("weight", { ...empty, weightUnit: "lbs" }).weightKg * 2.20462, 154);
  assert.equal(surveyPickerCommit("height", { ...empty, heightUnit: "ft", feet: 5, inches: 9 }).heightCm, 175.26);
});

test("Done preserves precision of existing canonical values across display-unit switches", () => {
  const state = { weightKg: 70.15, heightCm: 175.3, weightUnit: "lbs", heightUnit: "ft" };
  assert.deepEqual(surveyPickerCommit("weight", state), { weightKg: 70.15 });
  assert.deepEqual(surveyPickerCommit("height", state), { heightCm: 175.3 });
});

test("changing any canonical survey detail invalidates its recommendation", () => {
  const original = surveyInputSignature(canonical);
  const changes = { age: 31, sex: "male", weightKg: 71, heightCm: 176, workActivity: "light",
    exerciseActivity: "high", goal: "lose" };
  for (const [key, value] of Object.entries(changes)) {
    assert.notEqual(surveyInputSignature({ ...canonical, [key]: value }), original, key);
  }
});

test("switching display units does not invalidate the canonical recommendation", () => {
  assert.equal(surveyInputSignature({ ...canonical, weightUnit: "kg", heightUnit: "cm" }),
    surveyInputSignature({ ...canonical, weightUnit: "lbs", heightUnit: "ft" }));
});
