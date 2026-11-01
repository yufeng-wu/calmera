import test from "node:test";
import assert from "node:assert/strict";
import { EXPORT_FORMATS, csvCell, wellFormed, dailyTotalsCsv, everythingJson, exportFileName, exportKeys, exportSummary, mealsCsv } from "../lib/dataExport.mjs";

const days = {
  "2026-10-30": { entries: [{ id: 2, user_id: "user_secret", foodName: "Rice, steamed", food_name: "Rice, steamed", quantity: "1 cup", calories: "200.50", protein: "4", carbs: "44", fat: "0.4", mealType: "Dinner", localTime: "19:05:00" }] },
  "2026-10-29": { entries: [
    { id: 1, foodName: "番茄炒蛋", quantity: "1 plate", calories: 300, protein: 18, carbs: 12, fat: 20, mealType: "Lunch", localTime: "12:30:00" },
    { food_name: 'He said "yum"', quantity: "=SUM(A1)", calories: 100, meal_type: "Snack", local_time: "15:00:00" },
  ] },
  "2026-10-28": { entries: [] },
  "2025-01-01": { entries: [{ foodName: "Old toast", quantity: "1", calories: 80, protein: 3, carbs: 15, fat: 1, mealType: "Breakfast", localTime: "08:00:00" }] },
};
const TODAY = new Date(2026, 9, 31);
const lines = (text) => text.replace(/^﻿/, "").trim().split("\r\n");

test("cells quote separators and neutralize formulas", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("-1"), "'-1");
  assert.equal(csvCell("@me"), "'@me");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(0), "0");
  assert.equal(csvCell(" =1"), "' =1");
  assert.equal(csvCell("＝1"), "'＝1");
});

test("ranges pick days with something logged, oldest first", () => {
  assert.deepEqual(exportKeys(days, "All time", TODAY), ["2025-01-01", "2026-10-29", "2026-10-30"]);
  assert.deepEqual(exportKeys(days, "Last 12 months", TODAY), ["2026-10-29", "2026-10-30"]);
  assert.deepEqual(exportKeys(days, "Last 30 days", TODAY), ["2026-10-29", "2026-10-30"]);
  assert.deepEqual(exportKeys({}, "All time", TODAY), []);
  assert.deepEqual(exportSummary(days, ["2026-10-29", "2026-10-30"]), { days: 2, meals: 3, first: "2026-10-29", last: "2026-10-30" });
  assert.deepEqual(exportSummary({}, []), { days: 0, meals: 0, first: null, last: null });
});

test("the foods file has one row per food and leaves out account ids", () => {
  const text = mealsCsv(days, ["2026-10-29", "2026-10-30"]);
  assert.ok(text.startsWith("﻿"));
  assert.ok(!text.includes("user_secret"));
  assert.deepEqual(lines(text), [
    "date,time,meal,food,quantity,calories,protein_g,carbs_g,fat_g",
    "2026-10-29,12:30,Lunch,番茄炒蛋,1 plate,300,18,12,20",
    `2026-10-29,15:00,Snack,"He said ""yum""",'=SUM(A1),100,,,`,
    '2026-10-30,19:05,Dinner,"Rice, steamed",1 cup,200.5,4,44,0.4',
  ]);
});

test("the daily file adds up each day", () => {
  assert.deepEqual(lines(dailyTotalsCsv(days, ["2026-10-29", "2026-10-30"])), [
    "date,foods_logged,calories,protein_g,carbs_g,fat_g",
    "2026-10-29,2,400,18,12,20",
    "2026-10-30,1,200.5,4,44,0.4",
  ]);
});

test("the JSON file holds foods and goals as numbers, without account ids", () => {
  const text = everythingJson(days, ["2026-10-30"], { calorieGoal: 2000, proteinGoal: "100" }, new Date(Date.UTC(2026, 9, 31)));
  const parsed = JSON.parse(text);
  assert.ok(!text.includes("user_secret"));
  assert.equal(parsed.app, "Calmera");
  assert.equal(parsed.exportedAt, "2026-10-31T00:00:00.000Z");
  assert.deepEqual(parsed.goals, { calories: 2000, protein_g: 100, carbs_g: null, fat_g: null });
  assert.deepEqual(parsed.days, [{ date: "2026-10-30", foods: [{ time: "19:05", meal: "Dinner", food: "Rice, steamed", quantity: "1 cup", calories: 200.5, protein_g: 4, carbs_g: 44, fat_g: 0.4 }] }]);
  assert.deepEqual(JSON.parse(everythingJson({}, [])).goals.calories, null);
});

test("missing numbers stay blank, and short times still read as times", () => {
  const odd = { "2026-10-30": { entries: [{ foodName: "Soup", calories: null, protein: "", carbs: 0, fat: undefined, mealType: "Lunch", localTime: "8:05:00" }] } };
  assert.equal(lines(mealsCsv(odd, ["2026-10-30"]))[1], "2026-10-30,08:05,Lunch,Soup,,,,0,");
  assert.equal(JSON.parse(everythingJson(odd, ["2026-10-30"])).days[0].foods[0].calories, null);
});

test("half an emoji becomes a replacement mark", () => {
  assert.equal(wellFormed("ok 🍎"), "ok 🍎");
  assert.equal(wellFormed("cut \uD83C"), "cut \uFFFD");
  assert.equal(wellFormed("\uDF4E tail"), "\uFFFD tail");
});

test("every format builds and has a dated file name", () => {
  for (const format of EXPORT_FORMATS) assert.ok(format.build(days, ["2026-10-30"], {}).includes("2026-10-30"));
  assert.equal(exportFileName(EXPORT_FORMATS[0], "2026-10-31"), "calmera-meals-2026-10-31.csv");
  assert.equal(exportFileName(EXPORT_FORMATS[2], "2026-10-31"), "calmera-data-2026-10-31.json");
});
