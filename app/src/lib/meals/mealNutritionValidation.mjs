// Validate the exact numbers used by Manual and Meal Editor payloads. Prefix
// parsing would accept units/commas that Number later turns into NaN/null JSON.
export function validateMealNutrition(input = {}) {
  const values = {};
  for (const field of ["calories", "protein", "carbs", "fat"]) {
    const raw = input[field];
    const scalar = typeof raw === "string" || typeof raw === "number";
    const blank = raw == null || (typeof raw === "string" && !raw.trim());
    const value = blank ? 0 : scalar ? Number(raw) : NaN;
    if ((field === "calories" && blank) || !Number.isFinite(value) || value < 0) {
      return { values: null, error: { field, title: `Check ${field}`,
        message: "Enter a number of 0 or more, without units or commas." } };
    }
    values[field] = value;
  }
  return { values, error: null };
}
