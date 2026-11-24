import test from "node:test";
import assert from "node:assert/strict";
import { dateKeys, foodKey, formatClock, formatNearClock, formatNumber, formatRange, goalScale, hasAnyLog, heatmapWeeks, percentOfGoal, periodStats } from "../src/lib/insights/stats.mjs";

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

test("the previous period comes with its bars once both sides have enough days", () => {
  const both = periodStats({ ...dayRange(1, 3, () => fullDay(1000)), ...dayRange(7, 9, () => fullDay(2000)) }, { today: TODAY }).metrics.calories;
  assert.equal(both.previous, 2000);
  assert.equal(both.previousChart.length, 7);
  assert.equal(both.previousChart.filter((point) => point.value === 2000).length, 3);
  assert.equal(both.previousChart[0].label.length, 1);
  const thin = periodStats({ ...dayRange(1, 3, () => fullDay(1000)), ...dayRange(7, 8, () => fullDay(2000)) }, { today: TODAY }).metrics.calories;
  assert.deepEqual([thin.previous, thin.previousChart], [null, null]);
  const month = periodStats({ ...dayRange(1, 8, () => fullDay(1000)), ...dayRange(30, 38, () => fullDay(2000)) }, { span: 30, today: TODAY }).metrics.calories;
  assert.equal(month.previousChart.length, 30);
  assert.ok(month.previousChart.some((point) => point.label));
  assert.ok(month.chart.some((point) => point.label));
});

test("percent of goal rounds to whole numbers and needs both values", () => {
  assert.equal(percentOfGoal(1873, 1894), 99);
  assert.equal(percentOfGoal(214, "189"), 113);
  assert.equal(percentOfGoal(0, 100), 0);
  for (const [value, goal] of [[null, 100], [undefined, 100], [100, null], [100, 0], [100, ""]]) assert.equal(percentOfGoal(value, goal), null);
});

test("charts share a scale past their goals, within limits", () => {
  const row = (goal, ...values) => ({ goal, points: values.map((value) => ({ value })) });
  assert.equal(goalScale([row(100, 90, 150), row(200, 100, 200)]), 1.5);
  assert.equal(goalScale([row(100, 50, null)]), 1.2); // Room above the line even when under it.
  assert.equal(goalScale([row(100, 900)]), 2); // One huge day doesn't flatten the rest.
  assert.equal(goalScale([row(null, 900)]), 1.2); // A row with no goal has no say.
  assert.equal(goalScale([]), 1.2);
});

test("typical values wait for three complete days", () => {
  const stats = periodStats({ [key(1)]: { entries: fullDay(1000) }, [key(2)]: { entries: fullDay(2000) } }, { today: TODAY });
  assert.equal(stats.metrics.calories.typical, null);
  assert.equal(stats.metrics.calories.average, 1500);
});

