// Everything on the Insights tab, worked out on the phone from logged days. Today is
// unfinished, so it appears in charts and foods but never in typical values. Days with
// nothing logged are gaps, never zeros, and a day with one meal logged doesn't count as
// a typical day, so forgotten meals don't read as light eating.
import { localDateKey } from "../nutritionStore.mjs";

const FIELDS = ["calories", "protein", "carbs", "fat"];
export const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];
const MIN_TYPICAL_DAYS = 3;
const MIN_MEAL_DAYS = 3;
const MAIN_MEALS = ["Breakfast", "Lunch", "Dinner"];
const BATCH_LOGGED = 20; // Minutes; meals that start closer than this were logged together.
const AXIS_START = 6 * 60, AXIS_END = 24 * 60;
// Fewer days than this on either side and a comparison would mislead.
const MIN_TO_COMPARE = { 7: 3, 30: 7, 365: 30 };
const MIN_WEEKEND_DAYS = 3, MIN_WEEKDAYS = 5;
const FOOD_LIMIT = 100; // Per nutrient, so a year's list stays readable.
const FOOD_FIELDS = ["count", "calories", "protein", "carbs", "fat"];
const MIN_GOAL_SCALE = 1.2, MAX_GOAL_SCALE = 2;
// A day runs from here to here the next morning, so a late snack isn't "earlier" than breakfast.
const DAY_START = 5 * 60;
const DAY = 24 * 60;

export function dateKeys(span, today = new Date(), offset = 0) {
  return Array.from({ length: span }, (_, index) =>
    localDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset - (span - 1 - index))));
}

const noon = (key) => new Date(`${key}T12:00:00`);
const mean = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
const sum = (entries, field) => entries.reduce((total, entry) => total + (Number(entry[field]) || 0), 0);
const mealOf = (entry) => entry.mealType ?? entry.meal_type;
const nameOf = (entry) => String(entry.foodName ?? entry.food_name ?? "").trim();
// Minutes since midnight. Dinner and snacks logged before 5 AM belong to the night before,
// so they count as after midnight; an early breakfast stays early.
const minutes = (time, lateNight = true) => {
  const [hours, mins] = String(time ?? "").split(":");
  if (!hours?.trim() || !Number.isFinite(Number(hours))) return null;
  const total = Number(hours) * 60 + (Number(mins) || 0);
  return lateNight && total < DAY_START ? total + DAY : total;
};
const LATE_MEALS = new Set(["Dinner", "Snack"]);
const timeOf = (entry) => minutes(entry.localTime ?? entry.local_time, LATE_MEALS.has(mealOf(entry)));
const entriesFor = (days, key) => days[key]?.entries ?? [];
const isLogged = (days, key) => entriesFor(days, key).length > 0;
const isComplete = (days, key) => new Set(entriesFor(days, key).map(mealOf)).size >= 2;
const dayTotal = (days, key, field) => sum(entriesFor(days, key), field);

// Value at a position between 0 and 1 of the sorted list, interpolated.
function quantile(values, position) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * position;
  const below = Math.floor(at);
  return sorted[below] + (sorted[Math.min(below + 1, sorted.length - 1)] - sorted[below]) * (at - below);
}
const median = (values) => quantile(values, 0.5);

const QUALIFIERS = /(?<![\p{L}\p{M}\p{N}])(steamed|cooked|plain|fresh|homemade|boiled|bowl of|cup of|glass of|slice of|piece of|a|an|the)(?![\p{L}\p{M}\p{N}])/gu;

// The same food under two names should count once: "White Rice", "steamed white rice!".
// Stays conservative, since "fried rice" and "rice" really are different foods.
export function foodKey(name) {
  const raw = String(name ?? "").normalize("NFKC").toLowerCase().trim();
  const base = raw.replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  // Emoji-only names have no letters to compare, so they stay as they are.
  if (!base) return raw;
  const trimmed = base.replace(QUALIFIERS, " ").replace(/\s+/g, " ").trim() || base;
  return trimmed.replace(/([a-z]{3,})(?<![su])s$/u, "$1");
}

const mostUsed = (spellings) => [...spellings.entries()].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))[0][0];

