// No daily goal goes below 1: a zero target would make Today's rings meaningless.
export const GOAL_MINIMUM = 1;

// Slider ranges are editing conveniences, not nutrition recommendations.
export function goalSliderBounds(value, defaultMaximum, rangeIncrement) {
  const numeric = Number(value);
  const finite = Number.isFinite(numeric) ? Math.round(numeric) : 0;
  return {
    minimumValue: GOAL_MINIMUM,
    maximumValue: Math.max(defaultMaximum, Math.ceil(finite / rangeIncrement) * rangeIncrement),
  };
}

// A set goal must be a whole number of at least 1; an unset one stays unset.
export const goalAllowed = value => goalInputValue(value) === "" ? String(value ?? "").trim() === "" : Number(goalInputValue(value)) >= GOAL_MINIMUM;

// Normalize loaded, recommended, dragged and saved goals to whole units.
// Empty targets stay unset instead of silently becoming zero.
export function goalInputValue(value) {
  if (value == null || String(value).trim() === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(Math.round(numeric)) : "";
}

export function goalSaveValue(value) {
  const normalized = goalInputValue(value);
  return normalized === "" ? undefined : Number(normalized);
}
