import { WEIGHT_CHANGE_THRESHOLD, STABLE_FRAME_COUNT } from "./constants";
import { State } from "./classes";

export function detectNewState(session, frame, imageUri) {
  const newWeight = frame.weight;
  if (Number.isNaN(newWeight)) return null;

  // Gather last N frames with valid weight
  const validRecent = [];
  for (
    let i = session.frameBuffer.length - 1;
    i >= 0 && validRecent.length < STABLE_FRAME_COUNT;
    i--
  ) {
    const w = session.frameBuffer[i].weight;
    if (!Number.isNaN(w)) validRecent.push(session.frameBuffer[i]);
  }

  if (validRecent.length < STABLE_FRAME_COUNT) return null;

  const isStable = validRecent.every(
    (f) => Math.abs(f.weight - newWeight) < WEIGHT_CHANGE_THRESHOLD
  );
  const currStateWeight = session.currentState
    ? session.currentState.weight
    : null;
  const isNewWeight =
    currStateWeight === null ||
    Math.abs(newWeight - currStateWeight) >= WEIGHT_CHANGE_THRESHOLD;

  if (!isStable || !isNewWeight) return null;

  return new State({
    timestamp: frame.timestamp,
    weight: newWeight,
    imagePath: imageUri,
  });
}

export function addLogEntry(session, newEntry) {
  if (!session || !newEntry) return;

  const existing = Object.values(session.log).find(
    (e) => e.foodName.toLowerCase() === newEntry.foodName.toLowerCase()
  );

  if (!existing) {
    if (newEntry.direction === "add") {
      session.log[newEntry.id] = newEntry;
    }
    return;
  }

  const delta =
    newEntry.direction === "add"
      ? newEntry.absDeltaWeight
      : -newEntry.absDeltaWeight;
  const updatedWeight = existing.absDeltaWeight + delta;

  // Treat tiny leftovers as precision noise and remove the item.
  // Why safe for both directions:
  // - Removals: if leftover <= threshold, assume it's scale jitter and drop it.
  // - Additions: sub-threshold changes never create entries (filtered by
  //   stable-state detection), so this won't delete a legitimate item.
  if (updatedWeight <= WEIGHT_CHANGE_THRESHOLD) {
    delete session.log[existing.id];
    return;
  }

  const ratio = updatedWeight / existing.absDeltaWeight;
  const ni = existing.nutritionInfo || {};
  ["calories", "protein", "carbs", "fat"].forEach((k) => {
    if (typeof ni[k] === "number") ni[k] = Number((ni[k] * ratio).toFixed(2));
  });

  Object.assign(existing, {
    timestamp: newEntry.timestamp,
    absDeltaWeight: updatedWeight,
    nutritionInfo: ni,
  });
}