// Foods in the period with how often and how much, most eaten first, under the spelling
// used most. entryIds (oldest first) let a list show the icon chosen on those meals.
function foodTotals(days, keys) {
  const foods = new Map();
  for (const key of keys) {
    for (const entry of entriesFor(days, key)) {
      const name = nameOf(entry);
      if (!name) continue;
      const id = foodKey(name);
      const food = foods.get(id) ?? { id, count: 0, calories: 0, protein: 0, carbs: 0, fat: 0, entryIds: [], spellings: new Map() };
      food.count++;
      if (entry.id != null) food.entryIds.push(String(entry.id));
      food.calories += Number(entry.calories) || 0;
      food.protein += Number(entry.protein) || 0;
      food.carbs += Number(entry.carbs) || 0;
      food.fat += Number(entry.fat) || 0;
      food.spellings.set(name, (food.spellings.get(name) ?? 0) + 1);
      food.icon = { id: entry.id, iconId: entry.iconId ?? entry.icon_id, foodName: name, entryIds: food.entryIds };
      foods.set(id, food);
    }
  }
  return [...foods.values()].map(({ spellings, ...food }) => ({ ...food, name: mostUsed(spellings) }));
}

// The vegetables and fruits in the period, most often first. Foods logged before tagging
// existed, or typed in by hand, were never checked, so they're counted rather than
// assumed to have none.
function produceLists(days, keys) {
  const entries = keys.flatMap((key) => entriesFor(days, key));
  const checked = entries.filter((entry) => entry.ingredients && typeof entry.ingredients === "object");
  if (!checked.length) return null;
  const list = (group) => {
    const items = new Map();
    for (const entry of checked) {
      for (const name of Array.isArray(entry.ingredients[group]) ? entry.ingredients[group] : []) {
        const id = foodKey(name);
        const item = items.get(id) ?? { id, count: 0, spellings: new Map() };
        item.count++;
        item.spellings.set(name, (item.spellings.get(name) ?? 0) + 1);
        items.set(id, item);
      }
    }
    return [...items.values()].map(({ spellings, ...item }) => ({ ...item, name: mostUsed(spellings) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };
  return { vegetables: list("vegetables"), fruits: list("fruits"), unchecked: entries.length - checked.length };
}

function foodLists(days, keys, previousKeys, comparable, limit) {
  const earlier = new Set(foodTotals(days, previousKeys).map((food) => food.id));
  const foods = foodTotals(days, keys).map((food) => ({ ...food, isNew: comparable && !earlier.has(food.id) }));
  const ranked = (field) => [...foods].filter((food) => food[field] > 0)
    .sort((a, b) => b[field] - a[field] || a.name.localeCompare(b.name)).slice(0, limit);
  const total = (field) => foods.reduce((all, food) => all + food[field], 0);
  const by = (pick) => Object.fromEntries(FOOD_FIELDS.map((field) => [field, pick(field)]));
  return { foods: ranked("count"), foodsBy: by(ranked), foodTotals: by(total) };
}

// The period's days grouped by calendar month, oldest first.
function monthBlocks(keys) {
  const blocks = new Map();
  for (const key of keys) blocks.set(key.slice(0, 7), [...(blocks.get(key.slice(0, 7)) ?? []), key]);
  return [...blocks.values()];
}

// Dates are formatted once each, since building a formatter isn't free on a phone.
const FORMAT = {
  weekday: new Intl.DateTimeFormat("en-US", { weekday: "narrow" }),
  monthDay: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
  dayTitle: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }),
  monthLetter: new Intl.DateTimeFormat("en-US", { month: "narrow" }),
  monthShort: new Intl.DateTimeFormat("en-US", { month: "short" }),
  monthTitle: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }),
};

// The bars of a chart and their labels, worked out once for all four nutrients: a bar per
// day for a week or a month, a bar per calendar month for a year.
function chartFrame(keys) {
  if (keys.length > 30) {
    return monthBlocks(keys).map((block, index, all) => {
      const date = noon(block[0]);
      return { key: block[0], block, last: index === all.length - 1, label: FORMAT.monthLetter.format(date), title: FORMAT.monthTitle.format(date) };
    });
  }
  return keys.map((key, index) => {
    const date = noon(key);
    const fromEnd = keys.length - 1 - index;
    return { key, label: keys.length <= 7 ? FORMAT.weekday.format(date) : fromEnd % 7 === 3 ? FORMAT.monthDay.format(date) : null,
      title: FORMAT.dayTitle.format(date) };
  });
}

