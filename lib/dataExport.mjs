// Builds the files on Settings > Export your data, on the phone. Nothing here leaves the
// device until the person picks a destination in the share sheet.

export const EXPORT_RANGES = ["All time", "Last 12 months", "Last 30 days"];
const RANGE_DAYS = { "Last 12 months": 365, "Last 30 days": 30 };

const number = (value) => {
  const parsed = value === null || value === "" ? NaN : Number(value);
  return Number.isFinite(parsed) ? String(Math.round(parsed * 100) / 100) : "";
};
const nameOf = (entry) => entry.foodName ?? entry.food_name ?? "";
const mealOf = (entry) => entry.mealType ?? entry.meal_type ?? "";
const timeOf = (entry) => {
  const [hours, mins] = String(entry.localTime ?? entry.local_time ?? "").split(":");
  return mins == null ? "" : `${hours.padStart(2, "0")}:${mins}`;
};

// Quotes what a spreadsheet would split on, and keeps a food name from running as a
// formula when the file is opened.
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s=+\-@＝＋－＠]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// The byte order mark lets Excel read Chinese food names as UTF-8.
const csv = (rows) => `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;

const sortedDays = (days, keys) => keys.map((key) => ({ key, entries: days[key]?.entries ?? [] })).filter((day) => day.entries.length);

// Oldest first, limited to days with something logged.
export function exportKeys(days = {}, range = EXPORT_RANGES[0], today = new Date()) {
  const keys = Object.keys(days).filter((key) => days[key]?.entries?.length).sort();
  const span = RANGE_DAYS[range];
  if (!span) return keys;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - span + 1);
  return keys.filter((key) => new Date(`${key}T12:00:00`) >= start);
}

export function exportSummary(days, keys) {
  return { days: keys.length, meals: keys.reduce((total, key) => total + days[key].entries.length, 0), first: keys[0] ?? null, last: keys[keys.length - 1] ?? null };
}

export function mealsCsv(days, keys) {
  const names = (entry, group) => (entry.ingredients?.[group] ?? []).join("; ");
  const rows = sortedDays(days, keys).flatMap(({ key, entries }) => entries.map((entry) => [key, timeOf(entry), mealOf(entry), nameOf(entry), entry.quantity ?? "",
    number(entry.calories), number(entry.protein), number(entry.carbs), number(entry.fat), names(entry, "vegetables"), names(entry, "fruits")]));
  return csv([["date", "time", "meal", "food", "quantity", "calories", "protein_g", "carbs_g", "fat_g", "vegetables", "fruits"], ...rows]);
}

export function dailyTotalsCsv(days, keys) {
  const total = (entries, field) => number(entries.reduce((all, entry) => all + (Number(entry[field]) || 0), 0));
  const rows = sortedDays(days, keys).map(({ key, entries }) => [key, entries.length, total(entries, "calories"), total(entries, "protein"), total(entries, "carbs"), total(entries, "fat")]);
  return csv([["date", "foods_logged", "calories", "protein_g", "carbs_g", "fat_g"], ...rows]);
}

export function everythingJson(days, keys, goals = {}, now = new Date()) {
  const clean = (value) => { const parsed = value === null || value === "" ? NaN : Number(value); return Number.isFinite(parsed) ? parsed : null; };
  return `${JSON.stringify({
    app: "Calmera", format: 1, exportedAt: now.toISOString(),
    goals: { calories: clean(goals.calorieGoal), protein_g: clean(goals.proteinGoal), carbs_g: clean(goals.carbsGoal), fat_g: clean(goals.fatGoal) },
    days: sortedDays(days, keys).map(({ key, entries }) => ({ date: key, foods: entries.map((entry) => ({
      time: timeOf(entry), meal: mealOf(entry), food: nameOf(entry), quantity: entry.quantity ?? null,
      calories: clean(entry.calories), protein_g: clean(entry.protein), carbs_g: clean(entry.carbs), fat_g: clean(entry.fat),
      vegetables: entry.ingredients?.vegetables ?? null, fruits: entry.ingredients?.fruits ?? null,
    })) })),
  }, null, 2)}\n`;
}

// A name cut off mid-emoji leaves half a character, which can't be written as UTF-8.
export const wellFormed = (text) => text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");

export const EXPORT_FORMATS = [
  { id: "meals", title: "Every food", subtitle: "A CSV file with one row per food. Opens in Excel, Numbers or Sheets.", name: "meals", extension: "csv", build: (days, keys) => mealsCsv(days, keys) },
  { id: "daily", title: "Daily totals", subtitle: "A CSV file with one row per day.", name: "daily-totals", extension: "csv", build: (days, keys) => dailyTotalsCsv(days, keys) },
  { id: "everything", title: "Everything", subtitle: "A JSON file with every food and your goals, for other apps.", name: "data", extension: "json", build: everythingJson },
];

export const exportFileName = (format, today) => `calmera-${format.name}-${today}.${format.extension}`;
