// Builds the file on Settings > Export your data, on the phone. Nothing here leaves the
// device until the person picks a destination in the share sheet.

// The export always holds everything; only how far back it reaches is a choice.
export const EXPORT_RANGES = Object.freeze([
  { id: "month", label: "Last 30 days", days: 30 },
  { id: "all", label: "All history", days: null },
]);

const nameOf = (entry) => entry.foodName ?? entry.food_name ?? "";
const mealOf = (entry) => entry.mealType ?? entry.meal_type ?? "";
const timeOf = (entry) => {
  const [hours, mins] = String(entry.localTime ?? entry.local_time ?? "").split(":");
  return mins == null ? "" : `${hours.padStart(2, "0")}:${mins}`;
};
const clean = (value) => {
  const parsed = value === null || value === "" ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const round = (value) => Math.round(value * 100) / 100;

const sortedDays = (days, keys) => keys.map((key) => ({ key, entries: days[key]?.entries ?? [] })).filter((day) => day.entries.length);

// Oldest first, limited to days with something logged.
export function exportKeys(days = {}, range = "all", today = new Date()) {
  const keys = Object.keys(days).filter((key) => days[key]?.entries?.length).sort();
  const span = EXPORT_RANGES.find(({ id }) => id === range)?.days;
  if (!span) return keys;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - span + 1);
  return keys.filter((key) => new Date(`${key}T12:00:00`) >= start);
}

export function exportSummary(days, keys) {
  return { days: keys.length, meals: keys.reduce((total, key) => total + days[key].entries.length, 0), first: keys[0] ?? null, last: keys[keys.length - 1] ?? null };
}

// Every food with all its details, each day's totals, and the goals, as numbers.
export function exportJson(days, keys, goals = {}, now = new Date()) {
  return `${JSON.stringify({
    app: "Calmera", format: 1, exportedAt: now.toISOString(),
    goals: { calories: clean(goals.calorieGoal), protein_g: clean(goals.proteinGoal), carbs_g: clean(goals.carbsGoal), fat_g: clean(goals.fatGoal) },
    days: sortedDays(days, keys).map(({ key, entries }) => {
      const total = (field) => round(entries.reduce((sum, entry) => sum + (clean(entry[field]) ?? 0), 0));
      return { date: key,
        totals: { foods: entries.length, calories: total("calories"), protein_g: total("protein"), carbs_g: total("carbs"), fat_g: total("fat") },
        foods: entries.map((entry) => ({
          time: timeOf(entry), meal: mealOf(entry), food: nameOf(entry), quantity: entry.quantity ?? null,
          calories: clean(entry.calories), protein_g: clean(entry.protein), carbs_g: clean(entry.carbs), fat_g: clean(entry.fat),
          vegetables: entry.ingredients?.vegetables ?? null, fruits: entry.ingredients?.fruits ?? null,
        })) };
    }),
  }, null, 2)}\n`;
}

// A name cut off mid-emoji leaves half a character, which can't be written as UTF-8.
export const wellFormed = (text) => text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");

export const exportFileName = (today) => `calmera-data-${today}.json`;
// Export files go in the app's cache folder. The share sheet doesn't always report back,
// so one can be left there; the next export and Erase all data remove them.
export const isExportFile = (name) => typeof name === "string" && name.startsWith("calmera-");
