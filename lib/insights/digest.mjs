// Turns logged days into exact weekly numbers on the phone. The model only
// interprets these; it never adds up raw rows itself.
import { localDateKey } from "../nutritionStore.mjs";

const GROUPS = {
  veg: /salad|spinach|broccoli|kale|lettuce|cabbage|carrot|pepper|tomato|cucumber|zucchini|mushroom|veg|greens|asparagus|bok choy|edamame|蔬菜|青菜|菠菜|西兰花|生菜|白菜|番茄|黄瓜|蘑菇|沙拉/i,
  fruit: /apple|banana|berry|berries|orange|grape|mango|kiwi|pear|peach|melon|fruit|avocado|水果|苹果|香蕉|橙|葡萄|芒果|莓/i,
  wholeGrain: /oat|brown rice|quinoa|whole wheat|wholegrain|whole grain|multigrain|燕麦|糙米|全麦|杂粮/i,
  protein: /chicken|beef|pork|fish|salmon|tuna|egg|tofu|shrimp|turkey|yogurt|greek|beans|lentil|鸡|牛肉|猪肉|鱼|虾|蛋|豆腐/i,
  sweets: /cake|cookie|donut|candy|chocolate|ice cream|soda|cola|boba|bubble tea|milk tea|pastry|dessert|brownie|蛋糕|饼干|巧克力|冰淇淋|奶茶|可乐|甜点/i,
};
const fields = ["calories", "protein", "carbs", "fat"];
const round = (value) => Math.round(value);
const minutes = (time = "") => {
  const [hours, mins] = String(time).split(":").map(Number);
  return Number.isFinite(hours) ? hours * 60 + (mins || 0) : null;
};

export function foodGroups(name = "") {
  return Object.keys(GROUPS).filter((key) => GROUPS[key].test(name));
}

// days: { "YYYY-MM-DD": { entries, summary } } as kept by the nutrition store.
export function weeklyDigest(days = {}, goals = {}, { today = new Date(), span = 7 } = {}) {
  const keys = Array.from({ length: span }, (_, index) =>
    localDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - index)));
  const logged = keys.filter((key) => days[key]?.entries?.length).reverse();
  const totals = Object.fromEntries(fields.map((key) => [key, 0]));
  const groups = { veg: 0, fruit: 0, wholeGrain: 0, protein: 0, sweets: 0 };
  const foods = new Map();
  let breakfastDays = 0, lateDays = 0, proteinHitDays = 0, calorieOnTrackDays = 0;
  const weekday = [], weekend = [];
  for (const key of logged) {
    const entries = days[key].entries;
    const dayTotals = Object.fromEntries(fields.map((field) => [field, entries.reduce((sum, entry) => sum + (Number(entry[field]) || 0), 0)]));
    fields.forEach((field) => { totals[field] += dayTotals[field]; });
    if (entries.some((entry) => entry.mealType === "Breakfast" || (minutes(entry.localTime) ?? 9999) < 630)) breakfastDays++;
    if (entries.some((entry) => (minutes(entry.localTime) ?? 0) >= 21 * 60 + 30)) lateDays++;
    if (goals.proteinGoal && dayTotals.protein >= goals.proteinGoal * 0.9) proteinHitDays++;
    if (goals.calorieGoal && Math.abs(dayTotals.calories / goals.calorieGoal - 1) <= 0.12) calorieOnTrackDays++;
    const dow = new Date(`${key}T12:00:00`).getDay();
    (dow === 0 || dow === 6 ? weekend : weekday).push(dayTotals.calories);
    for (const entry of entries) {
      const name = String(entry.foodName || "").trim();
      if (!name) continue;
      foodGroups(name).forEach((group) => { groups[group]++; });
      const food = foods.get(name.toLowerCase()) || { name, count: 0, calories: 0 };
      food.count++; food.calories += Number(entry.calories) || 0;
      foods.set(name.toLowerCase(), food);
    }
  }
  const count = logged.length || 1;
  const average = Object.fromEntries(fields.map((field) => [field, round(totals[field] / count)]));
  const mean = (list) => list.length ? round(list.reduce((sum, value) => sum + value, 0) / list.length) : null;
  return {
    range: { from: keys[span - 1], to: keys[0], span },
    daysLogged: logged.length,
    average,
    goals: { calories: goals.calorieGoal || null, protein: goals.proteinGoal || null, carbs: goals.carbsGoal || null, fat: goals.fatGoal || null },
    calorieRatio: goals.calorieGoal ? average.calories / goals.calorieGoal : null,
    proteinRatio: goals.proteinGoal ? average.protein / goals.proteinGoal : null,
    proteinHitDays, calorieOnTrackDays, breakfastDays, lateDays,
    weekdayCalories: mean(weekday), weekendCalories: mean(weekend),
    groups,
    distinctFoods: foods.size,
    topFoods: [...foods.values()].sort((a, b) => b.calories - a.calories).slice(0, 5)
      .map((food) => ({ ...food, calories: round(food.calories) })),
  };
}

// The same compact, readable context goes to the in-app model and to "Copy for AI".
export function digestMarkdown(digest, prefs = {}) {
  const pct = (ratio) => ratio == null ? "no goal set" : `${round(ratio * 100)}% of goal`;
  const lines = [
    `# My nutrition, ${digest.range.from} to ${digest.range.to}`,
    "",
    `- What I care about: ${FOCUS[prefs.focus]?.label || FOCUS.balanced.label}`,
    ...(prefs.notes?.trim() ? [`- About me: ${prefs.notes.trim()}`] : []),
    `- Days logged: ${digest.daysLogged} of ${digest.range.span}`,
    `- Daily average: ${digest.average.calories} kcal (${pct(digest.calorieRatio)}), protein ${digest.average.protein} g (${pct(digest.proteinRatio)}), carbs ${digest.average.carbs} g, fat ${digest.average.fat} g`,
    `- Goals: ${digest.goals.calories ?? "?"} kcal, protein ${digest.goals.protein ?? "?"} g, carbs ${digest.goals.carbs ?? "?"} g, fat ${digest.goals.fat ?? "?"} g`,
    `- Protein goal met on ${digest.proteinHitDays} days; calories on track on ${digest.calorieOnTrackDays} days`,
    `- Breakfast on ${digest.breakfastDays} days; eating after 21:30 on ${digest.lateDays} days`,
    `- Weekday average ${digest.weekdayCalories ?? "n/a"} kcal, weekend average ${digest.weekendCalories ?? "n/a"} kcal`,
    `- Food groups (entries): vegetables ${digest.groups.veg}, fruit ${digest.groups.fruit}, whole grains ${digest.groups.wholeGrain}, protein foods ${digest.groups.protein}, sweets/sugary drinks ${digest.groups.sweets}`,
    `- Different foods eaten: ${digest.distinctFoods}`,
    `- Biggest calorie sources: ${digest.topFoods.map((food) => `${food.name} (${food.count}x, ${food.calories} kcal)`).join(", ") || "none"}`,
    "",
    "Numbers are estimates from photo and voice logs.",
  ];
  return lines.join("\n");
}

export const FOCUS = {
  balanced: { label: "Eating balanced", emoji: "🥗" },
  energy: { label: "More energy", emoji: "⚡️" },
  muscle: { label: "Building muscle", emoji: "💪" },
  lighter: { label: "Getting leaner", emoji: "🌿" },
};
