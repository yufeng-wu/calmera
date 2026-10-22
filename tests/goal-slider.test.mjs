import test from "node:test";
import assert from "node:assert/strict";
import { goalInputValue, goalSaveValue, goalSliderBounds } from "../lib/goalSlider.mjs";

test("stored and survey decimal targets become whole-unit display values", () => {
  assert.deepEqual([2425.6, 50.25, "290.75", "88.00"].map(goalInputValue), ["2426", "50", "291", "88"]);
});
test("slider values and save payloads remain integers", () => {
  for (const value of [0, 25, 153.00000001, "6123.6"]) {
    assert.match(goalInputValue(value), /^\d+$/);
    assert.equal(Number.isInteger(goalSaveValue(value)), true);
  }
  assert.equal(goalSaveValue("6123.6"), 6124);
});
test("unset and invalid targets cannot become accidental zero or invalid JSON values", () => {
  for (const value of [null, undefined, "", " ", "invalid", NaN, Infinity]) {
    assert.equal(goalInputValue(value), "");
    assert.equal(goalSaveValue(value), undefined);
  }
});
test("slider range includes a rounded goal above the initial limit", () => {
  const goal = goalInputValue(6123.6);
  const bounds = goalSliderBounds(goal, 5000, 500);
  assert.ok(bounds.maximumValue >= Number(goal));
  assert.equal(bounds.minimumValue, 0);
});
