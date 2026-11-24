import test from "node:test";
import assert from "node:assert/strict";
import { EXPORT_RANGES, wellFormed, exportJson, exportFileName, exportKeys, exportSummary } from "../src/lib/settings/dataExport.mjs";

const days = {
  "2026-10-30": { entries: [{ id: 2, user_id: "user_secret", foodName: "Rice, steamed", food_name: "Rice, steamed", quantity: "1 cup", calories: "200.50", protein: "4", carbs: "44", fat: "0.4", mealType: "Dinner", localTime: "19:05:00" }] },
  "2026-10-29": { entries: [
    { id: 1, foodName: "番茄炒蛋", quantity: "1 plate", calories: 300, protein: 18, carbs: 12, fat: 20, mealType: "Lunch", localTime: "12:30:00" },
    { food_name: 'He said "yum"', quantity: "=SUM(A1)", calories: 100, meal_type: "Snack", local_time: "15:00:00" },
  ] },
  "2026-10-28": { entries: [] },
  "2026-09-15": { entries: [{ foodName: "Pear", quantity: "1", calories: 100, mealType: "Snack", localTime: "16:00:00" }] },
  "2025-01-01": { entries: [{ foodName: "Old toast", quantity: "1", calories: 80, protein: 3, carbs: 15, fat: 1, mealType: "Breakfast", localTime: "08:00:00" }] },
};
const TODAY = new Date(2026, 9, 31);

test("there are two ranges, the last 30 days and all history", () => {
  assert.deepEqual(EXPORT_RANGES.map(({ id, label }) => [id, label]), [["month", "Last 30 days"], ["all", "All history"]]);
});

test("ranges pick days with something logged, oldest first", () => {
  assert.deepEqual(exportKeys(days, "all", TODAY), ["2025-01-01", "2026-09-15", "2026-10-29", "2026-10-30"]);
  assert.deepEqual(exportKeys(days, "month", TODAY), ["2026-10-29", "2026-10-30"]);
  // The 30th day back, counting today, is still in.
  assert.deepEqual(exportKeys(days, "month", new Date(2026, 9, 14)), ["2026-09-15", "2026-10-29", "2026-10-30"]);
  assert.deepEqual(exportKeys(days, "month", new Date(2026, 9, 15)), ["2026-10-29", "2026-10-30"]);
  assert.deepEqual(exportKeys({}, "all", TODAY), []);
  assert.deepEqual(exportSummary(days, ["2026-10-29", "2026-10-30"]), { days: 2, meals: 3, first: "2026-10-29", last: "2026-10-30" });
  assert.deepEqual(exportSummary({}, []), { days: 0, meals: 0, first: null, last: null });
});

test("the file holds every food, each day's totals and the goals as numbers, without account ids", () => {
  const text = exportJson(days, ["2026-10-29", "2026-10-30"], { calorieGoal: 2000, proteinGoal: "100" }, new Date(Date.UTC(2026, 9, 31)));
  const parsed = JSON.parse(text);
  assert.ok(!text.includes("user_secret"));
  assert.equal(parsed.app, "Calmera");
  assert.equal(parsed.exportedAt, "2026-10-31T00:00:00.000Z");
  assert.deepEqual(parsed.goals, { calories: 2000, protein_g: 100, carbs_g: null, fat_g: null });
  assert.deepEqual(parsed.days[0].totals, { foods: 2, calories: 400, protein_g: 18, carbs_g: 12, fat_g: 20 });
  assert.deepEqual(parsed.days[0].foods[1], { time: "15:00", meal: "Snack", food: 'He said "yum"', quantity: "=SUM(A1)", calories: 100, protein_g: null, carbs_g: null, fat_g: null, vegetables: null, fruits: null });
  assert.deepEqual(parsed.days[1], { date: "2026-10-30", totals: { foods: 1, calories: 200.5, protein_g: 4, carbs_g: 44, fat_g: 0.4 },
    foods: [{ time: "19:05", meal: "Dinner", food: "Rice, steamed", quantity: "1 cup", calories: 200.5, protein_g: 4, carbs_g: 44, fat_g: 0.4, vegetables: null, fruits: null }] });
  assert.equal(JSON.parse(exportJson({}, [])).goals.calories, null);
  assert.deepEqual(JSON.parse(exportJson({}, [])).days, []);
});

test("vegetables and fruits are kept, and unchecked stays different from none", () => {
  const tagged = { "2026-10-30": { entries: [
    { foodName: "Stir Fry", localTime: "19:05", ingredients: { vegetables: ["Carrot", "Bok Choy"], fruits: [] } },
    { foodName: "Toast", localTime: "20:00" },
  ] } };
  const [checked, unchecked] = JSON.parse(exportJson(tagged, ["2026-10-30"])).days[0].foods;
  assert.deepEqual([checked.vegetables, checked.fruits], [["Carrot", "Bok Choy"], []]);
  assert.deepEqual([unchecked.vegetables, unchecked.fruits], [null, null]);
});

test("missing numbers stay empty, and short times still read as times", () => {
  const odd = { "2026-10-30": { entries: [{ foodName: "Soup", calories: null, protein: "", carbs: 0, fat: undefined, mealType: "Lunch", localTime: "8:05:00" }] } };
  const [day] = JSON.parse(exportJson(odd, ["2026-10-30"])).days;
  assert.equal(day.foods[0].time, "08:05");
  assert.equal(day.foods[0].calories, null);
  assert.deepEqual(day.totals, { foods: 1, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
});

test("half an emoji becomes a replacement mark", () => {
  assert.equal(wellFormed("ok 🍎"), "ok 🍎");
  assert.equal(wellFormed("cut \uD83C"), "cut �");
  assert.equal(wellFormed("\uDF4E tail"), "� tail");
});

test("the file has a dated name", () => {
  assert.equal(exportFileName("2026-10-31"), "calmera-data-2026-10-31.json");
});
