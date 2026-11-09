// Food dots: every food logged on a day leaves one small dot on Today's hill. The dots climb the hill to the
// orange, so the newest is always at her feet and the oldest are furthest down, fading as they go. Nothing moves on
// its own: the trail is drawn once, and changes only when a food is added or removed.

// The trail shows this many dots at most; a longer day keeps its newest ones.
export const MOST_DOTS = 8;
// Points between one dot and the next along the trail.
const SPACING = 16;
// The newest dot is drawn at full strength, and each one before it a little fainter.
const FADE_PER_DOT = 0.085;
// Where the newest dot sits, from the bottom-centre of the seated orange: clear of her and her shadow.
const FIRST = { x: 30, y: 13 };
// The trail starts this far from the first dot, down the hill and to the right, and arcs up to her.
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

// The trail's course for a day, from the newest dot (t = 0) down the hill (t = 1), in points from the band's top
// left. `seat` is the bottom-centre of the seated orange; `width` the band's width.
export function dotCourse(seat, width, seed = 0) {
  const sway = (scatter(seed) - 0.5) * 2 * SWAY;
  const bend = (scatter(seed + 7919) - 0.5) * 2 * SWAY;
  const start = [seat.x + FIRST.x, seat.y + FIRST.y];
  const end = [Math.min(start[0] + REACH.x, width - RIGHT_MARGIN), start[1] + REACH.y];
  // From her feet it heads out along the hill, then arcs down the slope.
  const pull = [start[0] + 46 + sway, start[1] + 6];
  const push = [end[0] - 4 + bend, end[1] - 48];
  return [start, pull, push, end];
}

// The dots for a day with `count` foods, newest first: where each sits and how strong it shows.
export function foodDots({ count, seat, width, seed = 0 }) {
  const shown = Math.max(0, Math.min(MOST_DOTS, Math.floor(count || 0)));
  if (!shown || !seat) return [];
  const [p0, p1, p2, p3] = dotCourse(seat, width, seed);
  const at = (t) => [cubic(p0[0], p1[0], p2[0], p3[0], t), cubic(p0[1], p1[1], p2[1], p3[1], t)];
  // Measured along the curve, so the dots keep even spacing where it bends.
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
    const [x, y] = at(tAt(k * SPACING));
    return { x: round(x), y: round(y), strength: round(1 - k * FADE_PER_DOT) };
  });
}
