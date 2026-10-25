// Per-day series for the dashboard rows. null marks a day with no data, so
// averages and charts never treat a missed log as a zero.
import { localDateKey } from "../nutritionStore.mjs";

export function dateKeys(span, today = new Date(), offset = 0) {
  return Array.from({ length: span }, (_, index) =>
    localDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset - (span - 1 - index))));
}

const minutes = (time = "") => {
  const [hours, mins] = String(time).split(":").map(Number);
  return Number.isFinite(hours) ? hours * 60 + (mins || 0) : null;
};

const snacks = (entries) => entries.filter((entry) => (entry.mealType ?? entry.meal_type) === "Snack");
// Earliest logged time for that meal on the day, or null if it wasn't logged.
const mealTime = (type) => (entries) => {
  const times = entries.filter((entry) => (entry.mealType ?? entry.meal_type) === type)
    .map((entry) => minutes(entry.localTime)).filter((value) => value != null);
  return times.length ? Math.min(...times) : null;
};

export function nutritionSeries(days = {}, keys) {
  const pick = (fn) => keys.map((key) => days[key]?.entries?.length ? fn(days[key].entries) : null);
  const sum = (field) => (entries) => Math.round(entries.reduce((total, entry) => total + (Number(entry[field]) || 0), 0));
  return {
    calories: pick(sum("calories")),
    protein: pick(sum("protein")),
    carbs: pick(sum("carbs")),
    fat: pick(sum("fat")),
    logged: keys.map((key) => days[key]?.entries?.length ? 1 : null),
    breakfast: pick(mealTime("Breakfast")), lunch: pick(mealTime("Lunch")), dinner: pick(mealTime("Dinner")),
    // A logged day with no snacks counts as zero; an unlogged day stays null.
    snackCalories: pick((entries) => Math.round(snacks(entries).reduce((total, entry) => total + (Number(entry.calories) || 0), 0))),
    snackCount: pick((entries) => snacks(entries).length),
  };
}

// Apple Health arrives as { dates, series }; align it to the dashboard's keys.
export function healthSeries(health, keys) {
  const index = new Map((health?.dates || []).map((date, position) => [date, position]));
  const align = (name) => keys.map((key) => {
    const value = health?.series?.[name]?.[index.get(key)];
    return typeof value === "number" && value >= 0 ? value : null;
  });
  return { activeEnergy: align("activeEnergy"), steps: align("steps"), exerciseMinutes: align("exerciseMinutes"),
    sleepHours: align("sleepHours"), weight: align("weight") };
}

export function average(values) {
  const present = values.filter((value) => value != null);
  return present.length ? present.reduce((total, value) => total + value, 0) / present.length : null;
}
export const count = (values) => values.filter((value) => value != null).length;
export const latest = (values) => [...values].reverse().find((value) => value != null) ?? null;

export function change(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / previous;
}

export const formatNumber = (value, digits = 0) => value == null ? "–"
  : Number(value).toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const formatClock = (mins) => mins == null || mins >= 9999 ? "–"
  : `${Math.floor(mins / 60)}:${String(Math.round(mins % 60)).padStart(2, "0")}`;
