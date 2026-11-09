import test from "node:test";
import assert from "node:assert/strict";
import { foodDots, MOST_DOTS } from "../lib/foodDots.mjs";

// The front hill's ridge as HillScene draws it (400 units wide, 200 units to 190 points), to check dots stay on it.
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

test("one dot per food, up to the most the hill shows", () => {
  const seat = seatFor(402);
  assert.deepEqual(foodDots({ count: 0, seat, width: 402 }), []);
  assert.equal(foodDots({ count: 1, seat, width: 402 }).length, 1);
  assert.equal(foodDots({ count: 5, seat, width: 402 }).length, 5);
  assert.equal(foodDots({ count: 30, seat, width: 402 }).length, MOST_DOTS);
});

test("the newest dot is at her feet and older ones run down the hill, fainter as they go", () => {
  const seat = seatFor(402);
  const dots = foodDots({ count: MOST_DOTS, seat, width: 402, seed: days[3] });
  const away = dots.map(({ x, y }) => Math.hypot(x - seat.x, y - seat.y));
  for (let k = 1; k < dots.length; k += 1) {
    assert.ok(away[k] > away[k - 1], `dot ${k} is further from her than dot ${k - 1}`);
    assert.ok(dots[k].strength < dots[k - 1].strength);
    assert.ok(dots[k].y >= dots[k - 1].y - 0.5, "the trail keeps going down the hill");
  }
  assert.equal(dots[0].strength, 1);
  assert.ok(dots.at(-1).strength > 0.3, "the oldest dot still shows");
  assert.ok(away[0] < 40, `newest dot ${away[0]} points from her`);
});

test("dots are evenly spaced along the trail, even where it bends", () => {
  for (const seed of days.slice(0, 60)) {
    const dots = foodDots({ count: MOST_DOTS, seat: seatFor(402), width: 402, seed });
    for (let k = 1; k < dots.length; k += 1) {
      const gap = Math.hypot(dots[k].x - dots[k - 1].x, dots[k].y - dots[k - 1].y);
      assert.ok(gap > 15 && gap <= 16.05, `gap ${gap}`);
    }
  }
});

test("adding a food keeps the older dots on the same course", () => {
  const seat = seatFor(402);
  const before = foodDots({ count: 3, seat, width: 402, seed: days[5] });
  const after = foodDots({ count: 4, seat, width: 402, seed: days[5] });
  // Each older dot moves one place down the trail: to where the next older one was.
  for (let k = 0; k < before.length - 1; k += 1) assert.deepEqual([after[k + 1].x, after[k + 1].y], [before[k + 1].x, before[k + 1].y]);
});

test("every dot stays on the hill, clear of her, of the Add button and of the tab bar, on every phone", () => {
  for (const width of WIDTHS) {
    const seat = seatFor(width);
    for (const seed of days) {
      for (const { x, y } of foodDots({ count: MOST_DOTS, seat, width, seed })) {
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
  const trail = (seed) => JSON.stringify(foodDots({ count: MOST_DOTS, seat, width: 402, seed }));
  assert.equal(trail(days[4]), trail(days[4]));
  assert.ok(new Set(days.slice(0, 30).map(trail)).size > 20);
});
