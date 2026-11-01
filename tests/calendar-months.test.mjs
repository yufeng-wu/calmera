import test from "node:test";
import assert from "node:assert/strict";
import { calendarStart, isDaySelectable, listMonths, monthCells, monthRowCount, parseLocalDate } from "../lib/calendarMonths.mjs";


test("backend dates parse as local wall-clock days", () => {
  const date = parseLocalDate("2026-09-01T00:00:00.000Z");
  assert.deepEqual([date.getFullYear(), date.getMonth(), date.getDate()], [2026, 8, 1]);
  assert.equal(parseLocalDate("not a date"), null);
});

test("months run from the signup month through the current month across years", () => {
  const months = listMonths(new Date(2025, 10, 20), new Date(2026, 1, 3));
  assert.deepEqual(months.map(item => item.key), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("meals older than signup widen the calendar, and no data falls back to today", () => {
  const today = new Date(2026, 9, 31);
  assert.equal(calendarStart(new Date(2026, 8, 1), ["2026-06-02"], today).getMonth(), 5);
  assert.equal(calendarStart(new Date(2026, 8, 1), ["2026-10-02"], today).getMonth(), 8);
  assert.equal(calendarStart(null, [], today).getMonth(), 9);
});

test("month cells align the 1st under its weekday and rows fit the month", () => {
  const october = monthCells(2026, 9);
  assert.equal(october.filter(cell => cell === null).length, 4);
  assert.equal(october[4].getDate(), 1);
  assert.equal(monthRowCount(2026, 9), 5);
  assert.equal(monthRowCount(2026, 1), 4);
  assert.equal(monthRowCount(2026, 7), 6);
});

test("only days from signup through today are selectable", () => {
  const today = new Date(2026, 9, 31, 9);
  const signup = new Date(2026, 8, 15);
  assert.equal(isDaySelectable(new Date(2026, 9, 31, 23), signup, today), true);
  assert.equal(isDaySelectable(new Date(2026, 10, 1), signup, today), false);
  assert.equal(isDaySelectable(new Date(2026, 8, 15), signup, today), true);
  assert.equal(isDaySelectable(new Date(2026, 8, 14), signup, today), false);
  assert.equal(isDaySelectable(new Date(2020, 0, 1), null, today), true);
});
