import { localDateKey } from "./nutritionStore.mjs";

const pad = (value) => String(value).padStart(2, "0");
export const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

// Backend dates are wall-clock days, so they must not pass through UTC parsing.
export function parseLocalDate(value) {
  const [year, month, day] = String(value).split("T")[0].split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

// The signup month bounds the calendar; older meals still widen it if they exist.
export function calendarStart(signUpDate, dateKeys, today) {
  const earliest = [...dateKeys].sort()[0];
  const candidates = [signUpDate, earliest ? parseLocalDate(earliest) : null, today].filter(Boolean);
  return new Date(Math.min(...candidates.map((date) => date.getTime())));
}

export function listMonths(start, end) {
  const months = [];
  for (let date = new Date(start.getFullYear(), start.getMonth(), 1); date <= end;
    date = new Date(date.getFullYear(), date.getMonth() + 1, 1)) {
    months.push({ key: monthKey(date), year: date.getFullYear(), month: date.getMonth() });
  }
  return months;
}

// Leading blanks align the 1st under its weekday; the grid has no trailing blanks.
export function monthCells(year, month) {
  const blanks = Array.from({ length: new Date(year, month, 1).getDay() }, () => null);
  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => new Date(year, month, index + 1));
  return [...blanks, ...days];
}

export const monthRowCount = (year, month) => Math.ceil(monthCells(year, month).length / 7);

export function isDaySelectable(date, signUpDate, today = new Date()) {
  const key = localDateKey(date);
  if (key > localDateKey(today)) return false;
  return !signUpDate || key >= localDateKey(signUpDate);
}
