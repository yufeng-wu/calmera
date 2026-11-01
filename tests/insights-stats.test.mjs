import test from "node:test";
import assert from "node:assert/strict";
import { dateKeys, foodKey, formatClock, formatNearClock, formatNumber, formatRange, hasAnyLog, heatmapWeeks, periodStats } from "../lib/insights/stats.mjs";

const TODAY = new Date(2026, 9, 31, 15); // A Saturday.
const key = (daysAgo) => dateKeys(1, TODAY, daysAgo)[0];
const entry = (foodName, mealType, calories, protein = 0, localTime = "12:00") => ({ foodName, mealType, calories, protein, carbs: 0, fat: 0, localTime });
const dayRange = (from, to, make) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, index) => [key(from + index), { entries: make(from + index) }]));
const fullDay = (calories, protein = 0) => [entry("Eggs", "Breakfast", calories / 2, protein / 2, "08:00"), entry("Rice", "Dinner", calories / 2, protein / 2, "19:00")];

test("typical values are medians of finished days with two or more meals", () => {
  const stats = periodStats({
    [key(0)]: { entries: fullDay(9000) }, // Today is unfinished.
    [key(1)]: { entries: fullDay(1000) }, [key(2)]: { entries: fullDay(2000) }, [key(3)]: { entries: fullDay(6000) },
    [key(4)]: { entries: [entry("Toast", "Breakfast", 100)] }, // One meal logged.
  }, { today: TODAY });
  assert.equal(stats.daysLogged, 5);
  assert.equal(stats.finishedDays, 4);
  assert.equal(stats.completeDays, 3);
  assert.equal(stats.metrics.calories.typical, 2000);
  assert.equal(stats.metrics.calories.low, 1500);
  assert.equal(stats.metrics.calories.high, 4000);
});

test("typical values wait for three complete days", () => {
  const stats = periodStats({ [key(1)]: { entries: fullDay(1000) }, [key(2)]: { entries: fullDay(2000) } }, { today: TODAY });
  assert.equal(stats.metrics.calories.typical, null);
  assert.equal(stats.metrics.calories.average, 1500);
});

test("missed days are gaps and one-meal days are partial bars", () => {
  const stats = periodStats({ [key(0)]: { entries: fullDay(800) }, [key(1)]: { entries: fullDay(1000) }, [key(5)]: { entries: [entry("Rice", "Lunch", 300)] }, [key(3)]: { entries: [] } }, { today: TODAY });
  const chart = stats.metrics.calories.chart;
  assert.equal(chart.length, 7);
  assert.equal(chart.filter((point) => point.value == null).length, 4);
  assert.deepEqual(chart.map((point) => point.label), ["S", "M", "T", "W", "T", "F", "S"]);
  assert.equal(chart[1].value, 300);
  assert.equal(chart[1].partial, true);
  assert.equal(chart[5].partial, false);
  assert.equal(chart[6].partial, true); // Today.
  assert.equal(chart[6].title, "Sat, Oct 31");
});

test("a month draws every day and labels one day a week", () => {
  const chart = periodStats(dayRange(1, 29, () => fullDay(1000)), { span: 30, today: TODAY }).metrics.calories.chart;
  assert.equal(chart.length, 30);
  assert.deepEqual(chart.map((point) => point.label).filter(Boolean), ["Oct 7", "Oct 14", "Oct 21", "Oct 28"]);
});

test("a year draws twelve calendar months ending with this one", () => {
  const stats = periodStats({ ...dayRange(1, 30, () => fullDay(700)), [key(0)]: { entries: fullDay(5000) }, ...dayRange(330, 340, () => fullDay(300)) }, { span: 365, today: TODAY });
  const chart = stats.metrics.calories.chart;
  assert.equal(chart.length, 12);
  assert.equal(chart[0].title, "November 2025");
  assert.equal(chart[0].label, "N");
  assert.equal(chart[11].title, "October 2026");
  assert.equal(chart[11].value, 700); // Today's 5000 waits until tomorrow.
  assert.equal(chart[11].partial, true);
  assert.equal(chart[5].value, null);
  assert.equal(stats.keys.length, 365);
});

