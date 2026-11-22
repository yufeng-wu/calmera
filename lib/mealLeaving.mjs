// Meals being deleted fold away on Today before they leave the store. A meal group whose every entry is
// leaving folds as a whole, heading and all; otherwise each leaving entry folds on its own.
export function groupLeaving(entries, leaving) {
  return entries.length > 0 && entries.every((entry) => leaving.has(entry.id));
}

export function rowLeaving(id, leaving, wholeGroup) {
  return !wholeGroup && leaving.has(id);
}

export function withLeaving(leaving, id) {
  if (leaving.has(id)) return leaving;
  const next = new Set(leaving);
  next.add(id);
  return next;
}

export function withoutLeaving(leaving, ids) {
  if (!ids.some((id) => leaving.has(id))) return leaving;
  const next = new Set(leaving);
  ids.forEach((id) => next.delete(id));
  return next;
}
