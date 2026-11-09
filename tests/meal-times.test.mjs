import test from "node:test";
import assert from "node:assert/strict";
import { MEAL_STARTS, MEAL_TYPES, mealForLocalTime } from "../lib/mealTimes.mjs";

const local = minute => new Date(2026, 9, 20, Math.floor(minute / 60), minute % 60);
test("every local minute has exactly one meal, with inclusive starts and exclusive ends", () => {
  const counts = Object.fromEntries(MEAL_TYPES.map(meal => [meal, 0]));
  for (let minute = 0; minute < 1440; minute++) counts[mealForLocalTime(local(minute))]++;
  assert.deepEqual(counts, { Breakfast: 360, Lunch: 360, Dinner: 300, Snack: 420 });
  for (const [minute, meal] of [[0,"Snack"],[299,"Snack"],[300,"Breakfast"],[659,"Breakfast"],
    [660,"Lunch"],[1019,"Lunch"],[1020,"Dinner"],[1319,"Dinner"],[1320,"Snack"],[1439,"Snack"]]) {
    assert.equal(mealForLocalTime(local(minute)), meal);
  }
  for (const meal of MEAL_TYPES) assert.equal(mealForLocalTime(local(MEAL_STARTS[meal])), meal);
});
test("an invalid time is refused rather than guessed", () => {
  for (const value of [new Date(NaN), "2026-10-20T12:00", null, undefined, 720]) {
    assert.throws(() => mealForLocalTime(value), /invalid_meal_time/);
  }
});
test("the same instant follows the phone time zone", () => {
  const before = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    assert.equal(mealForLocalTime(new Date("2026-10-20T16:00:00Z")), "Lunch");
    process.env.TZ = "Asia/Tokyo";
    assert.equal(mealForLocalTime(new Date("2026-10-20T16:00:00Z")), "Snack");
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});
