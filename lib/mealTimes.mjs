// Which meal a new log defaults to, from the phone's local time of day (wall-clock minutes, never UTC hours).
// The person can always pick another meal before saving; these starts are fixed.
export const MEAL_TYPES = Object.freeze(["Breakfast", "Lunch", "Dinner", "Snack"]);
// Breakfast from 5 AM, lunch from 11 AM, dinner from 5 PM, and a snack from 10 PM until breakfast.
export const MEAL_STARTS = Object.freeze({ Breakfast: 300, Lunch: 660, Dinner: 1020, Snack: 1320 });

export function mealForLocalTime(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error("invalid_meal_time");
  const minute = date.getHours() * 60 + date.getMinutes();
  return [...MEAL_TYPES].reverse().find(meal => minute >= MEAL_STARTS[meal]) || "Snack";
}