test("the previous period shows only with enough complete days on both sides", () => {
  const thin = periodStats(dayRange(1, 8, () => fullDay(500)), { today: TODAY });
  assert.equal(thin.comparable, false); // Only 2 days in the week before.
  assert.equal(thin.metrics.calories.previous, null);
  const full = periodStats(dayRange(1, 13, (ago) => fullDay(ago <= 6 ? 600 : 500)), { today: TODAY });
  assert.equal(full.comparable, true);
  assert.equal(full.metrics.calories.previous, 500);
  assert.equal(periodStats(dayRange(1, 35, () => fullDay(500)), { span: 30, today: TODAY }).comparable, false); // Only 6 days in the 30 before.
  assert.equal(periodStats(dayRange(1, 395, () => fullDay(500)), { span: 365, today: TODAY }).comparable, true);
  assert.equal(periodStats(dayRange(1, 390, () => fullDay(500)), { span: 365, today: TODAY }).comparable, false);
});

test("heatmap weeks start on Sunday, pad both ends and label months", () => {
  const keys = dateKeys(30, TODAY); // Oct 2 (a Friday) to Oct 31 (a Saturday).
  const weeks = heatmapWeeks(keys, keys.map(() => true));
  assert.equal(weeks[0].days.filter((day) => day === null).length, 5);
  assert.equal(weeks[0].days[5].key, keys[0]);
  assert.equal(weeks[0].days[5].logged, true);
  assert.equal(weeks[weeks.length - 1].days[6].key, keys[29]);
  assert.ok(weeks.every((week) => week.days.length === 7));
  assert.equal(weeks[0].month, "Oct");
  assert.equal(weeks[1].month, null);
  const spanning = heatmapWeeks(dateKeys(60, TODAY), Array(60).fill(false));
  assert.deepEqual(spanning.map((week) => week.month).filter(Boolean), ["Sep", "Oct"]);
  const sliver = heatmapWeeks(dateKeys(21, new Date(2026, 8, 20)), Array(21).fill(false)); // Starts Aug 31.
  assert.equal(sliver[0].month, null);
  assert.equal(sliver[1].month, "Sep");
});

test("days before the first log are not started, and today always is", () => {
  const stats = periodStats({ [key(2)]: { entries: [entry("Rice", "Lunch", 500)] }, [key(40)]: { entries: [] } }, { today: TODAY });
  assert.deepEqual(stats.started, [false, false, false, false, true, true, true]);
  assert.deepEqual(periodStats({}, { today: TODAY }).started, [false, false, false, false, false, false, true]);
  const weeks = heatmapWeeks(stats.keys, stats.loggedDays, stats.started);
  assert.equal(weeks[0].days.find((day) => day.key === key(2)).started, true);
  assert.equal(weeks[0].days.find((day) => day.key === key(3)).started, false);
});

test("food names merge when only wording differs, not when the food does", () => {
  assert.equal(foodKey("White Rice"), foodKey("steamed white rice!"));
  assert.equal(foodKey("Eggs"), foodKey("egg"));
  assert.equal(foodKey("A bowl of oatmeal"), "oatmeal");
  assert.notEqual(foodKey("Fried rice"), foodKey("Rice"));
  assert.equal(foodKey("Hummus"), "hummus");
  assert.equal(foodKey("Asparagus"), "asparagus");
  assert.equal(foodKey("Steamed"), "steamed"); // Never empty.
  assert.equal(foodKey("番茄炒蛋"), "番茄炒蛋");
  assert.notEqual(foodKey("🍎"), foodKey("🍕"));
  assert.notEqual(foodKey("दाल"), foodKey("दिल"));
  assert.equal(foodKey("Piña colada"), "piña colada");
});

test("foods merge under the most used spelling, rank three ways and mark new ones", () => {
  const days = { ...dayRange(1, 7, (ago) => [entry(ago % 2 ? "Oat Latte" : "oat latte", "Breakfast", 100, 1), entry("Poke Bowl", "Lunch", 500, 30)].slice(0, ago === 1 ? 2 : 1)),
    ...dayRange(31, 37, () => [entry("Oat Latte", "Breakfast", 100), entry("Toast", "Lunch", 100)]) };
  const stats = periodStats(days, { span: 30, today: TODAY });
  assert.deepEqual(stats.foods.map((food) => [food.name, food.count]), [["Oat Latte", 7], ["Poke Bowl", 1]]);
  assert.deepEqual(stats.foodsBy.protein.map((food) => food.name), ["Poke Bowl", "Oat Latte"]);
  assert.deepEqual(stats.foodsBy.calories.map((food) => [food.name, food.calories]), [["Oat Latte", 700], ["Poke Bowl", 500]]);
  assert.equal(stats.foodTotals.calories, 1200);
  const week = periodStats(dayRange(1, 6, (ago) => Array.from({ length: 25 }, (_, index) => entry(`Food ${index}`, "Lunch", ago))), { today: TODAY });
  assert.equal(week.foods.length, 20);
  assert.equal(week.foods[0].isNew, false);
  const year = periodStats({ ...dayRange(1, 40, () => fullDay(500)), ...dayRange(366, 410, () => [entry("Soup", "Lunch", 100), entry("Bread", "Snack", 100)]) }, { span: 365, today: TODAY });
  assert.equal(year.foods.find((food) => food.name === "Eggs").isNew, true);
});

