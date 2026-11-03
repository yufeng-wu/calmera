// Tiny paw prints across the hill on some days. Who walked by depends only on the date, so a day keeps its own
// visitor when you come back to it, and most days the hill is left clean. Each walk takes a new route.
const KINDS = ["dog", "cat"];
// Where a route may run, in the hill's drawing units: on the front hill, below the orange's seat and above the
// tab bar. Near the left edge the hill is lower, so routes keep further down there.
const ROUTE = { left: 30, right: 280, top: 132, bottom: 172, lowLeft: 70, lowTop: 142, minSpan: 110, bow: 26, stride: 24 };
const SEEN_ONE_DAY_IN = 5;
const SEEN_ON = 2;
// Sideways offset of each paw from the path's line, in step with the size the prints are drawn at.
const STANCE = { dog: 3.4, cat: 2.5 };
// A walk is this many prints at most, so a scene can keep that many mounted and move them between walks.
export const MOST_STEPS = 9;
const FEWEST_STEPS = 6;

const mix = (a, b, c, t) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c;
// Scatters neighbouring day numbers, so consecutive days don't walk through the kinds in order.
const scatter = (seed) => {
  let h = Math.imul(Math.abs(Math.trunc(seed)) + 1, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
};

// The walk, in milliseconds. Paws land in little pairs, each print stays a moment, and
// those left behind gradually fade away as new ones land, so the steps travel across the hill as a soft tail.
const PAIR_GAP = 480;
const PAW_IN_PAIR = 130;
const FADE_IN = 140;
const STAY = 240;
const FADE_OUT = 1200;
export const NEXT_WALK_AFTER = 18000;

const landsAt = (index) => {
  "worklet";
  return Math.floor(index / 2) * PAIR_GAP + (index % 2) * PAW_IN_PAIR;
};

export const walkLength = (steps) => landsAt(steps.length - 1) + FADE_IN + STAY + FADE_OUT;

// How visible a print is at `time` into the walk. Before the walk and after it, the hill is clean.
export const printShown = (time, index) => {
  "worklet";
  const since = time - landsAt(index);
  if (since <= 0) return 0;
  if (since < FADE_IN) return since / FADE_IN;
  if (since < FADE_IN + STAY) return 1;
  return Math.max(0, 1 - (since - FADE_IN - STAY) / FADE_OUT);
};

// Who walks by on the day with this seed, or null for a clean hill.
export function hillVisitor(seed) {
  const h = scatter(seed);
  if (h % SEEN_ONE_DAY_IN >= SEEN_ON) return null;
  return KINDS[(h >>> 4) % KINDS.length];
}

const between = (random, low, high) => low + random() * (high - low);
const topAt = (x) => (x < ROUTE.lowLeft ? ROUTE.lowTop : ROUTE.top);

// A fresh route across the hill, either way: a gentle curve between two points far enough apart to read as a walk.
export function hillWalk(kind, random = Math.random) {
  const startX = between(random, ROUTE.left, ROUTE.right - ROUTE.minSpan);
  const endX = between(random, startX + ROUTE.minSpan, ROUTE.right);
  const [fromX, toX] = random() < 0.5 ? [startX, endX] : [endX, startX];
  const from = [fromX, between(random, topAt(fromX), ROUTE.bottom)];
  const to = [toX, between(random, topAt(toX), ROUTE.bottom)];
  // The bend bows the path up or down from its midpoint. The curve only goes halfway to it, and never above the
  // route's top or below its bottom.
  const midY = (from[1] + to[1]) / 2;
  const curveMid = Math.min(ROUTE.bottom, Math.max(ROUTE.top, midY + between(random, -ROUTE.bow, ROUTE.bow) / 2));
  const bend = [(from[0] + to[0]) / 2, 2 * curveMid - midY];
  const count = Math.max(FEWEST_STEPS, Math.min(MOST_STEPS, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / ROUTE.stride)));
  const round = (n) => Math.round(n * 100) / 100;
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    const x = mix(from[0], bend[0], to[0], t);
    const y = mix(from[1], bend[1], to[1], t);
    const dx = mix(from[0], bend[0], to[0], t + 0.01) - x;
    const dy = mix(from[1], bend[1], to[1], t + 0.01) - y;
    const length = Math.hypot(dx, dy) || 1;
    const side = i % 2 ? 1 : -1;
    return {
      x: round(x - dy / length * side * STANCE[kind]),
      y: round(y + dx / length * side * STANCE[kind]),
      // 0 degrees points a print up the screen; a step points along the walk.
      turn: round(Math.atan2(dy, dx) * 180 / Math.PI + 90),
    };
  });
}
