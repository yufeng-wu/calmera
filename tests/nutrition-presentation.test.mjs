import test from "node:test";
import assert from "node:assert/strict";
import { createNutritionStore, EMPTY_DAY, normalizeDay } from "../lib/nutritionStore.mjs";
import { BUDDY_FACES, buddyFace, buddyMood, calendarDayStatus, daySeed, emptyTodayGreeting, nutritionViewState, retryNutritionError } from "../lib/nutritionPresentation.mjs";

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

test("the empty Today greets by the hour, and says hello on the first day", () => {
  const title = (hour, firstDay) => emptyTodayGreeting(hour, firstDay).title;
  assert.equal(title(4), "Late-night bite?");
  assert.equal(title(5), "Morning! What's for breakfast?");
  assert.equal(title(11), "Lunchtime! What looks good?");
  assert.equal(title(14), "Snack o'clock?");
  assert.equal(title(17), "What's for dinner?");
  assert.equal(title(22), "Late-night bite?");
  assert.equal(title(9, true), "Hi! What's your first bite?");
});

test("greetings vary from day to day but hold within a day", () => {
  const days = [new Date(2026, 10, 1), new Date(2026, 10, 2), new Date(2026, 10, 3), new Date(2026, 10, 4)];
  const seeds = days.map(daySeed);
  assert.equal(new Set(seeds).size, 4);
  assert.equal(daySeed(new Date(2026, 10, 1, 7)), daySeed(new Date(2026, 10, 1, 21)));
  const titles = new Set(seeds.map(seed => emptyTodayGreeting(9, false, seed).title));
  assert.ok(titles.size > 1);
  for (const title of titles) assert.match(title, /^(Morning|Good morning|Rise and dine)/);
});

test("the orange only says text emojis from its list, at random, never twice in a row", () => {
  assert.equal(new Set(BUDDY_FACES).size, BUDDY_FACES.length);
  for (const face of BUDDY_FACES) assert.doesNotMatch(face, /[a-z]{2}/i);
  const said = [];
  let previous = null;
  for (let i = 0; i < 200; i += 1) {
    const face = buddyFace(previous);
    assert.ok(BUDDY_FACES.includes(face));
    assert.notEqual(face, previous);
    said.push(face);
    previous = face;
  }
  assert.ok(new Set(said).size > BUDDY_FACES.length / 2);
  // Every face can come up, the first and the last of the list included.
  assert.equal(buddyFace(null, () => 0), BUDDY_FACES[0]);
  assert.equal(buddyFace(null, () => 0.9999), BUDDY_FACES.at(-1));
  assert.equal(buddyFace(BUDDY_FACES[0], () => 0), BUDDY_FACES[1]);
});

test("the orange's mood follows the day", () => {
  assert.equal(buddyMood({ calories: 430, goal: 1800 }), "awake");
  assert.equal(buddyMood({ calories: 824, goal: 2000, loggedMeals: ["Breakfast", "Lunch"] }), "awake");
  assert.equal(buddyMood({ calories: 1700, goal: 1800 }), "happy");
  assert.equal(buddyMood({ calories: 600, goal: 1800, loggedMeals: ["Breakfast", "Dinner"] }), "happy");
  assert.equal(buddyMood({ calories: 2100, goal: 1800 }), "happy");
  assert.equal(buddyMood({ calories: 500, goal: null }), "awake");
});
