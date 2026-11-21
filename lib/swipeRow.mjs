// The rules a meal row's swipe follows, kept apart from the gestures so they can be tested. One finger on a row can
// be read as several things at once: a drag, a tap on the row, the start of a page scroll. A row that this touch is
// opening must not be closed by the same touch read another way, so each rule here asks what the row was doing when
// the finger went down, not only what it is doing when the finger lifts.

// How much of the finger's speed (points per second) counts as extra travel when it lets go.
const TOSS = 0.05;

export const CLOSED = { open: false, armed: false, dragging: false };

// What one touch does to a row. `open` is where the row rests (or is heading), `armed` is whether a tap by this
// touch may close it, `dragging` is whether this touch is dragging it.
export function rowTouch(state, event) {
  "worklet";
  // A touch that lands on a row that is not open can never close it by tapping, whatever happens before it lifts.
  if (event === "down") return { open: state.open, armed: state.open && !state.dragging, dragging: state.dragging };
  if (event === "drag") return { open: state.open, armed: false, dragging: true };
  if (event === "release") return { open: state.open, armed: state.armed, dragging: false };
  if (event === "opened") return { open: true, armed: state.armed, dragging: state.dragging };
  if (event === "closed") return { open: false, armed: false, dragging: state.dragging };
  return state;
}

// A tap closes a row only when the row was already open as the finger went down and the finger didn't drag it.
export function tapCloses(state) {
  "worklet";
  return state.open && state.armed && !state.dragging;
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
