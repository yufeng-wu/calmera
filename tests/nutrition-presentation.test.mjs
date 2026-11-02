import test from "node:test";
import assert from "node:assert/strict";
import { createNutritionStore, EMPTY_DAY, normalizeDay } from "../lib/nutritionStore.mjs";
import { buddyState, calendarDayStatus, daySeed, emptyTodayGreeting, nutritionViewState, retryNutritionError } from "../lib/nutritionPresentation.mjs";

const date = "2026-10-19";
const meal = { id: 1, food_name: "Synthetic banana", calories: 105 };
const day = normalizeDay({ foodEntries: [meal], dailyTotals: { calories: 105 } });
const snapshot = overrides => ({ days: {}, errors: {}, historyLoaded: false, ...overrides });

test("a cold history loads without claiming an empty day", () => {
  const view = nutritionViewState(snapshot(), date, true);
  assert.equal(view.day, undefined);
  assert.equal(view.historyLoading, true);
  assert.equal(view.loading, true);
  assert.equal(view.profileError, null);
  assert.deepEqual(calendarDayStatus(undefined, 2000, { historyAvailable: false }), {
    text: "Meal status unavailable", goalStatus: null,
  });
});

test("profile failure preserves loaded meals and does not block history", () => {
  const view = nutritionViewState(snapshot({ days: { [date]: day }, historyLoaded: true,
    errors: { profile: "Synthetic profile failure" } }), date, true);
  assert.equal(view.day, day);
  assert.equal(view.profileError, "Synthetic profile failure");
  assert.equal(Boolean(view.error), false);
  assert.equal(view.loading, false);
  assert.equal(view.historyLoading, false);
});

test("a known empty history remains empty rather than loading after profile failure", () => {
  const view = nutritionViewState(snapshot({ historyLoaded: true,
    errors: { profile: "Synthetic profile failure" } }), date, true);
  assert.equal(view.day, EMPTY_DAY);
  assert.equal(view.historyLoading, false);
  assert.equal(view.loading, false);
  assert.equal(view.profileError, "Synthetic profile failure");
  assert.equal(calendarDayStatus(view.day, null).text, "No food entries recorded");
});

test("a failed refresh stays silent while its data is on screen", () => {
  const errors = { profile: "Synthetic profile failure", history: "Synthetic meal failure", [`day:${date}`]: "Synthetic day failure" };
  const loaded = snapshot({ days: { [date]: day }, historyLoaded: true, profile: { calorieGoal: 2000 }, errors });
  for (const history of [true, false]) {
    const view = nutritionViewState(loaded, date, history);
    assert.equal(view.day, day);
    assert.equal(view.error, null);
    assert.equal(view.profileError, null);
    assert.equal(view.loading, false);
  }
});

test("a failure with nothing to show still offers a retry", () => {
  const failed = snapshot({ errors: { profile: "Synthetic profile failure", [`day:${date}`]: "Synthetic day failure" } });
  const today = nutritionViewState(failed, date);
  assert.equal(today.error, "Synthetic day failure");
  assert.equal(today.profileError, "Synthetic profile failure");
  assert.equal(today.loading, false);
  const onlyToday = snapshot({ days: { [date]: day }, errors: { history: "Synthetic meal failure" } });
  assert.equal(nutritionViewState(onlyToday, date).error, null);
  assert.equal(nutritionViewState(onlyToday, date, true).error, "Synthetic meal failure");
});

test("explicit profile retry clears its error without discarding meals or fetching history again", async () => {
  const store = createNutritionStore({ ownerKey: "synthetic-review" });
  await store.loadHistory(async () => ({ [date]: { foodEntries: [meal], dailyTotals: { calories: 105 } } }));
  await assert.rejects(store.loadProfile(async () => { throw Error("synthetic_profile_failure"); }));
  assert.ok(nutritionViewState(store.getSnapshot(), date, true).profileError);
  let resolve;
  const retry = retryNutritionError(nutritionViewState(store.getSnapshot(), date, true), {
    refresh: () => assert.fail("a profile-only retry must not reload meals"),
    refreshProfile: () => store.loadProfile(() => new Promise(done => { resolve = done; }), { force: true }),
  });
  await Promise.resolve();
  const during = nutritionViewState(store.getSnapshot(), date, true);
  assert.equal(during.day.entries[0].foodName, "Synthetic banana");
  assert.equal(during.historyLoading, false);
  resolve({ calorieGoal: 2000 });
  await retry;
  const after = nutritionViewState(store.getSnapshot(), date, true);
  assert.equal(after.profileError, null);
  assert.equal(after.day.entries[0].id, 1);
  assert.equal(store.getDiagnostics().historyRequests, 1);
  assert.equal(store.getDiagnostics().profileRequests, 2);
  store.dispose();
});

