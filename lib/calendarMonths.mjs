import { localDateKey } from "./nutritionStore.mjs";

const pad = (value) => String(value).padStart(2, "0");
export const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

// Backend dates are wall-clock days, so they must not pass through UTC parsing.
export function parseLocalDate(value) {
  const [year, month, day] = String(value).split("T")[0].split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

// Signup bounds the calendar; older meals still widen it if they exist.
export function calendarStart(signUpDate, dateKeys, today) {
  const earliest = [...dateKeys].sort()[0];
  const candidates = [signUpDate, earliest ? parseLocalDate(earliest) : null, today].filter(Boolean);
  return new Date(Math.min(...candidates.map((date) => date.getTime())));
}

// The first month opens at the start date's week, since nothing before it can be picked; a week reaching back past the 1st stops there.
export function listMonths(start, end) {
  const months = [];
  for (let date = new Date(start.getFullYear(), start.getMonth(), 1); date <= end;
    date = new Date(date.getFullYear(), date.getMonth() + 1, 1)) {
    months.push({ key: monthKey(date), year: date.getFullYear(), month: date.getMonth(),
      firstDay: months.length ? 1 : Math.max(start.getDate() - start.getDay(), 1) });
  }
  return months;
}

// This month stops at the end of this week, or at its own end if that comes first: later days can't be logged yet.
function lastShownDay(year, month, today) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  if (year !== today.getFullYear() || month !== today.getMonth()) return lastDay;
  return Math.min(lastDay, today.getDate() + 6 - today.getDay());
}

// Leading blanks align the first day under its weekday; the grid has no trailing blanks.
export function monthCells(year, month, today = new Date(), firstDay = 1) {
  const blanks = Array.from({ length: new Date(year, month, firstDay).getDay() }, () => null);
  const days = Array.from({ length: lastShownDay(year, month, today) - firstDay + 1 }, (_, index) => new Date(year, month, firstDay + index));
  return [...blanks, ...days];
}

// Worked out rather than counted from the cells, since the calendar asks for it throughout a scroll.
export const monthRowCount = (year, month, today = new Date(), firstDay = 1) =>
  Math.ceil((new Date(year, month, firstDay).getDay() + lastShownDay(year, month, today) - firstDay + 1) / 7);

export function isDaySelectable(date, signUpDate, today = new Date()) {
  const key = localDateKey(date);
  if (key > localDateKey(today)) return false;
  return !signUpDate || key >= localDateKey(signUpDate);
}
