import test from "node:test";
import assert from "node:assert/strict";
import { validateMealNutrition } from "../lib/mealNutritionValidation.mjs";

const valid = { calories: "105", protein: "1.3", carbs: "27", fat: "0.4" };
const fields = ["calories", "protein", "carbs", "fat"];
function rejectsField(input, field) {
  const result = validateMealNutrition(input);
  assert.equal(result.values, null, "invalid input must not expose partially usable payload values");
  assert.equal(result.error.field, field);
  assert.equal(result.error.title, `Check ${field}`);
}

test("the existing meal conversions keep decimals and produce only finite JSON numbers", () => {
  const result = validateMealNutrition(valid);
  assert.equal(result.error, null);
  assert.deepEqual(result.values, { calories: 105, protein: 1.3, carbs: 27, fat: 0.4 });
  assert.deepEqual(JSON.parse(JSON.stringify(result.values)), result.values);
  assert.ok(Object.values(result.values).every(Number.isFinite));
});

test("zero, decimal and scientific input remain accepted without rounding", () => {
  for (const input of [
    { calories: "0", protein: "0.0", carbs: 0, fat: "-0" },
    { calories: "1.05e2", protein: " .125 ", carbs: "2.7e1", fat: "4e-1" },
    { calories: 105.5, protein: 1.25, carbs: 27.75, fat: 0.4 },
  ]) {
    const result = validateMealNutrition(input);
    assert.equal(result.error, null);
    for (const field of fields) assert.equal(result.values[field], Number(input[field]));
    assert.deepEqual(JSON.parse(JSON.stringify(result.values)), Object.fromEntries(
      Object.entries(result.values).map(([field, value]) => [field, value === 0 ? 0 : value])));
  }
});

test("Calories is required, including whitespace-only input", () => {
  for (const calories of ["", "  ", "\n\t", null, undefined]) rejectsField({ ...valid, calories }, "calories");
  rejectsField({}, "calories");
});

test("optional blank macros retain the existing zero payload semantics", () => {
  for (const blank of ["", "  ", "\n\t", null, undefined]) {
    const result = validateMealNutrition({ calories: "105", protein: blank, carbs: blank, fat: blank });
    assert.equal(result.error, null);
    assert.deepEqual(result.values, { calories: 105, protein: 0, carbs: 0, fat: 0 });
  }
  assert.deepEqual(validateMealNutrition({ calories: "0" }).values, { calories: 0, protein: 0, carbs: 0, fat: 0 });
});

test("numeric prefixes with units or commas cannot become a NaN/null payload", () => {
  for (const field of fields) {
    for (const invalid of ["105 kcal", "1,000", "12g", "1.2.3", "1e", "NaN"]) {
      rejectsField({ ...valid, [field]: invalid }, field);
    }
  }
});

test("overflow and other nonfinite values are rejected for every nutrition field", () => {
  for (const field of fields) {
    for (const invalid of ["1e309", "Infinity", "-Infinity", Infinity, -Infinity, NaN]) {
      rejectsField({ ...valid, [field]: invalid }, field);
    }
  }
});

test("negative calories and optional macros are rejected without silently clamping them", () => {
  for (const field of fields) {
    for (const negative of ["-1", "-0.1", "-1e-4", -0.25]) rejectsField({ ...valid, [field]: negative }, field);
  }
});

test("non-numeric coercible objects are not accepted as form numbers", () => {
  for (const field of fields) {
    for (const value of [true, false, [], [1], { valueOf: () => 1 }]) rejectsField({ ...valid, [field]: value }, field);
  }
});