test("calendar describes a historical goal instead of the current goal", () => {
  const historical = normalizeDay({ foodEntries: [meal], dailyTotals: { calories: 105 }, goals: { calorieGoal: 100 } });
  assert.deepEqual(calendarDayStatus(historical, 2000), {
    text: "1 food entry recorded; 105 of 100 calories, 5 over goal", goalStatus: "above",
  });
  assert.deepEqual(calendarDayStatus(day, 105), {
    text: "1 food entry recorded; 105 of 105 calories, within goal", goalStatus: "within",
  });
});

test("calendar describes entry counts independently of unavailable goals", () => {
  const two = normalizeDay({ foodEntries: [meal, { ...meal, id: 2 }] });
  assert.deepEqual(calendarDayStatus(two, null), { text: "2 food entries recorded", goalStatus: null });
  assert.deepEqual(calendarDayStatus(day, "unavailable"), { text: "1 food entry recorded", goalStatus: null });
});

test("cached dates keep their status even if a later history refresh is unavailable", () => {
  assert.deepEqual(calendarDayStatus(day, 2000, { historyAvailable: false }), {
    text: "1 food entry recorded; 105 of 2,000 calories, within goal", goalStatus: "within",
  });
});

test("retry prioritizes the existing combined refresh when meals also failed", async () => {
  const calls = [];
  await retryNutritionError({ error: "Synthetic meal failure", profileError: "Synthetic profile failure" }, {
    refresh: async () => calls.push("combined"), refreshProfile: () => assert.fail("combined retry already refreshes profile"),
  });
  assert.deepEqual(calls, ["combined"]);
});

test("retry without an error performs no request", async () => {
  await retryNutritionError({}, {
    refresh: () => assert.fail("no meal failure"), refreshProfile: () => assert.fail("no profile failure"),
  });
});

test("the empty Today greets by the hour, and says hello on signup day", () => {
  const title = (hour, signupDay) => emptyTodayGreeting(hour, signupDay).title;
  assert.equal(title(4), "Late-night bite?");
  assert.equal(title(5), "Morning! What's for breakfast?");
  assert.equal(title(11), "Lunchtime! What looks good?");
  assert.equal(title(14), "Snack o'clock?");
  assert.equal(title(17), "What's for dinner?");
  assert.equal(title(22), "Late-night bite?");
  assert.equal(title(9, true), "Hi! What's your first bite?");
});

test("greetings and lines vary from day to day but hold within a day", () => {
  const days = [new Date(2026, 10, 1), new Date(2026, 10, 2), new Date(2026, 10, 3), new Date(2026, 10, 4)];
  const seeds = days.map(daySeed);
  assert.equal(new Set(seeds).size, 4);
  assert.equal(daySeed(new Date(2026, 10, 1, 7)), daySeed(new Date(2026, 10, 1, 21)));
  const titles = new Set(seeds.map(seed => emptyTodayGreeting(9, false, seed).title));
  assert.ok(titles.size > 1);
  for (const title of titles) assert.match(title, /^(Morning|Good morning|Rise and dine)/);
  const lines = new Set(seeds.map(seed => buddyState({ calories: 300, goal: 1800, seed }).lines[0]));
  assert.ok(lines.size > 1);
  assert.deepEqual(buddyState({ calories: 300, goal: 1800, seed: 5 }).lines, buddyState({ calories: 300, goal: 1800, seed: 5 }).lines);
});

test("the orange has something to say in every moment, including a text emoji", () => {
  const cases = [{ calories: 0 }, { calories: 300 }, { calories: 950 }, { calories: 1700 }, { calories: 2100 }, { calories: 0, past: true }, { calories: 500, past: true }];
  const moments = cases.map(day => {
    const { moment, lines } = buddyState({ goal: 1800, ...day });
    assert.equal(new Set(lines).size, lines.length);
    assert.ok(lines.some(line => !/[a-z]{3}/i.test(line) || /_/.test(line)), moment);
    return moment;
  });
  assert.deepEqual(moments, ["empty", "first", "midway", "done", "over", "asleep", "past"]);
});

test("the orange's mood follows the day", () => {
  const { moment, mood, progress } = buddyState({ calories: 430, goal: 1800 });
  assert.deepEqual({ moment, mood, progress }, { moment: "first", mood: "awake", progress: 430 / 1800 });
  assert.equal(buddyState({ calories: 950, goal: 1800 }).moment, "midway");
  assert.equal(buddyState({ calories: 1700, goal: 1800 }).mood, "happy");
  assert.equal(buddyState({ calories: 600, goal: 1800, loggedMeals: ["Breakfast", "Dinner"] }).moment, "done");
  const over = buddyState({ calories: 2100, goal: 1800 });
  assert.equal(over.moment, "over");
  assert.equal(over.mood, "happy");
  assert.equal(over.progress, 1);
  assert.equal(buddyState({ calories: 500, goal: null }).moment, "first");
});