// One nutrient's values on a frame of days or months. Month bars average finished days with
// two or more meals, or the logged days if there are none. Partial bars are still changing
// or cut off, so they draw lighter: today, and months that aren't over, started partway or
// have no day with two meals. Days and months before someone's first log are marked, so the
// chart leaves them blank instead of showing them as missed.
function trend(days, frame, field, todayKey, firstLog) {
  return frame.map(({ key, block, last, label, title }) => {
    if (block) {
      const finished = block.filter((day) => isLogged(days, day) && day !== todayKey);
      const complete = finished.filter((day) => isComplete(days, day));
      return { key, value: mean((complete.length ? complete : finished).map((day) => dayTotal(days, day, field))),
        partial: last || !key.endsWith("-01") || !complete.length, before: firstLog == null || block[block.length - 1] < firstLog, label, title };
    }
    return { key, value: isLogged(days, key) ? dayTotal(days, key, field) : null, partial: key === todayKey,
      before: key !== todayKey && (firstLog == null || key < firstLog), label, title };
  });
}

function metric(days, { frame, complete, previousFrame, previousComplete, todayKey, finished, firstLog }, field) {
  const values = complete.map((key) => dayTotal(days, key, field));
  const enough = values.length >= MIN_TYPICAL_DAYS;
  return {
    average: finished.length ? mean(finished.map((key) => dayTotal(days, key, field))) : null,
    typical: enough ? median(values) : null,
    low: enough ? quantile(values, 0.25) : null,
    high: enough ? quantile(values, 0.75) : null,
    previous: previousComplete ? median(previousComplete.map((key) => dayTotal(days, key, field))) : null,
    chart: trend(days, frame, field, todayKey, firstLog),
    previousChart: previousComplete ? trend(days, previousFrame, field, todayKey, firstLog) : null,
  };
}

// A value as a whole percent of its goal, or null without both.
export const percentOfGoal = (value, goal) => value != null && Number(goal) > 0 ? Math.round(value / Number(goal) * 100) : null;

// How far past their goals a set of charts reaches, so charts can share one scale and
// each goal line sits at the same height. Rows are { points, goal }. Capped, since one
// huge day shouldn't flatten every other bar.
export function goalScale(rows) {
  const ratios = rows.flatMap(({ points, goal }) => goal ? points.map((point) => (point.value ?? 0) / goal) : []);
  return Math.min(MAX_GOAL_SCALE, Math.max(MIN_GOAL_SCALE, ...ratios));
}

// Earliest logged time for a meal on each day it was logged.
const mealTimes = (days, keys, meal) => keys.flatMap((key) => {
  const times = entriesFor(days, key).filter((entry) => mealOf(entry) === meal).map(timeOf).filter((value) => value != null);
  return times.length ? [Math.min(...times)] : [];
});

// Breakfast, lunch and dinner each get one time a day: the first food logged for it. When
// two of them start within minutes of each other, the day was logged in one go, so only the
// later one's time is kept, since logging late can only push times later.
function mainMealTimes(days, keys) {
  const times = Object.fromEntries(MAIN_MEALS.map((meal) => [meal, []]));
  for (const key of keys) {
    const first = MAIN_MEALS.map((meal) => {
      const all = entriesFor(days, key).filter((entry) => mealOf(entry) === meal).map(timeOf).filter((value) => value != null);
      return all.length ? Math.min(...all) : null;
    });
    first.forEach((time, index) => {
      if (time == null) return;
      const later = first.slice(index + 1).find((other) => other != null);
      if (later != null && later >= time && later - time < BATCH_LOGGED) return;
      times[MAIN_MEALS[index]].push({ key, time });
    });
  }
  return times;
}

// Every snack logged with a time is its own point on the day.
function snackTimes(days, keys) {
  return keys.flatMap((key) => entriesFor(days, key).filter((entry) => mealOf(entry) === "Snack").map(timeOf)
    .filter((value) => value != null).map((time) => ({ key, time })));
}

