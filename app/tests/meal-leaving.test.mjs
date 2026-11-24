import test from "node:test";
import assert from "node:assert/strict";
import { groupLeaving, rowLeaving, withLeaving, withoutLeaving } from "../src/lib/mealLeaving.mjs";

// Deleting on Today: the meal folds away first. The last meal of a group takes the heading with it.
const dinner = [{ id: 1 }, { id: 2 }, { id: 3 }];

test("a row folds on its own while others stay in its group", () => {
  for (const id of [1, 2, 3]) {
    const leaving = withLeaving(new Set(), id);
    assert.equal(groupLeaving(dinner, leaving), false);
    assert.equal(rowLeaving(id, leaving, false), true);
    for (const other of dinner.filter((e) => e.id !== id)) assert.equal(rowLeaving(other.id, leaving, false), false);
  }
});

test("the only meal in a group folds with its heading, not on its own", () => {
  const only = [{ id: 7 }];
  const leaving = withLeaving(new Set(), 7);
  const whole = groupLeaving(only, leaving);
  assert.equal(whole, true);
  assert.equal(rowLeaving(7, leaving, whole), false);
});

test("the group folds once every one of its meals is leaving", () => {
  let leaving = new Set();
  for (const { id } of dinner) leaving = withLeaving(leaving, id);
  assert.equal(groupLeaving(dinner, leaving), true);
  assert.equal(groupLeaving([], leaving), false);
});

test("leaving sets change only when they must, so unchanged groups don't re-render", () => {
  const leaving = withLeaving(new Set(), 1);
  assert.equal(withLeaving(leaving, 1), leaving);
  assert.equal(withoutLeaving(leaving, [9]), leaving);
  const after = withoutLeaving(leaving, [1]);
  assert.notEqual(after, leaving);
  assert.equal(after.size, 0);
  assert.equal(leaving.has(1), true);
});