test("rhythm gives each meal's usual time, once it has three days", () => {
  const days = dayRange(1, 5, (ago) => [entry("Eggs", "Breakfast", 200, 0, `0${7 + ago % 3}:00`), entry("Toast", "Breakfast", 100, 0, "11:00"), entry("Rice", "Dinner", 700, 0, "19:00")]);
  days[key(6)] = { entries: [entry("Chips", "Snack", 100, 0, "15:00"), entry("Soup", "Lunch", 100, 0, "12:00")] };
  const { rhythm } = periodStats(days, { today: TODAY });
  assert.deepEqual(rhythm.meals.map((meal) => meal.meal), ["Breakfast", "Dinner"]);
  const breakfast = rhythm.meals[0];
  assert.equal(breakfast.days, 5);
  assert.equal(breakfast.median, 8 * 60); // Each day's earliest breakfast.
  assert.equal(rhythm.meals[1].median, 19 * 60);
  assert.equal(periodStats({ [key(1)]: { entries: fullDay(100) } }, { today: TODAY }).rhythm, null);
});

const macros = (foodName, mealType, calories, protein, carbs, fat) => ({ foodName, mealType, calories, protein, carbs, fat, localTime: "12:00" });

test("meal shares give each nutrient's split across meals", () => {
  const days = dayRange(1, 3, () => [macros("Eggs", "Breakfast", 200, 30, 10, 20), macros("Rice", "Dinner", 600, 10, 90, 0), macros("Nuts", "Snack", 200, 10, 0, 30)]);
  const { shares } = periodStats(days, { today: TODAY });
  assert.equal(shares.days, 3);
  assert.deepEqual(shares.meals.map((row) => row.meal), ["Breakfast", "Dinner", "Snack"]);
  assert.deepEqual(shares.meals[0], { meal: "Breakfast", calories: 20, protein: 60, carbs: 10, fat: 40 });
  assert.equal(shares.meals[1].fat, 0);
  assert.equal(shares.largest.meal, "Dinner");
});

test("meal shares add up to exactly 100 in every column", () => {
  const days = dayRange(1, 3, () => [macros("A", "Breakfast", 100, 1, 1, 1), macros("B", "Lunch", 100, 1, 1, 1), macros("C", "Dinner", 100, 1, 1, 1)]);
  const { shares } = periodStats(days, { today: TODAY });
  for (const field of ["calories", "protein", "carbs", "fat"]) assert.equal(shares.meals.reduce((total, row) => total + row[field], 0), 100);
  assert.equal(shares.largest, null); // A tie has no largest meal.
});

test("meal shares skip today and one-meal days, and wait for three complete days", () => {
  const days = dayRange(1, 3, () => [macros("Eggs", "Breakfast", 500, 0, 0, 0), macros("Rice", "Dinner", 500, 0, 0, 0)]);
  days[key(0)] = { entries: [macros("Cake", "Snack", 9000, 0, 0, 0)] };
  days[key(4)] = { entries: [macros("Toast", "Lunch", 9000, 0, 0, 0)] };
  const { shares } = periodStats(days, { today: TODAY });
  assert.deepEqual(shares.meals.map((row) => row.meal), ["Breakfast", "Dinner"]);
  assert.equal(shares.meals[0].calories, 50);
  assert.equal(shares.meals[0].protein, null); // Nothing logged to divide.
  assert.equal(periodStats(dayRange(1, 2, () => fullDay(100)), { today: TODAY }).shares, null);
  assert.equal(periodStats(dayRange(1, 3, () => fullDay(0)), { today: TODAY }).shares, null);
});

test("veg and fruit lists merge spellings and count unchecked foods apart", () => {
  const tagged = (name, vegetables, fruits) => ({ ...entry(name, "Lunch", 100), ingredients: { vegetables, fruits } });
  const { produce } = periodStats({
    [key(0)]: { entries: [tagged("Salad", ["Spinach", "Carrot"], ["Apple"])] }, // Today counts: it was eaten.
    [key(1)]: { entries: [tagged("Soup", ["carrots", "Carrot"], []), entry("Toast", "Breakfast", 100)] },
    [key(9)]: { entries: [tagged("Old", ["Kale"], [])] }, // Outside the week.
  }, { today: TODAY });
  assert.deepEqual(produce.vegetables.map(({ name, count }) => [name, count]), [["Carrot", 3], ["Spinach", 1]]);
  assert.deepEqual(produce.fruits.map((item) => item.name), ["Apple"]);
  assert.equal(produce.unchecked, 1);
});

