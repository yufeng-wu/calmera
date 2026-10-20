import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MEAL_TIMES, MEAL_TYPES, validMealTimes, mealForLocalTime, sameMealTimes, mealTimeRange } from "../lib/mealTimes.mjs";
import { estimateVoiceMeal } from "../lib/chatgpt/mealTimeEstimate.mjs";

const local = minute => new Date(2026, 9, 20, Math.floor(minute / 60), minute % 60);
test("defaults cover every local minute exactly, with inclusive starts and exclusive ends", () => {
  assert.ok(validMealTimes(DEFAULT_MEAL_TIMES));
  const counts = Object.fromEntries(MEAL_TYPES.map(meal => [meal, 0]));
  for (let minute = 0; minute < 1440; minute++) counts[mealForLocalTime(local(minute))]++;
  assert.deepEqual(counts, { Breakfast: 360, Lunch: 360, Dinner: 300, Snack: 420 });
  for (const [minute, meal] of [[0,"Snack"],[299,"Snack"],[300,"Breakfast"],[659,"Breakfast"],
    [660,"Lunch"],[1019,"Lunch"],[1020,"Dinner"],[1319,"Dinner"],[1320,"Snack"],[1439,"Snack"]]) {
    assert.equal(mealForLocalTime(local(minute)), meal);
  }
});
test("custom quarter-hour starts, midnight breakfast and overnight snack remain unambiguous", () => {
  const times = { Breakfast: 0, Lunch: 615, Dinner: 990, Snack: 1275 };
  for (const meal of MEAL_TYPES) assert.equal(mealForLocalTime(local(times[meal]), times), meal);
  assert.equal(mealForLocalTime(local(614), times), "Breakfast");
  assert.equal(mealForLocalTime(local(1274), times), "Dinner");
  assert.ok(mealTimeRange("Snack", times).endsWith("(next day)"));
  assert.equal(sameMealTimes(times, { ...times }), true);
  assert.equal(sameMealTimes(times, DEFAULT_MEAL_TIMES), false);
});
test("overlaps, unordered starts, zero-length periods and malformed schedules are rejected", () => {
  for (const times of [null, [], {}, { ...DEFAULT_MEAL_TIMES, extra: 4 },
    { ...DEFAULT_MEAL_TIMES, Lunch: 300 }, { ...DEFAULT_MEAL_TIMES, Dinner: 600 },
    ...[-15,1440,500.5,301,"300",NaN].map(Breakfast => ({ ...DEFAULT_MEAL_TIMES, Breakfast }))]) {
    assert.equal(validMealTimes(times), false);
    assert.throws(() => mealForLocalTime(local(600), times), /invalid_meal_times/);
  }
  assert.throws(() => mealForLocalTime(new Date(NaN)), /invalid_meal_times/);
});
test("the same instant follows the phone time zone, including repeated DST hours", () => {
  const before = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    assert.equal(mealForLocalTime(new Date("2026-10-20T16:00:00Z")), "Lunch");
    const early = { Breakfast: 60, Lunch: 120, Dinner: 1020, Snack: 1320 };
    for (const instant of ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"]) {
      assert.equal(mealForLocalTime(new Date(instant), early), "Breakfast");
    }
    process.env.TZ = "Asia/Tokyo";
    assert.equal(mealForLocalTime(new Date("2026-10-20T16:00:00Z")), "Snack");
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});

test("voice estimation uses recording start across a boundary and preserves the complete transcript", async () => {
  const calls = []; const transcript = "A banana, and yesterday's soup for dinner";
  const result = [{ mealType: "Dinner" }];
  const recordedAt = local(659);
  const entries = await estimateVoiceMeal({ userId: "synthetic-owner", transcript, recordedAt, isActive: () => true,
    loadMealTimes: async (owner, options) => { calls.push(owner); assert.equal(options.isActive(), true); return DEFAULT_MEAL_TIMES; },
    getNutritionClient: async () => ({ model: "existing-model", client: { estimate: async request => { calls.push(request); return result; } } }),
  });
  assert.equal(entries, result);
  assert.deepEqual(calls, ["synthetic-owner", { text: transcript, model: "existing-model", defaultMealType: "Breakfast" }]);
});
test("voice estimation reads the current user's custom settings before requesting inference", async () => {
  let request;
  await estimateVoiceMeal({ userId: "owner-b", transcript: "a banana", recordedAt: local(700), isActive: () => true,
    loadMealTimes: async owner => { assert.equal(owner, "owner-b"); return { Breakfast: 600, Lunch: 780, Dinner: 1080, Snack: 1380 }; },
    getNutritionClient: async owner => { assert.equal(owner, "owner-b"); return { model: "m", client: { estimate: async value => { request = value; return []; } } }; },
  });
  assert.equal(request.defaultMealType, "Breakfast");
});
test("a failed schedule read never guesses Snack or submits an inference", async () => {
  await assert.rejects(estimateVoiceMeal({ userId: "owner", transcript: "a banana", recordedAt: local(700), isActive: () => true,
    loadMealTimes: async () => { throw Error("meal_times_load_failed"); },
    getNutritionClient: () => assert.fail("no inference client after failed settings read"),
  }), /meal_times_load_failed/);
});
test("cancellation during settings or client lookup cannot start inference", async () => {
  for (const cancelAt of ["before", "settings", "client"]) {
    let active = cancelAt !== "before";
    await assert.rejects(estimateVoiceMeal({ userId: "owner", transcript: "a banana", recordedAt: local(700), isActive: () => active,
      loadMealTimes: async () => { if (cancelAt === "settings") active = false; return DEFAULT_MEAL_TIMES; },
      getNutritionClient: async () => { active = false; return { model: "m", client: { estimate: () => assert.fail("no cancelled inference") } }; },
    }), /voice_operation_cancelled/);
  }
});
