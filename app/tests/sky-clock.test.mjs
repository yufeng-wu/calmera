import test from "node:test";
import assert from "node:assert/strict";
import { bodyAt, minutesOf, nearestClock, skyAt, skyFade, starAt } from "../src/lib/today/skyClock.mjs";

const HILL = { x: 212, spread: 54, low: 125, rise: 125 };
const at = (hour, minute = 0) => hour * 60 + minute;
const everyMinute = Array.from({ length: 1441 }, (_, m) => m);

test("the sun is up by day and gone at night", () => {
  assert.equal(bodyAt(skyAt(at(12, 30)).sun, HILL).opacity, 1);
  assert.equal(bodyAt(skyAt(at(12, 30)).sun, HILL).y, 0);
  for (const time of [at(19, 30), at(23), at(0), at(3), at(5, 30)]) assert.equal(bodyAt(skyAt(time).sun, HILL).opacity, 0);
});

test("the moon is up at night and gone by day", () => {
  for (const time of [at(21), at(0), at(4)]) assert.equal(bodyAt(skyAt(time).moon, HILL).opacity, 1);
  for (const time of [at(8), at(12), at(17)]) assert.equal(bodyAt(skyAt(time).moon, HILL).opacity, 0);
});

test("evening turns to night gradually, and morning back", () => {
  assert.equal(skyAt(at(17)).night, 0);
  assert.ok(skyAt(at(19)).night > 0 && skyAt(at(19)).night < 1);
  assert.equal(skyAt(at(20, 30)).night, 1);
  assert.equal(skyAt(at(3)).night, 1);
  assert.ok(skyAt(at(6)).night > 0 && skyAt(at(6)).night < 1);
  assert.equal(skyAt(at(8)).night, 0);
});

test("nothing in the sky jumps from one minute to the next, midnight included", () => {
  const read = (m) => {
    const sky = skyAt(m);
    const sun = bodyAt(sky.sun, HILL);
    const moon = bodyAt(sky.moon, HILL);
    return { night: sky.night, warm: sky.warm, star: starAt(m, 3), sunY: sun.y, moonY: moon.y };
  };
  for (const m of everyMinute.slice(1)) {
    const before = read(m - 1);
    const now = read(m);
    for (const key of ["night", "warm", "star"]) assert.ok(Math.abs(now[key] - before[key]) < 0.06, `${key} jumped at ${m}`);
  }
});

test("the sun and moon are behind the hill whenever they pop in or out", () => {
  // Past both ends of a pass the body is below the lowest ridge it can cross, glow included.
  for (const pass of [0, 1]) assert.ok(bodyAt(pass, HILL).y >= 122);
  for (const m of everyMinute) {
    const sky = skyAt(m);
    assert.ok(sky.night >= 0 && sky.night <= 1);
    assert.ok(sky.warm >= 0 && sky.warm <= 1);
  }
});

test("the moon never overlaps the sun in the open sky", () => {
  for (const m of everyMinute) {
    const sky = skyAt(m);
    const sun = bodyAt(sky.sun, HILL);
    const moon = bodyAt(sky.moon, HILL);
    if (sun.opacity && moon.opacity && sun.y < 92 && moon.y < 92) assert.ok(Math.hypot(sun.x - moon.x, sun.y - moon.y) > 40, `overlap at ${m}`);
  }
});

test("stars come out one at a time", () => {
  const first = starAt(at(19, 45), 0);
  const last = starAt(at(19, 45), 7);
  assert.ok(first > last);
  for (let i = 0; i < 8; i += 1) {
    assert.equal(starAt(at(21), i), 1);
    assert.equal(starAt(at(12), i), 0);
  }
});

test("the clock takes the short way round", () => {
  assert.equal(nearestClock(1439.5, 0.5), 1440.5);
  assert.equal(nearestClock(1440.5, 1439.5), 1439.5);
  assert.equal(nearestClock(600, 660), 660);
  assert.equal(nearestClock(600, 540), 540);
  assert.equal(nearestClock(2880 + 10, 20), 2880 + 20);
});

test("minutes come from the local time", () => {
  assert.equal(minutesOf(new Date(2026, 10, 18, 19, 30, 30)), at(19, 30) + 0.5);
});

test("a fading arc dissolves at both ends", () => {
  const arc = { x: 130, spread: 36, low: 118, rise: 48, fade: 0.2 };
  assert.equal(bodyAt(0.5, arc).opacity, 1);
  assert.ok(bodyAt(0.03, arc).opacity < 0.2);
  assert.ok(bodyAt(0.97, arc).opacity < 0.2);
  assert.equal(bodyAt(1.2, arc).opacity, 0);
});

test("the sky's tint fades from nothing, with no visible step anywhere, and only ever deepens", () => {
  for (const stops of [skyFade(0.8), skyFade(0.8, { shoulder: 0.5, reach: 0.15, settle: 0.6 })]) {
    assert.equal(stops[0][1], 0);
    stops.slice(1).forEach(([offset, strength], i) => {
      assert.ok(strength - stops[i][1] < 0.07);
      assert.ok(strength >= stops[i][1]);
      assert.ok(offset > stops[i][0]);
    });
    // The first stretch stays almost invisible, so the place it starts can't be seen.
    assert.ok(stops[2][1] < 0.02);
  }
  assert.deepEqual(skyFade(0.8, { shoulder: 0.5, reach: 0.15, settle: 0.6 }).at(-1), [1, 0.8]);
});
