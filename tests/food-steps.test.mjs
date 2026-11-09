import test from "node:test";
import assert from "node:assert/strict";
import { foodSteps, MOST_STEPS } from "../lib/foodSteps.mjs";

// The front hill's ridge as HillScene draws it (400 units wide, 200 units to 190 points), to check steps stay on it.
const bezier = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
const ridgeAt = (x, width) => {
  const target = x * 400 / width;
  if (target > 215) return (76 + (target - 215) * (150 - 76) / 185) * 190 / 200;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (bezier(0, 50, 150, 215, mid) < target) lo = mid; else hi = mid;
  }
  return bezier(118, 58, 52, 76, (lo + hi) / 2) * 190 / 200;
};
// Where TodayScene seats the orange: her centre 106 points in, her base sunk 7 points into the hill.
const seatFor = (width) => ({ x: 106, y: ridgeAt(106, width) + 7, width });
const WIDTHS = [375, 390, 393, 402, 430, 440];
const days = Array.from({ length: 400 }, (_, i) => { const d = new Date(2026, 0, 1 + i); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); });

test("one step per food, up to the most the hill shows", () => {
  const seat = seatFor(402);
  assert.deepEqual(foodSteps({ count: 0, seat, width: 402 }), []);
  assert.equal(foodSteps({ count: 1, seat, width: 402 }).length, 1);
  assert.equal(foodSteps({ count: 5, seat, width: 402 }).length, 5);
  assert.equal(foodSteps({ count: 30, seat, width: 402 }).length, MOST_STEPS);
});

test("the newest step is at her feet and older ones run down the hill, fainter as they go", () => {
  const seat = seatFor(402);
  const steps = foodSteps({ count: MOST_STEPS, seat, width: 402, seed: days[3] });
  const away = steps.map(({ x, y }) => Math.hypot(x - seat.x, y - seat.y));
  for (let k = 1; k < steps.length; k += 1) {
    assert.ok(away[k] > away[k - 1], `step ${k} is further from her than step ${k - 1}`);
    assert.ok(steps[k].strength < steps[k - 1].strength);
    // Compared foot to foot, as left and right sit either side of the trail.
    if (k > 1) assert.ok(steps[k].y >= steps[k - 2].y - 0.5, "the trail keeps going down the hill");
  }
  assert.equal(steps[0].strength, 1);
  assert.ok(steps.at(-1).strength > 0.3, "the oldest step still shows");
  assert.ok(away[0] < 40, `newest step ${away[0]} points from her`);
});

test("steps keep an even stride and alternate feet, and a food's step keeps its foot as the day goes on", () => {
  const seat = seatFor(402);
  const steps = foodSteps({ count: 6, seat, width: 402, seed: days[9] });
  for (let k = 1; k < steps.length; k += 1) {
    const gap = Math.hypot(steps[k].x - steps[k - 1].x, steps[k].y - steps[k - 1].y);
    assert.ok(gap > 15 && gap < 22, `gap ${gap}`);
    assert.notEqual(steps[k].foot, steps[k - 1].foot);
  }
  // The first food of the day stays the same foot whether it is the newest step or the sixth.
  assert.equal(foodSteps({ count: 1, seat, width: 402 })[0].foot, steps[5].foot);
});

test("each step points back up the trail towards her", () => {
  const seat = seatFor(402);
  const steps = foodSteps({ count: MOST_STEPS, seat, width: 402, seed: days[1] });
  for (let k = 1; k < steps.length; k += 1) {
    const heading = Math.atan2(steps[k - 1].y - steps[k].y, steps[k - 1].x - steps[k].x) * 180 / Math.PI + 90;
    const off = Math.abs(((steps[k].turn - heading + 540) % 360) - 180);
    assert.ok(off < 45, `step ${k} is ${off} degrees off the way to the next`);
  }
});

test("every step stays on the hill, clear of her, of the Add button and of the tab bar, on every phone", () => {
  for (const width of WIDTHS) {
    const seat = seatFor(width);
    for (const seed of days) {
      for (const { x, y } of foodSteps({ count: MOST_STEPS, seat, width, seed })) {
        assert.ok(y > ridgeAt(x, width) + 9, `(${x}, ${y}) is on the hill at width ${width}`);
        assert.ok(Math.hypot((x - seat.x) / 30, (y - seat.y) / 12) > 1, `(${x}, ${y}) clears her shadow`);
        assert.ok(x > 10 && x < width - 125, `(${x}, ${y}) clears the Add button at width ${width}`);
        assert.ok(y < seat.y + 125, `(${x}, ${y}) clears the tab bar`);
      }
    }
  }
});

test("a day keeps its own trail, and days sway a little differently", () => {
  const seat = seatFor(402);
  const trail = (seed) => JSON.stringify(foodSteps({ count: MOST_STEPS, seat, width: 402, seed }));
  assert.equal(trail(days[4]), trail(days[4]));
  assert.ok(new Set(days.slice(0, 30).map(trail)).size > 20);
});
