import test from "node:test";
import assert from "node:assert/strict";
import { MOST_PRINTS, pawTrail, pawVisitor } from "../lib/pawTrail.mjs";

// The front hill's ridge as HillScene draws it (400 units wide, 200 units to 190 points), to check prints stay on it.
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

test("every day has a dog or a cat, and keeps its own", () => {
  const kinds = days.map(pawVisitor);
  assert.deepEqual([...new Set(kinds)].sort(), ["cat", "dog"]);
  const dogs = kinds.filter((kind) => kind === "dog").length / kinds.length;
  assert.ok(dogs > 0.35 && dogs < 0.65, `dogs on ${dogs} of days`);
  assert.equal(pawVisitor(days[9]), pawVisitor(days[9]));
  // Neighbouring days don't simply take turns.
  const changes = kinds.slice(1).filter((kind, i) => kind !== kinds[i]).length / (kinds.length - 1);
  assert.ok(changes > 0.3 && changes < 0.7, `visitor changes on ${changes} of days`);
});

test("one print per food, up to the most the hill shows", () => {
  const seat = seatFor(402);
  assert.deepEqual(pawTrail({ count: 0, seat, width: 402 }), []);
  assert.equal(pawTrail({ count: 1, seat, width: 402 }).length, 1);
  assert.equal(pawTrail({ count: 5, seat, width: 402 }).length, 5);
  assert.equal(pawTrail({ count: 30, seat, width: 402 }).length, MOST_PRINTS);
});

test("the newest print is at her feet and older ones run down the hill, fainter as they go", () => {
  const seat = seatFor(402);
  const prints = pawTrail({ count: MOST_PRINTS, seat, width: 402, seed: days[3] });
  const away = prints.map(({ x, y }) => Math.hypot(x - seat.x, y - seat.y));
  for (let k = 1; k < prints.length; k += 1) {
    assert.ok(away[k] > away[k - 1], `print ${k} is further from her than print ${k - 1}`);
    assert.ok(prints[k].strength < prints[k - 1].strength);
    // Compared paw to paw, as left and right sit either side of the trail.
    if (k > 1) assert.ok(prints[k].y >= prints[k - 2].y - 0.5, "the trail keeps going down the hill");
  }
  assert.equal(prints[0].strength, 1);
  assert.ok(prints.at(-1).strength > 0.3, "the oldest print still shows");
  assert.ok(away[0] < 40, `newest print ${away[0]} points from her`);
});

test("prints keep a near-even stride and alternate paws, and a food's print keeps its paw as the day goes on", () => {
  const seat = seatFor(402);
  for (const kind of ["dog", "cat"]) {
    const prints = pawTrail({ count: 6, seat, width: 402, seed: days[9], kind });
    const gaps = prints.slice(1).map((print, k) => Math.hypot(print.x - prints[k].x, print.y - prints[k].y));
    for (const [k, gap] of gaps.entries()) {
      assert.ok(gap > 8 && gap < 13, `${kind} gap ${gap}`);
      assert.notEqual(prints[k + 1].paw, prints[k].paw);
    }
    // Steps vary a little, so the trail isn't stamped at exact intervals.
    assert.ok(Math.max(...gaps) - Math.min(...gaps) > 0.5, `${kind} gaps ${gaps}`);
    assert.equal(pawTrail({ count: 1, seat, width: 402, kind })[0].paw, prints[5].paw);
  }
});

test("a food's print keeps its place, turn and paw as later foods are added", () => {
  const seat = seatFor(402);
  const five = pawTrail({ count: 5, seat, width: 402, seed: days[6] });
  const seven = pawTrail({ count: 7, seat, width: 402, seed: days[6] });
  // The newest print always sits at her feet, so an older food's print moves down the trail by whole steps, keeping
  // its own paw and its own small variation relative to its neighbours.
  assert.deepEqual(five.map((print) => print.paw), seven.slice(2).map((print) => print.paw));
  assert.equal(seven[0].x, five[0].x);
  assert.equal(seven[0].y, five[0].y);
});

test("a cat walks in a narrower line than a dog", () => {
  const seat = seatFor(402);
  const spread = (kind) => {
    const prints = pawTrail({ count: 2, seat, width: 402, seed: days[2], kind });
    return Math.hypot(prints[1].x - prints[0].x, prints[1].y - prints[0].y);
  };
  assert.ok(spread("cat") < spread("dog"));
});

test("each print points back up the trail towards her", () => {
  const seat = seatFor(402);
  const prints = pawTrail({ count: MOST_PRINTS, seat, width: 402, seed: days[1] });
  for (let k = 1; k < prints.length; k += 1) {
    const heading = Math.atan2(prints[k - 1].y - prints[k].y, prints[k - 1].x - prints[k].x) * 180 / Math.PI + 90;
    const off = Math.abs(((prints[k].turn - heading + 540) % 360) - 180);
    assert.ok(off < 45, `print ${k} is ${off} degrees off the way to the next`);
  }
  // Each lands a little askew, in its own way.
  assert.ok(new Set(prints.map((print) => Math.round(print.turn))).size > 4);
});

test("every print stays on the hill, clear of her, of the Add button and of the tab bar, on every phone", () => {
  for (const width of WIDTHS) {
    const seat = seatFor(width);
    for (const seed of days) {
      for (const { x, y } of pawTrail({ count: MOST_PRINTS, seat, width, seed })) {
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
  const trail = (seed) => JSON.stringify(pawTrail({ count: MOST_PRINTS, seat, width: 402, seed }));
  assert.equal(trail(days[4]), trail(days[4]));
  assert.ok(new Set(days.slice(0, 30).map(trail)).size > 20);
});
