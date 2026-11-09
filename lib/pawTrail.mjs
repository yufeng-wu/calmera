// Paw trail: a dog or a cat comes by Today's hill, and every food logged on a day leaves one of its paw prints. The
// trail climbs the hill to the orange, so the newest print is always at her feet and the oldest are furthest down,
// fading as they go. The geometry here is pure and still: a day's trail is the same every time it's drawn, and
// changes only when a food is added or removed.

const KINDS = ["dog", "cat"];
// The trail shows this many prints at most; a longer day keeps its newest ones.
export const MOST_PRINTS = 8;
// Points between one print and the next along the trail, before each step's own small variation.
const STRIDE = 10;
// How far a step may fall short of or past its even place, so the prints aren't stamped at exact intervals.
const STEP_JITTER = 0.7;
// How far a print may turn off the trail's heading, the way a paw lands a little askew.
const WOBBLE = 8;
// How far each paw sits off the trail's centre line: a dog's gait is wider; a cat walks almost in a line.
const STANCE = { dog: 1.8, cat: 1.2 };
// The newest print is drawn at full strength, and each one before it a little fainter.
const FADE_PER_PRINT = 0.08;
// Where the newest print sits, from the bottom-centre of the seated orange: clear of her and her shadow.
const FIRST = { x: 30, y: 13 };
// The trail starts this far from the first print, down the hill and to the right, and arcs up to her.
const REACH = { x: 120, y: 92 };
// It stays left of the floating Add button by at least this much.
const RIGHT_MARGIN = 132;
// How far a day's trail may sway either side of its usual course, in points.
const SWAY = 14;

// Spreads neighbouring day numbers, so consecutive days don't sway, or pick their visitor, in step.
const scatter = (seed) => {
  let h = Math.imul(Math.abs(Math.trunc(seed)) + 1, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 2 ** 32;
};
// A value in -1..1 for one step of one day's trail, the same every time.
const stepNoise = (seed, slot, salt) => (scatter(Math.imul(seed, 31) + slot * 101 + salt) - 0.5) * 2;

// Who comes by on the day with this seed. A day keeps its own visitor when you come back to it.
export const pawVisitor = (seed) => KINDS[Math.floor(scatter(seed + 104729) * KINDS.length)];

const cubic = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
const round = (n) => Math.round(n * 100) / 100;

// The trail's course for a day, from the newest print (t = 0) down the hill (t = 1), in points from the band's top
// left. `seat` is the bottom-centre of the seated orange; `width` the band's width.
export function trailCourse(seat, width, seed = 0) {
  const sway = (scatter(seed) - 0.5) * 2 * SWAY;
  const bend = (scatter(seed + 7919) - 0.5) * 2 * SWAY;
  const start = [seat.x + FIRST.x, seat.y + FIRST.y];
  const end = [Math.min(start[0] + REACH.x, width - RIGHT_MARGIN), start[1] + REACH.y];
  // From her feet it heads out along the hill, then arcs down the slope: the way the visitor came up.
  const pull = [start[0] + 52 + sway, start[1] + 6];
  const push = [end[0] - 4 + bend, end[1] - 50];
  return [start, pull, push, end];
}

// The prints for a day with `count` foods, newest first. Each is a point, which way it points (0 degrees is up the
// screen, and a print points the way the visitor walked, up towards her), which paw it is, and how strong it shows.
export function pawTrail({ count, seat, width, seed = 0, kind = pawVisitor(seed) }) {
  const shown = Math.max(0, Math.min(MOST_PRINTS, Math.floor(count || 0)));
  if (!shown || !seat) return [];
  const [p0, p1, p2, p3] = trailCourse(seat, width, seed);
  const at = (t) => [cubic(p0[0], p1[0], p2[0], p3[0], t), cubic(p0[1], p1[1], p2[1], p3[1], t)];
  // Measured along the curve, so prints keep an even stride where it bends.
  const SAMPLES = 96;
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) => at(i / SAMPLES));
  const lengths = [0];
  for (let i = 1; i <= SAMPLES; i += 1) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const tAt = (distance) => {
    if (distance >= lengths[SAMPLES]) return 1;
    const i = lengths.findIndex((length) => length >= distance);
    if (i <= 0) return 0;
    return (i - 1 + (distance - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1)) / SAMPLES;
  };
  return Array.from({ length: shown }, (_, k) => {
    // A step's place in the day: its variation and its paw stay with the food as later ones are added.
    const slot = count - 1 - k;
    const t = Math.min(1, tAt(Math.max(0, k * STRIDE + (k ? stepNoise(seed, slot, 1) * STEP_JITTER : 0))));
    const [x, y] = at(t);
    const [nx, ny] = at(Math.min(1, t + 0.01));
    // The visitor walked up the trail, so a print points back along it, towards t = 0.
    const dx = x - nx;
    const dy = y - ny;
    const length = Math.hypot(dx, dy) || 1;
    // Paws alternate by the food's place in the day, so a print keeps its side as the trail grows.
    const side = slot % 2 ? 1 : -1;
    return {
      x: round(x - dy / length * side * STANCE[kind]),
      y: round(y + dx / length * side * STANCE[kind]),
      turn: round(Math.atan2(dy, dx) * 180 / Math.PI + 90 + stepNoise(seed, slot, 2) * WOBBLE),
      paw: side > 0 ? "right" : "left",
      strength: round(1 - k * FADE_PER_PRINT),
    };
  });
}
