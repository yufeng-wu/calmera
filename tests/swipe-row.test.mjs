import test from "node:test";
import assert from "node:assert/strict";
import { CLOSED, PHASE, dragPosition, pressIsTap, releaseTarget, rowTouch, scrollCloses, tapCloses } from "../lib/swipeRow.mjs";

// A meal row on Today: swipe left for Delete. The owner's phone showed rows springing shut the moment the finger
// lifted, on every swipe: the touch that opened the row also closed it.
const WIDTH = 84;
const after = (state, ...events) => events.reduce(rowTouch, state);
const OPEN = after(CLOSED, "opened", "rested");

test("the swipe that opens a row can't also tap it shut, in whatever order the lift is reported", () => {
  // The drag ends and opens the row, then the same lift arrives as a tap.
  assert.equal(tapCloses(after(CLOSED, "down", "drag", "release", "opened")), false);
  // The row is told it is open before the drag is told it ended.
  assert.equal(tapCloses(after(CLOSED, "down", "drag", "opened", "release")), false);
  // The tap is reported first.
  assert.equal(tapCloses(after(CLOSED, "down", "drag")), false);
  // The touch is announced a second time part-way through the drag.
  assert.equal(tapCloses(after(CLOSED, "down", "drag", "down", "release", "opened")), false);
  assert.equal(tapCloses(after(CLOSED, "down", "drag", "release", "down", "opened")), false);
});

test("a touch reported again after the lift, while the row is still springing open, can't close it", () => {
  assert.equal(tapCloses(after(CLOSED, "touch", "drag", "release", "opened", "down")), false);
  assert.equal(tapCloses(after(CLOSED, "touch", "drag", "opened", "release", "touch")), false);
  // Once it has come to rest, a new tap does close it.
  assert.equal(tapCloses(after(CLOSED, "touch", "drag", "release", "opened", "rested", "touch")), true);
});

test("the lift that ends a swipe is not a press on the card; a tap is", () => {
  // The swipe opened the row, then its lift reaches the card's press handler.
  assert.equal(pressIsTap(after(CLOSED, "touch", "drag", "release", "opened")), false);
  assert.equal(pressIsTap(after(CLOSED, "touch", "drag", "opened", "release", "down")), false);
  // A plain tap on a closed row expands it.
  assert.equal(pressIsTap(after(CLOSED, "touch", "down", "release")), true);
  // The next touch after a swipe starts clean.
  assert.equal(pressIsTap(after(CLOSED, "touch", "drag", "release", "opened", "rested", "touch")), true);
});

test("a row opened by holding stays open when the finger lifts", () => {
  assert.equal(tapCloses(after(CLOSED, "down", "opened")), false);
});

test("tapping a row that rests open closes it", () => {
  assert.equal(tapCloses(after(OPEN, "down")), true);
  assert.equal(tapCloses(after(OPEN, "touch")), true);
  // And the next swipe starts clean.
  assert.deepEqual(after(OPEN, "touch", "closed"), CLOSED);
});

test("dragging an open row is a drag, not a tap", () => {
  assert.equal(tapCloses(after(OPEN, "down", "drag", "release")), false);
  assert.equal(tapCloses(after(OPEN, "down", "drag", "down", "release")), false);
  // A later, separate tap still closes it.
  assert.equal(tapCloses(after(OPEN, "down", "drag", "release", "down")), true);
});

test("a row that isn't open has nothing for a tap to close", () => {
  assert.equal(tapCloses(after(CLOSED, "down")), false);
  assert.equal(tapCloses(after(OPEN, "down", "closed")), false);
});

test("a row follows the finger, slows once Delete is out, and never moves right of closed", () => {
  const drag = { open: false, width: WIDTH, overshoot: true, overshootFriction: 9 };
  assert.equal(dragPosition(-30, drag), -30);
  assert.equal(dragPosition(-WIDTH, drag), -WIDTH);
  assert.equal(dragPosition(-WIDTH - 90, drag), -WIDTH - 10);
  assert.equal(dragPosition(40, drag), 0);
  // Reduce Motion: no stretch past Delete.
  assert.equal(dragPosition(-WIDTH - 90, { ...drag, overshoot: false }), -WIDTH);
  // An open row starts from open: a push right closes it under the finger, a pull left stretches.
  assert.equal(dragPosition(30, { ...drag, open: true }), -WIDTH + 30);
  assert.equal(dragPosition(200, { ...drag, open: true }), 0);
  assert.equal(dragPosition(-18, { ...drag, open: true }), -WIDTH - 2);
});

test("a row pulled past the threshold stays open however the lift is reported", () => {
  const pulled = { open: false, drag: -90, width: WIDTH, threshold: 22 };
  // The phone's seven swipes: fast flicks still moving left, and one held still for two seconds.
  for (const velocity of [-1700, -1100, -160, 0]) assert.equal(releaseTarget({ ...pulled, velocity }), -WIDTH);
  // A lift that reports no speed, or nonsense, still leaves the row where the finger pulled it.
  for (const velocity of [undefined, NaN, Infinity]) assert.equal(releaseTarget({ ...pulled, velocity }), -WIDTH);
});

test("a short pull closes again unless it was flicked, and a flick back closes a long pull", () => {
  const row = { open: false, width: WIDTH, threshold: 22 };
  assert.equal(releaseTarget({ ...row, drag: -15, velocity: 0 }), 0);
  assert.equal(releaseTarget({ ...row, drag: -15, velocity: -400 }), -WIDTH);
  assert.equal(releaseTarget({ ...row, drag: -60, velocity: 1200 }), 0);
});

test("an open row closes when pushed right past the threshold, and not for less", () => {
  const row = { open: true, width: WIDTH, threshold: 22 };
  assert.equal(releaseTarget({ ...row, drag: 10, velocity: 0 }), -WIDTH);
  assert.equal(releaseTarget({ ...row, drag: 40, velocity: 0 }), 0);
  assert.equal(releaseTarget({ ...row, drag: 5, velocity: 600 }), 0);
  assert.equal(releaseTarget({ ...row, drag: -30, velocity: -300 }), -WIDTH);
});

test("a page starting to scroll closes a row resting open, never one this touch is opening", () => {
  assert.equal(scrollCloses(PHASE.open), true);
  for (const phase of [PHASE.dragging, PHASE.opening, PHASE.closing, PHASE.closed]) assert.equal(scrollCloses(phase), false);
});
