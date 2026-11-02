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

test("this month stops at the end of this week, and other months stay whole", () => {
  const lastShown = (year, month, today) => monthCells(year, month, today).at(-1).getDate();
  const wednesday = new Date(2026, 10, 11);
  assert.equal(lastShown(2026, 10, wednesday), 14);
  assert.equal(monthRowCount(2026, 10, wednesday), 2);
  for (const day of [1, 7]) {
    assert.equal(lastShown(2026, 10, new Date(2026, 10, day)), 7);
    assert.equal(monthRowCount(2026, 10, new Date(2026, 10, day)), 1);
  }
  assert.equal(lastShown(2026, 9, new Date(2026, 9, 1)), 3);
  assert.equal(monthRowCount(2026, 9, new Date(2026, 9, 1)), 1);
  assert.equal(lastShown(2026, 9, wednesday), 31);
  assert.equal(monthRowCount(2026, 9, wednesday), 5);
});

test("a week running into next month stops at this month's end", () => {
  const monday = new Date(2026, 10, 30);
  assert.equal(monthCells(2026, 10, monday).at(-1).getDate(), 30);
  assert.equal(monthRowCount(2026, 10, monday), 5);
});

test("the row count always matches the cells shown", () => {
  for (let day = 1; day <= 31; day++) {
    const today = new Date(2026, 9, day);
    const cells = monthCells(2026, 9, today);
    assert.equal(monthRowCount(2026, 9, today), Math.ceil(cells.length / 7));
    assert.ok(cells.at(-1).getDay() === 6 || cells.at(-1).getDate() === 31);
    assert.ok(cells.at(-1) >= today);
  }
});

test("the first month opens at the start date's week, and later months stay whole", () => {
  const firstDays = (start, end) => listMonths(start, end).map(item => item.firstDay);
  assert.deepEqual(firstDays(new Date(2026, 9, 31), new Date(2026, 11, 2)), [25, 1, 1]);
  assert.deepEqual(firstDays(new Date(2026, 10, 18), new Date(2026, 10, 18)), [15]);
  assert.deepEqual(firstDays(new Date(2026, 10, 1), new Date(2026, 10, 1)), [1]);
});

test("a start week reaching back into the month before stops at the 1st", () => {
  const [december] = listMonths(new Date(2026, 11, 1), new Date(2026, 11, 1));
  assert.equal(december.firstDay, 1);
  const cells = monthCells(2026, 11, new Date(2026, 11, 1), december.firstDay);
  assert.deepEqual(cells.slice(0, 3).map(cell => cell?.getDate() ?? null), [null, null, 1]);
  assert.equal(cells.at(-1).getDate(), 5);
});

test("a trimmed month shows only the weeks from its first day", () => {
  const november = new Date(2026, 10, 1);
  assert.deepEqual(monthCells(2026, 9, november, 25).map(cell => cell.getDate()), [25, 26, 27, 28, 29, 30, 31]);
  assert.equal(monthRowCount(2026, 9, november, 25), 1);
  const thisMonth = monthCells(2026, 10, new Date(2026, 10, 18), 15);
  assert.deepEqual([thisMonth[0].getDate(), thisMonth.at(-1).getDate()], [15, 21]);
  assert.equal(monthRowCount(2026, 10, new Date(2026, 10, 18), 15), 1);
  assert.equal(monthRowCount(2026, 10, new Date(2026, 10, 25), 15), 2);
});

test("the row count matches the cells for every signup day", () => {
  const today = new Date(2026, 10, 3);
  for (let day = 1; day <= 31; day++) {
    const [{ year, month, firstDay }] = listMonths(new Date(2026, 9, day), today);
    const cells = monthCells(year, month, today, firstDay);
    assert.equal(monthRowCount(year, month, today, firstDay), Math.ceil(cells.length / 7));
    assert.ok(cells.includes(null) ? firstDay === 1 : cells[0].getDay() === 0);
    assert.ok(cells.some(cell => cell?.getDate() === day));
  }
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