test("veg and fruit stay hidden until a food has been checked", () => {
  assert.equal(periodStats({ [key(1)]: { entries: fullDay(100) } }, { today: TODAY }).produce, null);
  const none = periodStats({ [key(1)]: { entries: [{ ...entry("Toast", "Lunch", 100), ingredients: { vegetables: [], fruits: [] } }] } }, { today: TODAY }).produce;
  assert.deepEqual([none.vegetables, none.fruits, none.unchecked], [[], [], 0]);
});

test("higher-protein days compare at the goal when both sides have three days", () => {
  const days = dayRange(1, 8, (ago) => ago <= 4
    ? [entry("Greek Yogurt", "Breakfast", 200, 30), entry("Rice", "Dinner", 500, 75)]
    : [entry("Toast", "Breakfast", 200, 5), entry("Rice", "Dinner", 500, 70)]);
  const { difference } = periodStats(days, { span: 30, today: TODAY, goals: { proteinGoal: 100 } });
  assert.equal(difference.goal, 100);
  assert.equal(difference.higherDays, 4);
  assert.equal(difference.lowerDays, 4);
  assert.equal(difference.widest.meal, "Breakfast");
  assert.equal(difference.widest.higher, 30);
  assert.equal(difference.widest.lower, 5);
  assert.deepEqual(difference.foods, [{ name: "Greek Yogurt", higher: 4, lower: 0 }]);
});

test("higher-protein days fall back to top and bottom halves without a usable goal", () => {
  const days = dayRange(1, 6, (ago) => [entry("Eggs", "Breakfast", 200, ago * 10), entry("Rice", "Dinner", 500, 10)]);
  const noGoal = periodStats(days, { span: 30, today: TODAY }).difference;
  assert.equal(noGoal.goal, null);
  assert.equal(noGoal.higherDays, 3);
  assert.equal(noGoal.widest.meal, "Breakfast");
  assert.equal(periodStats(days, { span: 30, today: TODAY, goals: { proteinGoal: 500 } }).difference.goal, null); // Goal never reached.
  assert.equal(periodStats(dayRange(1, 5, () => fullDay(500, 40)), { span: 30, today: TODAY }).difference, null); // Too few days.
  assert.equal(periodStats(days, { today: TODAY }).difference, null); // A week is too short.
  assert.equal(periodStats(dayRange(1, 6, () => fullDay(500)), { span: 30, today: TODAY }).difference, null); // No protein at all.
});

test("tied protein days have no higher half", () => {
  const days = dayRange(1, 6, (ago) => [entry(ago <= 3 ? "Oats" : "Toast", "Breakfast", 200, 20), entry("Rice", "Dinner", 500, 20 + (ago === 1 ? 0.5 : 0))]);
  assert.equal(periodStats(days, { span: 30, today: TODAY }).difference, null);
});

test("similar meals and evenly spread foods aren't called out", () => {
  const days = dayRange(1, 6, (ago) => { const extra = ago <= 3 ? 4 : 0; return [entry("Eggs", "Breakfast", 200, 20 + extra), entry("Rice", "Dinner", 500, 20 + extra)]; });
  const { difference } = periodStats(days, { span: 30, today: TODAY });
  assert.equal(difference.widest, null);
  assert.deepEqual(difference.foods, []);
});

test("weekdays vs weekends appears only over longer periods with enough complete days", () => {
  const days = dayRange(1, 14, (ago) => {
    const weekend = [0, 6].includes(new Date(`${key(ago)}T12:00:00`).getDay());
    return weekend ? [entry("Pizza", "Lunch", 500, 15, "11:00"), entry("Pizza", "Dinner", 400, 15, "20:30")] : [entry("Rice", "Breakfast", 250, 10, "08:00"), entry("Rice", "Dinner", 250, 10, "19:00")];
  });
  const { split } = periodStats(days, { span: 30, today: TODAY });
  assert.deepEqual(split.weekday, { days: 10, calories: 500, protein: 20, firstMeal: 8 * 60, dinner: 19 * 60 });
  assert.deepEqual(split.weekend, { days: 4, calories: 900, protein: 30, firstMeal: 11 * 60, dinner: 20.5 * 60 });
  assert.equal(periodStats(days, { span: 7, today: TODAY }).split, null);
  assert.equal(periodStats(dayRange(1, 6, () => fullDay(500)), { span: 30, today: TODAY }).split, null);
});

