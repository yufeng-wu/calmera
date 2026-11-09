// Food steps: every food logged on a day leaves one small footprint on Today's hill. The trail climbs the hill to the
// orange, so the newest step is always at her feet and the oldest are furthest down, fading as they go. Nothing
// moves on its own: the trail is drawn once, and changes only when a food is added or removed.

// The trail shows this many steps at most; a longer day keeps its newest ones.
export const MOST_STEPS = 8;
// Points between one step and the next along the trail, and how far each foot sits off the trail's centre line.
const STRIDE = 17;
const STANCE = 4.2;
// The newest step is drawn at full strength, and each one before it a little fainter.
const FADE_PER_STEP = 0.085;
// Where the newest step lands, from the bottom-centre of the seated orange: clear of her and her shadow.
const FIRST = { x: 30, y: 13 };
// The trail starts this far from the first step, down the hill and to the right, and arcs up to her.
const REACH = { x: 96, y: 92 };
// It stays left of the floating Add button by at least this much.
const RIGHT_MARGIN = 132;
// How far a day's trail may sway either side of its usual course, in points.
const SWAY = 14;

// Spreads neighbouring day numbers, so consecutive days don't sway in step with each other.
const scatter = (seed) => {
  let h = Math.imul(Math.abs(Math.trunc(seed)) + 1, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 2 ** 32;
};

const cubic = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
const round = (n) => Math.round(n * 100) / 100;

// The trail's course for a day, from the newest step (t = 0) down the hill (t = 1), in points from the band's top
// left. `seat` is the bottom-centre of the seated orange; `width` the band's width.
export function stepCourse(seat, width, seed = 0) {
  const sway = (scatter(seed) - 0.5) * 2 * SWAY;
  const bend = (scatter(seed + 7919) - 0.5) * 2 * SWAY;
  const start = [seat.x + FIRST.x, seat.y + FIRST.y];
  const end = [Math.min(start[0] + REACH.x, width - RIGHT_MARGIN), start[1] + REACH.y];
  // From her feet it heads out along the hill, then arcs down the slope: the way she came up.
  const pull = [start[0] + 46 + sway, start[1] + 6];
  const push = [end[0] - 4 + bend, end[1] - 48];
  return [start, pull, push, end];
}

// The steps for a day with `count` foods, newest first. Each is a point, which way it points (0 degrees is up the
// screen, and a step points the way she walked, up towards her), which foot it is, and how strong it shows.
export function foodSteps({ count, seat, width, seed = 0 }) {
  const shown = Math.max(0, Math.min(MOST_STEPS, Math.floor(count || 0)));
  if (!shown || !seat) return [];
  const [p0, p1, p2, p3] = stepCourse(seat, width, seed);
  const at = (t) => [cubic(p0[0], p1[0], p2[0], p3[0], t), cubic(p0[1], p1[1], p2[1], p3[1], t)];
  // Measured along the curve, so steps keep an even stride where it bends.
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
    const t = Math.min(1, tAt(k * STRIDE));
    const [x, y] = at(t);
    const [nx, ny] = at(Math.min(1, t + 0.01));
    // She walked up the trail, so a step points back along it, towards t = 0.
    const dx = x - nx;
    const dy = y - ny;
    const length = Math.hypot(dx, dy) || 1;
    // Feet alternate by the food's place in the day, so a step keeps its foot as the trail grows.
    const foot = (count - 1 - k) % 2 ? "right" : "left";
    const side = foot === "right" ? 1 : -1;
    return {
      x: round(x - dy / length * side * STANCE),
      y: round(y + dx / length * side * STANCE),
      turn: round(Math.atan2(dy, dx) * 180 / Math.PI + 90),
      foot,
      strength: round(1 - k * FADE_PER_STEP),
    };
  });
}