test("missed days are gaps and only today is a partial bar", () => {
  const stats = periodStats({ [key(0)]: { entries: fullDay(800) }, [key(1)]: { entries: fullDay(1000) }, [key(5)]: { entries: [entry("Rice", "Lunch", 300)] }, [key(3)]: { entries: [] } }, { today: TODAY });
  const chart = stats.metrics.calories.chart;
  assert.equal(chart.length, 7);
  assert.equal(chart.filter((point) => point.value == null).length, 4);
  assert.deepEqual(chart.map((point) => point.label), ["S", "M", "T", "W", "T", "F", "S"]);
  assert.equal(chart[1].value, 300);
  assert.equal(chart[1].partial, false); // One meal, but finished.
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

test("days count from the join day, or the first log if that's earlier", () => {
  const days = { [key(1)]: { entries: fullDay(1000) } };
  assert.deepEqual(periodStats(days, { today: TODAY, joined: key(4) }).started, [false, false, true, true, true, true, true]);
  assert.deepEqual(periodStats(days, { today: TODAY, joined: `${key(4)}T00:00:00.000Z` }).started, [false, false, true, true, true, true, true]);
  assert.deepEqual(periodStats(days, { today: TODAY, joined: "not a date" }).started, [false, false, false, false, false, true, true]);
  assert.deepEqual(periodStats({ [key(5)]: { entries: fullDay(1000) } }, { today: TODAY, joined: key(2) }).started, [false, true, true, true, true, true, true]);
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

test("foods merge under the most used spelling, rank by count and each nutrient, and mark new ones", () => {
  const days = { ...dayRange(1, 7, (ago) => [entry(ago % 2 ? "Oat Latte" : "oat latte", "Breakfast", 100, 1), entry("Poke Bowl", "Lunch", 500, 30)].slice(0, ago === 1 ? 2 : 1)),
    ...dayRange(31, 37, () => [entry("Oat Latte", "Breakfast", 100), entry("Toast", "Lunch", 100)]) };
  const stats = periodStats(days, { span: 30, today: TODAY });
  assert.deepEqual(stats.foods.map((food) => [food.name, food.count]), [["Oat Latte", 7], ["Poke Bowl", 1]]);
  assert.deepEqual(stats.foodsBy.protein.map((food) => food.name), ["Poke Bowl", "Oat Latte"]);
  assert.deepEqual(stats.foodsBy.calories.map((food) => [food.name, food.calories]), [["Oat Latte", 700], ["Poke Bowl", 500]]);
  assert.equal(stats.foodTotals.calories, 1200);
  const macros = periodStats({ [key(1)]: { entries: [{ ...entry("Pasta", "Dinner", 600), carbs: 90, fat: 12 }, { ...entry("Nuts", "Snack", 200), carbs: 6, fat: 18 }] } }, { today: TODAY });
  assert.deepEqual(macros.foodsBy.carbs.map((food) => [food.name, food.carbs]), [["Pasta", 90], ["Nuts", 6]]);
  assert.deepEqual(macros.foodsBy.fat.map((food) => [food.name, food.fat]), [["Nuts", 18], ["Pasta", 12]]);
  const week = periodStats(dayRange(1, 6, (ago) => Array.from({ length: 25 }, (_, index) => entry(`Food ${index}`, "Lunch", ago))), { today: TODAY });
  assert.equal(week.foods.length, 25);
  assert.equal(periodStats(dayRange(1, 1, () => Array.from({ length: 120 }, (_, index) => entry(`Food ${index}`, "Lunch", 1))), { today: TODAY }).foods.length, 100);
  assert.equal(week.foods[0].isNew, false);
  const year = periodStats({ ...dayRange(1, 40, () => fullDay(500)), ...dayRange(366, 410, () => [entry("Soup", "Lunch", 100), entry("Bread", "Snack", 100)]) }, { span: 365, today: TODAY });
  assert.equal(year.foods.find((food) => food.name === "Eggs").isNew, true);
});

test("rhythm gives each meal's usual time, once it has three days", () => {
  const days = dayRange(1, 5, (ago) => [entry("Eggs", "Breakfast", 200, 0, `0${7 + ago % 3}:00`), entry("Toast", "Breakfast", 100, 0, "11:00"), entry("Rice", "Dinner", 700, 0, "19:00")]);
  days[key(6)] = { entries: [entry("Chips", "Snack", 100, 0, "15:00"), entry("Soup", "Lunch", 100, 0, "12:00")] };
  const { rhythm } = periodStats(days, { today: TODAY });
  assert.deepEqual(rhythm.meals.map((meal) => meal.meal), ["Breakfast", "Dinner", "Snack"]); // Snacks show from the first one.
  assert.deepEqual(rhythm.tooFew, [{ meal: "Lunch", days: 1 }]);
  assert.equal(rhythm.meals[2].average, undefined);
  const breakfast = rhythm.meals[0];
  assert.equal(breakfast.days, 5);
  assert.equal(breakfast.events.length, 5);
  assert.equal(breakfast.average, 8 * 60); // Each day's earliest breakfast.
  assert.equal(rhythm.meals[1].average, 19 * 60);
  assert.deepEqual([rhythm.start, rhythm.end], [6 * 60, 24 * 60]);
  assert.equal(periodStats({ [key(1)]: { entries: fullDay(100) } }, { today: TODAY }).rhythm, null);
});

test("every snack is its own point, and snacks have no average", () => {
  const days = dayRange(1, 6, (ago) => [entry("Eggs", "Breakfast", 100, 0, "08:00"), entry("Nuts", "Snack", 100, 0, `10:${20 + ago}`),
    entry("Chips", "Snack", 100, 0, "15:30"), entry("Apple", "Snack", 100, 0, "15:50"), ...(ago % 2 ? [] : [entry("Tea", "Snack", 0, 0, "16:40")])]);
  days[key(7)] = { entries: [entry("Eggs", "Breakfast", 100, 0, "08:00"), entry("Cake", "Snack", 100, 0, "01:10")] };
  const { rhythm } = periodStats(days, { span: 30, today: TODAY });
  const snack = rhythm.meals.find((meal) => meal.meal === "Snack");
  assert.equal(snack.events.length, 6 + 6 + 6 + 3 + 1); // Chips and Apple twenty minutes apart are two snacks.
  assert.equal(snack.days, 7);
  assert.equal(snack.average, undefined);
  assert.equal(rhythm.end, 26 * 60); // The 1 AM snack widens the axis.
});

test("an early breakfast stays early, while a late snack counts as after midnight", () => {
  const days = dayRange(1, 6, () => [entry("Toast", "Breakfast", 100, 0, "04:40"), entry("Soup", "Lunch", 100, 0, "12:00"), entry("Cake", "Snack", 100, 0, "01:00")]);
  const { rhythm } = periodStats(days, { span: 30, today: TODAY });
  assert.equal(rhythm.meals.find((meal) => meal.meal === "Breakfast").average, 4 * 60 + 40);
  assert.ok(rhythm.meals.find((meal) => meal.meal === "Snack").events.every(({ time }) => time === 25 * 60));
  assert.deepEqual([rhythm.start, rhythm.end], [4 * 60, 25 * 60]);
});

test("days before the first log are blank, not missed", () => {
  const { metrics } = periodStats(dayRange(1, 3, () => fullDay(1000)), { span: 30, today: TODAY });
  const chart = metrics.calories.chart;
  assert.equal(chart.filter((point) => point.before).length, 26);
  assert.equal(chart[26].before, false);
  assert.equal(chart[29].before, false); // Today.
});

test("meals logged in one go keep only the later meal's time", () => {
  const days = dayRange(1, 4, () => [entry("Eggs", "Breakfast", 100, 0, "12:00"), entry("Soup", "Lunch", 100, 0, "12:05"), entry("Rice", "Dinner", 100, 0, "19:00")]);
  const { rhythm } = periodStats(days, { today: TODAY });
  assert.deepEqual(rhythm.meals.map((meal) => meal.meal), ["Lunch", "Dinner"]);
  assert.equal(rhythm.meals[0].average, 12 * 60 + 5);
});

const macros = (foodName, mealType, calories, protein, carbs, fat) => ({ foodName, mealType, calories, protein, carbs, fat, localTime: "12:00" });

test("meal shares give each nutrient's split across meals", () => {
  const days = dayRange(1, 3, () => [macros("Eggs", "Breakfast", 200, 30, 10, 20), macros("Rice", "Dinner", 600, 10, 90, 0), macros("Nuts", "Snack", 200, 10, 0, 30)]);
  const { shares } = periodStats(days, { today: TODAY });
  assert.equal(shares.days, 3);
  assert.deepEqual(shares.meals.map((row) => row.meal), ["Breakfast", "Dinner", "Snack"]);
  assert.deepEqual(shares.meals[0], { meal: "Breakfast", calories: 20, protein: 60, carbs: 10, fat: 40,
    amounts: { calories: 200, protein: 30, carbs: 10, fat: 20 } }); // Amounts are per day.
  assert.equal(shares.meals[1].fat, 0);
});

test("meal shares add up to exactly 100 in every column", () => {
  const days = dayRange(1, 3, () => [macros("A", "Breakfast", 100, 1, 1, 1), macros("B", "Lunch", 100, 1, 1, 1), macros("C", "Dinner", 100, 1, 1, 1)]);
  const { shares } = periodStats(days, { today: TODAY });
  for (const field of ["calories", "protein", "carbs", "fat"]) assert.equal(shares.meals.reduce((total, row) => total + row[field], 0), 100);
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

test("each listed food keeps its meals' ids, oldest first, so it can show their chosen icon", () => {
  const days = dayRange(1, 3, (ago) => [{ ...entry(ago === 2 ? "oat latte" : "Oat Latte", "Breakfast", 100), id: 10 - ago }, entry("Toast", "Lunch", 100)]);
  const stats = periodStats(days, { today: TODAY });
  assert.deepEqual(stats.foods.find((food) => food.name === "Oat Latte").entryIds, ["7", "8", "9"]);
  assert.deepEqual(stats.foods.find((food) => food.name === "Toast").entryIds, []);
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
  assert.deepEqual(snack.events.map(({ time }) => time).sort((a, b) => a - b), [23.5 * 60, 23.75 * 60, 24.25 * 60, 24.5 * 60]);
  assert.match(formatClock(24 * 60), /^12:00/);
  assert.match(formatClock(24 * 60 + 15), /^12:15/);
  const stats = periodStats(dayRange(1, 14, (ago) => { const weekend = [0, 6].includes(new Date(`${key(ago)}T12:00:00`).getDay());
    return [entry("Eggs", "Breakfast", 100, 0, "08:00"), weekend ? entry("Chips", "Snack", 100, 0, "00:20") : entry("Rice", "Dinner", 100, 0, "19:00")]; }), { span: 30, today: TODAY });
  assert.equal(stats.split.weekend.firstMeal, 8 * 60); // Saturday's late snack came after Friday's day ended.
});

test("today doesn't count toward usual times, and a missing time isn't midnight", () => {
  const days = dayRange(1, 2, () => [entry("Chips", "Snack", 100, 0, "15:00")]);
  days[key(0)] = { entries: [entry("Chips", "Snack", 100, 0, "09:00")] };
  assert.equal(periodStats(days, { today: TODAY }).rhythm, null); // Two days of snacks alone make no chart.
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
  assert.equal(stats.rhythm.meals[0].average, 19.25 * 60);
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
