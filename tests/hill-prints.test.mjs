import test from "node:test";
import assert from "node:assert/strict";
import { hillVisitor, hillWalk, printShown, walkLength } from "../lib/hillPrints.mjs";

// The real seeds: year * 400 + month * 32 + day.
const days = Array.from({ length: 3000 }, (_, i) => { const d = new Date(2026, 0, 1 + i); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); });
// A repeatable stand-in for Math.random.
const seeded = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };

test("paw prints show up only some days, and a day keeps its own visitor", () => {
  const seen = days.filter((day) => hillVisitor(day)).length / days.length;
  assert.ok(seen > 0.3 && seen < 0.5, `seen on ${seen} of days`);
  assert.equal(hillVisitor(days[9]), hillVisitor(days[9]));
});

test("only cats and dogs walk by", () => {
  const kinds = new Set(days.map(hillVisitor).filter(Boolean));
  assert.deepEqual([...kinds].sort(), ["cat", "dog"]);
});

test("every route stays on the hill, clear of the orange and above the tab bar", () => {
  const random = seeded(7);
  for (let i = 0; i < 3000; i += 1) {
    for (const { x, y } of hillWalk(i % 2 ? "dog" : "cat", random)) {
      assert.ok(x > 12 && x < 300, `x ${x}`);
      assert.ok(y > 124 && y < 186, `y ${y}`);
      if (x < 60) assert.ok(y > 134, `y ${y} at x ${x}`);
    }
  }
});

test("routes differ from walk to walk and go both ways", () => {
  const random = seeded(3);
  const walks = Array.from({ length: 40 }, () => hillWalk("cat", random));
  assert.equal(new Set(walks.map((steps) => `${steps[0].x},${steps[0].y}`)).size, walks.length);
  const rightward = walks.filter((steps) => steps.at(-1).x > steps[0].x).length;
  assert.ok(rightward > 5 && rightward < 35, `${rightward} of 40 went right`);
  for (const steps of walks) assert.ok(steps.length >= 6 && steps.length <= 9);
});

test("the steps travel: prints land in order, the oldest fade first, and the hill ends up clean", () => {
  const steps = hillWalk("dog", seeded(11));
  const count = steps.length;
  assert.equal(printShown(0, 0), 0);
  const landed = (index) => Array.from({ length: 8000 }, (_, t) => t).find((t) => printShown(t, index) > 0);
  for (let i = 1; i < count; i += 1) assert.ok(landed(i) > landed(i - 1));
  for (let i = 0; i < count; i += 1) assert.equal(printShown(walkLength(steps), i), 0);
  // Never the whole trail at once.
  const mostAtOnce = Math.max(...Array.from({ length: 80 }, (_, t) => steps.filter((_, i) => printShown(t * 100, i) > 0.5).length));
  assert.ok(mostAtOnce < count, `showed ${mostAtOnce} of ${count}`);
});

test("paws land in pairs", () => {
  const seen = (t, i) => printShown(t, i) > 0;
  assert.ok(seen(200, 0) && seen(200, 1) && !seen(200, 2));
});
