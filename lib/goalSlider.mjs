// Slider ranges are editing conveniences, not nutrition recommendations.
export function goalSliderBounds(value, defaultMaximum, rangeIncrement) {
  const numeric = Number(value);
  const finite = Number.isFinite(numeric) ? Math.round(numeric) : 0;
  return {
    minimumValue: finite < 0 ? Math.floor(finite / rangeIncrement) * rangeIncrement : 0,
    maximumValue: Math.max(defaultMaximum, Math.ceil(finite / rangeIncrement) * rangeIncrement),
  };
}

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
