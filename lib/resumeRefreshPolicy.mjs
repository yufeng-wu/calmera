// Inactive includes iOS overlays. Only an actual background stay makes a
// return eligible for a blocking data refresh.
export function createResumeRefreshPolicy({ initialState = "active", now = Date.now, idleMs = 120000 } = {}) {
  let backgroundAt = initialState === "background" ? now() : null;
  return next => {
    if (next === "background") {
      backgroundAt ??= now();
      return false;
    }
    if (next !== "active" || backgroundAt === null) return false;
    const elapsed = now() - backgroundAt;
    backgroundAt = null;
    return elapsed >= idleMs;
  };
}