// When each meal happens. Every meal or snack is a point on the day, and a meal's average
// is its median time. Meals logged on too few days are listed separately so the detail
// page can say why they're missing.
function rhythm(days, finished) {
  const byMeal = { ...mainMealTimes(days, finished), Snack: snackTimes(days, finished) };
  const meals = [], tooFew = [];
  for (const meal of MEALS) {
    const events = byMeal[meal];
    const dayCount = new Set(events.map(({ key }) => key)).size;
    if (!dayCount) continue;
    // A meal needs a few days before its average means anything. Snacks have no average,
    // so they're all shown once any meal is on the chart, or once they span a few days.
    if (meal === "Snack") { if (dayCount < MIN_MEAL_DAYS && !meals.length) continue; }
    else if (dayCount < MIN_MEAL_DAYS) { tooFew.push({ meal, days: dayCount }); continue; }
    const times = events.map(({ time }) => time);
    // Snacks have no average: they happen whenever they happen, and each one is shown.
    meals.push(meal === "Snack" ? { meal, days: dayCount, events }
      : { meal, days: dayCount, events, average: median(times), low: quantile(times, 0.25), high: quantile(times, 0.75) });
  }
  if (!meals.length) return null;
  const all = meals.flatMap(({ events }) => events.map(({ time }) => time));
  const start = Math.min(AXIS_START, Math.floor(Math.min(...all) / 60) * 60);
  const end = Math.max(AXIS_END, Math.ceil(Math.max(...all) / 60) * 60);
  return { meals, tooFew, start, end };
}

// Whole percents that add up to exactly 100, or nulls if there's nothing to divide.
function wholeShares(values) {
  const total = values.reduce((all, value) => all + value, 0);
  if (!total) return values.map(() => null);
  const exact = values.map((value) => value / total * 100);
  const shares = exact.map(Math.floor);
  const short = 100 - shares.reduce((all, share) => all + share, 0);
  [...exact.keys()].sort((a, b) => (exact[b] - shares[b]) - (exact[a] - shares[a])).slice(0, short).forEach((index) => { shares[index]++; });
  return shares;
}

// How much of each nutrient each meal brings. Complete days only, since a day with one
// meal logged would make that meal look bigger than it is.
function mealShares(days, complete) {
  if (complete.length < MIN_TYPICAL_DAYS) return null;
  const entries = complete.flatMap((key) => entriesFor(days, key));
  const columns = FIELDS.map((field) => wholeShares(MEALS.map((meal) => sum(entries.filter((entry) => mealOf(entry) === meal), field))));
  const perDay = (meal, field) => sum(entries.filter((entry) => mealOf(entry) === meal), field) / complete.length;
  const meals = MEALS.map((meal, row) => ({ meal, ...Object.fromEntries(FIELDS.map((field, column) => [field, columns[column][row]])),
    amounts: Object.fromEntries(FIELDS.map((field) => [field, perDay(meal, field)])) }))
    .filter((row) => FIELDS.some((field) => row[field] > 0));
  return meals.length ? { days: complete.length, meals } : null;
}

// Complete days only, so a skipped weekend breakfast means skipped and not forgotten.
function weekSplit(days, complete) {
  const isWeekend = (key) => [0, 6].includes(noon(key).getDay());
  const side = (keys) => ({
    days: keys.length,
    calories: median(keys.map((key) => dayTotal(days, key, "calories"))),
    protein: median(keys.map((key) => dayTotal(days, key, "protein"))),
    firstMeal: median(keys.map((key) => Math.min(...entriesFor(days, key).map(timeOf).filter((value) => value != null))).filter(Number.isFinite)),
    dinner: median(mealTimes(days, keys, "Dinner")),
  });
  const weekdays = complete.filter((key) => !isWeekend(key)), weekends = complete.filter(isWeekend);
  return weekdays.length >= MIN_WEEKDAYS && weekends.length >= MIN_WEEKEND_DAYS ? { weekday: side(weekdays), weekend: side(weekends) } : null;
}

