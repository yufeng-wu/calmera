// Wall-clock minutes in the phone's current time zone, never UTC hours.
export const MEAL_TYPES = Object.freeze(["Breakfast", "Lunch", "Dinner", "Snack"]);
export const DEFAULT_MEAL_TIMES = Object.freeze({ Breakfast: 300, Lunch: 660, Dinner: 1020, Snack: 1320 });
export const MEAL_TIME_STEP = 15;

export function validMealTimes(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === MEAL_TYPES.length
    && MEAL_TYPES.every((meal, index) => Number.isInteger(value[meal])
      && value[meal] >= 0 && value[meal] < 1440 && value[meal] % MEAL_TIME_STEP === 0
      && (index === 0 || value[MEAL_TYPES[index - 1]] < value[meal]));
}
export function mealForLocalTime(date, times = DEFAULT_MEAL_TIMES) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || !validMealTimes(times)) {
    throw new Error("invalid_meal_times");
  }
  const minute = date.getHours() * 60 + date.getMinutes();
  return [...MEAL_TYPES].reverse().find(meal => minute >= times[meal]) || "Snack";
}
export function formatMealTime(minute) {
  // A fixed, non-DST UTC date formats a wall-clock value without moving its hour.
  return new Date(Date.UTC(2000, 0, 1, 0, minute)).toLocaleTimeString(undefined,
    { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}
export function mealTimeRange(meal, times) {
  const next = MEAL_TYPES[(MEAL_TYPES.indexOf(meal) + 1) % MEAL_TYPES.length];
  return `${formatMealTime(times[meal])} – ${formatMealTime(times[next])}${meal === "Snack" ? " (next day)" : ""}`;
}
export const sameMealTimes = (left, right) => Boolean(left && right && MEAL_TYPES.every(meal => left[meal] === right[meal]));
