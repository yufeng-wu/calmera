import { WEIGHT_CHANGE_THRESHOLD, STABLE_FRAME_COUNT } from "./constants";
import { State, LogEntry } from "./classes";

export function detectNewState(session, frame) {
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

  const allAgree = validRecent.every(
    (f) => Math.abs(f.weight - newWeight) < WEIGHT_CHANGE_THRESHOLD
  );
  const currWeight = session.currentState ? session.currentState.weight : null;
  const isNewWeight =
    currWeight === null ||
    Math.abs(newWeight - currWeight) >= WEIGHT_CHANGE_THRESHOLD;

  if (!allAgree || !isNewWeight) return null;

  return new State({
    timestamp: frame.timestamp,
    weight: newWeight,
    imagePath: frame.imagePath,
  });
}

export function addLogEntryHelper(session, newEntry) {
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

  if (updatedWeight <= 0) {
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
