// The sky over the orange, as a pure function of the local time of day. Everything here is continuous
// around the clock, so the sky can glide from any time to any other without a visible jump.
// The times are fixed rather than taken from the user's location: the app never asks where they are.
const SUNRISE = 6 * 60;
const SUNSET = 19 * 60;
const MOONRISE = 18.5 * 60;
const MOONSET = 6.5 * 60;
const DAY = 24 * 60;

const smooth = (from, to, x) => {
  "worklet";
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

const wrap = (clock) => {
  "worklet";
  return ((clock % DAY) + DAY) % DAY;
};

// The tint's strength down the sky, as gradient stops. Sampled finely from a curve with no corners, because the
// eye picks out any corner in a ramp as a line across the sky, and starting from nothing so there is never an edge.
// It only ever deepens: a sky that lightened again would read as a band across the page. A `shoulder` adds a first
// rise to that strength by `reach`, so the sky is already there behind the stars, then the rest comes on slowly
// down to `settle`, where the strength holds. All of these are shares of the rectangle being filled.
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const portion = (x, end) => Math.min(1, x / end);
export const skyFade = (peak, { shoulder = 0, reach = 1, settle = 1 } = {}) => {
  const strength = (x) => shoulder * ease(portion(x, reach)) + (peak - shoulder) * ease(portion(x, settle));
  const place = (offset) => [offset, Math.round(strength(offset) * 10000) / 10000];
  const first = Array.from({ length: 24 }, (_, i) => place(i / 24 * reach));
  const rest = Array.from({ length: 25 }, (_, i) => place(reach + i / 24 * (settle - reach)));
  const stops = reach < 1 ? [...first, ...rest] : Array.from({ length: 33 }, (_, i) => place(i / 32 * settle));
  return settle < 1 ? [...stops, [1, peak]] : stops;
};

export const minutesOf = (date) => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;

// The clock only ever takes the short way round, so a tick past midnight moves it one minute, not back a day.
export const nearestClock = (from, minutes) => {
  const ahead = wrap(minutes - from);
  return from + (ahead > DAY / 2 ? ahead - DAY : ahead);
};

// How far the sun and moon are through their passes (0 rising, 1 setting), how dark the sky is, and how golden.
export const skyAt = (clock) => {
  "worklet";
  const m = wrap(clock);
  const night = m >= 720 ? smooth(18.75 * 60, 20.25 * 60, m) : 1 - smooth(5 * 60, 6.25 * 60, m);
  const warm = m >= 720
    ? smooth(16.5 * 60, 18.5 * 60, m) * (1 - smooth(20 * 60, 20.75 * 60, m))
    : smooth(5.5 * 60, 6.25 * 60, m) * (1 - smooth(7 * 60, 8.5 * 60, m));
  return {
    sun: (m - SUNRISE) / (SUNSET - SUNRISE),
    moon: wrap(m - MOONRISE) / (DAY - MOONRISE + MOONSET),
    night,
    warm,
  };
};

// Stars come out one at a time after sunset and go in one at a time before dawn.
export const starAt = (clock, index) => {
  "worklet";
  const m = wrap(clock);
  return m >= 720
    ? smooth(19.2 * 60 + index * 9, 19.7 * 60 + index * 9, m)
    : 1 - smooth(4.8 * 60 + index * 6, 5.3 * 60 + index * 6, m);
};

// Where a body sits on its arc, in the units of the scene drawing it. `fade` is for a sky with no hill to set
// behind: the body dissolves near the ends of its pass instead. Outside its pass it is simply not there.
export const bodyAt = (pass, arc) => {
  "worklet";
  const t = Math.min(1, Math.max(0, pass));
  const up = Math.pow(Math.sin(Math.PI * t), 0.6);
  const seen = pass > 0 && pass < 1 ? 1 : 0;
  return {
    x: arc.x - arc.spread * Math.cos(Math.PI * t),
    y: arc.low - arc.rise * up,
    opacity: arc.fade ? smooth(0, arc.fade, t) * smooth(0, arc.fade, 1 - t) * seen : seen,
  };
};