// Calendar columns like GitHub's: one per week, Sunday on top. Blank slots pad the ends,
// and a column is labelled when a new month starts in it. Days before the first log are
// marked as not started, since they weren't missed.
export function heatmapWeeks(keys, logged, started = []) {
  const blanks = noon(keys[0]).getDay();
  const cells = [...Array(blanks).fill(null), ...keys.map((key, index) => ({ key, logged: logged[index], started: started[index] ?? true }))];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  let lastMonth = null;
  for (let start = 0; start < cells.length; start += 7) {
    const days = cells.slice(start, start + 7);
    const date = noon(days.find(Boolean).key);
    const label = date.getMonth() === lastMonth ? null : FORMAT.monthShort.format(date);
    lastMonth = date.getMonth();
    weeks.push({ days, month: label });
  }
  // A leading sliver of a month has no room for its label before the next one.
  if (weeks.length > 2 && weeks[1].month) weeks[0].month = null;
  return weeks;
}

// days: { "YYYY-MM-DD": { entries } } as kept by the nutrition store.
// joined: the profile's join day ("2026-11-02" or a timestamp on that day). Days before it,
// and before the first log, weren't missed, so they're marked as not started.
export function periodStats(days = {}, { span = 7, today = new Date(), goals = {}, joined = null } = {}) {
  const keys = dateKeys(span, today);
  const todayKey = keys[keys.length - 1];
  const previousKeys = dateKeys(span, today, span);
  const logged = keys.filter((key) => isLogged(days, key));
  const finished = logged.filter((key) => key !== todayKey);
  const complete = finished.filter((key) => isComplete(days, key));
  const previousComplete = previousKeys.filter((key) => isComplete(days, key));
  const comparable = complete.length >= MIN_TO_COMPARE[span] && previousComplete.length >= MIN_TO_COMPARE[span];
  const firstLog = Object.keys(days).filter((key) => isLogged(days, key)).sort()[0];
  const frame = chartFrame(keys), previousFrame = comparable ? chartFrame(previousKeys) : null;
  const joinedKey = /^\d{4}-\d{2}-\d{2}/.test(String(joined ?? "")) ? String(joined).slice(0, 10) : null;
  const firstDay = [joinedKey, firstLog].filter(Boolean).sort()[0];
  return {
    span, keys, previousKeys: comparable ? previousKeys : null, todayKey, finishedDays: finished.length, completeDays: complete.length, comparable,
    loggedDays: keys.map((key) => isLogged(days, key)), started: keys.map((key) => key === todayKey || (firstDay != null && key >= firstDay)),
    daysLogged: logged.length,
    metrics: Object.fromEntries(FIELDS.map((field) => [field, metric(days, { frame, complete, previousFrame, previousComplete: comparable ? previousComplete : null,
      todayKey, finished, firstLog: firstDay }, field)])),
    rhythm: rhythm(days, finished),
    shares: mealShares(days, complete),
    // "New" means something over longer periods; over a week it would mark most foods.
    ...foodLists(days, keys, previousKeys, span > 7 && comparable, FOOD_LIMIT),
    produce: produceLists(days, keys),
    split: span > 7 ? weekSplit(days, complete) : null,
  };
}

export const hasAnyLog = (days = {}) => Object.keys(days).some((key) => isLogged(days, key));

export const formatNumber = (value, digits = 0) => value == null ? "–"
  : Number(value).toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// A time of day in the phone's own 12 or 24 hour style.
export function formatClock(mins) {
  if (mins == null) return "–";
  const rounded = Math.round(mins) % DAY;
  return new Date(2000, 0, 1, Math.floor(rounded / 60), rounded % 60)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/ /g, " ");
}

// To the nearest quarter hour, since a meal's time is usually when it was logged.
export const formatNearClock = (mins) => mins == null ? "–" : formatClock(Math.round(mins / 15) * 15);

// "Oct 26 – Nov 1", leaving out the month when both ends share it.
export function formatRange(keys) {
  const first = noon(keys[0]), last = noon(keys[keys.length - 1]);
  const month = (date) => FORMAT.monthShort.format(date);
  const year = first.getFullYear() !== last.getFullYear() ? `, ${first.getFullYear()}` : "";
  const end = first.getMonth() === last.getMonth() && !year ? `${last.getDate()}` : `${month(last)} ${last.getDate()}`;
  return `${month(first)} ${first.getDate()}${year} – ${end}${year ? `, ${last.getFullYear()}` : ""}`;
}
