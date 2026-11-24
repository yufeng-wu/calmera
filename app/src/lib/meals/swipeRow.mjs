// The rules a meal row's swipe follows, kept apart from the gestures so they can be tested. One finger on a row can
// be read as several things at once: a drag, a tap on the row, the start of a page scroll. A row that this touch is
// opening must not be closed by the same touch read another way, so each rule here asks what the row was doing when
// the finger went down, not only what it is doing when the finger lifts.

// How much of the finger's speed (points per second) counts as extra travel when it lets go.
const TOSS = 0.05;

export const CLOSED = { open: false, rested: false, armed: false, dragging: false, dragged: false };

// What one touch does to a row. `open` is where the row is heading, `rested` whether it has come to rest there,
// `armed` whether a tap by this touch may close it, `dragging` whether this touch is dragging it now, and `dragged`
// whether this touch has dragged it at all, so the card's own press can tell a swipe from a tap.
// "touch" is a new finger on the row (it clears `dragged`); "down" is any gesture reporting that finger, which can
// happen more than once, and late, for the same touch.
export function rowTouch(state, event) {
  "worklet";
  const next = { ...state };
  // Only a row already resting open when the finger lands can be tapped shut: a row that is closed, or still
  // springing open from the swipe that just let go, has nothing for this touch to close.
  if (event === "touch" || event === "down") next.armed = state.open && state.rested && !state.dragging;
  if (event === "touch") next.dragged = false;
  if (event === "drag") { next.armed = false; next.dragging = true; next.dragged = true; }
  if (event === "release") next.dragging = false;
  if (event === "opened") { next.open = true; next.rested = false; next.armed = false; }
  if (event === "rested") next.rested = next.open;
  if (event === "closed") { next.open = false; next.rested = false; next.armed = false; }
  return next;
}

// A tap closes a row only when the row was resting open as the finger went down and the finger didn't drag it.
export function tapCloses(state) {
  "worklet";
  return state.open && state.rested && state.armed && !state.dragging;
}

// The card's own press (expand, or close when open) is for taps. The lift that ends a swipe can reach it too,
// after the swipe has already opened the row, and must not close it again.
export function pressIsTap(state) {
  "worklet";
  return !state.dragged;
}

// Where the row sits under a dragging finger: with it until Delete is fully out, then `overshootFriction` times
// slower (or not at all), and never to the right of closed.
export function dragPosition(drag, { open, width, friction = 1, overshoot = true, overshootFriction = 1 }) {
  "worklet";
  const offset = drag / friction + (open ? -width : 0);
  if (offset >= 0) return 0;
  if (offset >= -width) return offset;
  return overshoot ? -width + (offset + width) / overshootFriction : -width;
}

// Where a released row settles: -width (open) or 0 (closed). `drag` is how far the finger had dragged at its last
// move, so a lift that reports no travel or no speed of its own can't close a row that was pulled open.
export function releaseTarget({ open, drag, velocity, width, threshold, friction = 1 }) {
  "worklet";
  const speed = Number.isFinite(velocity) ? velocity : 0;
  const travelled = (drag + TOSS * speed) / friction;
  return travelled < (open ? threshold : -threshold) ? -width : 0;
}

// The row's stages as the screen sees them, for callers that close open rows.
export const PHASE = { closed: "closed", dragging: "dragging", opening: "opening", open: "open", closing: "closing" };

// A page that starts to scroll closes the open row. Only a row resting open: a scroll that starts while a row is
// under the finger, or still on its way open, began with the touch that is opening it.
export function scrollCloses(phase) {
  return phase === PHASE.open;
}