test("usual times don't break across midnight", () => {
  const snacks = ["23:30", "23:45", "00:15", "00:30"];
  const days = dayRange(1, 4, (ago) => [entry("Toast", "Breakfast", 100, 0, "08:00"), entry("Chips", "Snack", 100, 0, snacks[ago - 1])]);
  const snack = periodStats(days, { today: TODAY }).rhythm.meals.find((meal) => meal.meal === "Snack");
  assert.equal(snack.median, 24 * 60);
  assert.ok(snack.low >= 23.5 * 60 && snack.high <= 24.5 * 60 && snack.low < snack.high);
  assert.match(formatClock(snack.median), /^12:00/);
  assert.match(formatClock(24 * 60 + 15), /^12:15/);
  const stats = periodStats(dayRange(1, 14, (ago) => { const weekend = [0, 6].includes(new Date(`${key(ago)}T12:00:00`).getDay());
    return [entry("Eggs", "Breakfast", 100, 0, "08:00"), weekend ? entry("Chips", "Snack", 100, 0, "00:20") : entry("Rice", "Dinner", 100, 0, "19:00")]; }), { span: 30, today: TODAY });
  assert.equal(stats.split.weekend.firstMeal, 8 * 60); // Saturday's late snack came after Friday's day ended.
});

test("today doesn't count toward usual times, and a missing time isn't midnight", () => {
  const days = dayRange(1, 2, () => [entry("Chips", "Snack", 100, 0, "15:00")]);
  days[key(0)] = { entries: [entry("Chips", "Snack", 100, 0, "09:00")] };
  assert.equal(periodStats(days, { today: TODAY }).rhythm, null);
  const blank = dayRange(1, 3, () => [{ ...entry("Soup", "Lunch", 100, 0, null) }]);
  assert.equal(periodStats(blank, { today: TODAY }).rhythm, null);
});

test("month bars prefer complete days and mark months with none as partial", () => {
  const stats = periodStats({ ...dayRange(1, 3, () => fullDay(1000)), ...dayRange(4, 6, () => [entry("Toast", "Breakfast", 50)]), ...dayRange(60, 62, () => [entry("Toast", "Breakfast", 50)]) }, { span: 365, today: TODAY });
  const chart = stats.metrics.calories.chart;
  assert.equal(chart[11].value, 1000);
  assert.equal(chart[9].value, 50);
  assert.equal(chart[9].partial, true);
});

test("the year chart covers exactly the period's days", () => {
  const today = new Date(2026, 10, 1); // The 1st, so the year starts on Nov 2.
  const chart = periodStats({}, { span: 365, today }).metrics.calories.chart;
  assert.equal(chart.length, 13);
  assert.equal(chart[0].title, "November 2025");
  assert.equal(chart[0].partial, true);
  assert.equal(chart[12].title, "November 2026");
  assert.equal(chart[12].partial, true);
  assert.equal(periodStats({}, { span: 365, today: new Date(2028, 2, 31) }).metrics.calories.chart[0].title, "April 2027");
});

test("entries from the server's snake_case shape still count", () => {
  const stats = periodStats(dayRange(1, 3, () => [{ food_name: "Soup", meal_type: "Dinner", calories: 300, local_time: "19:15:00" }]), { today: TODAY });
  assert.equal(stats.foods[0].name, "Soup");
  assert.equal(stats.rhythm.meals[0].median, 19.25 * 60);
});

test("hasAnyLog ignores empty days", () => {
  assert.equal(hasAnyLog({}), false);
  assert.equal(hasAnyLog({ [key(1)]: { entries: [] } }), false);
  assert.equal(hasAnyLog({ [key(1)]: { entries: fullDay(100) } }), true);
});

test("formatting", () => {
  assert.equal(formatNumber(1725.4), "1,725");
  assert.equal(formatNumber(null), "–");
  assert.match(formatClock(485), /^8:05/);
  assert.equal(formatClock(null), "–");
  assert.match(formatNearClock(8 * 60 + 8), /^8:15/);
  assert.match(formatNearClock(8 * 60 + 6), /^8:00/);
  assert.match(formatNearClock(23 * 60 + 55), /^12:00/); // Wraps past midnight.
  assert.equal(formatNearClock(null), "–");
  assert.equal(formatRange(dateKeys(7, new Date(2026, 9, 31))), "Oct 25 – 31");
  assert.equal(formatRange(dateKeys(7, new Date(2026, 10, 1))), "Oct 26 – Nov 1");
  assert.equal(formatRange(dateKeys(365, new Date(2026, 10, 1))), "Nov 2, 2025 – Nov 1, 2026");
});
