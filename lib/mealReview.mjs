import { parseMeal } from "./chatgpt/protocol.mjs";
import { validateMealNutrition } from "./mealNutritionValidation.mjs";
import { FOOD_ICON_CATALOG } from "./foodIcons.mjs";

export const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];
export const MAX_MEAL_FOODS = 20;

export function reviewFood(values, mealType) {
  const foodName = String(values.foodName ?? "").trim();
  const quantity = String(values.quantity ?? "").trim();
  if (!foodName || foodName.length > 255) throw new Error("Enter a food name, up to 255 characters.");
  if (!quantity || quantity.length > 255) throw new Error("Enter an amount, such as a bowl or 150 g.");
  const nutrition = validateMealNutrition(values);
  if (nutrition.error) throw new Error(`${nutrition.error.title}: ${nutrition.error.message}`);
  try { return parseMeal(JSON.stringify({ foodName, quantity, mealType, ...nutrition.values, ingredients: values.ingredients })); }
  catch { throw new Error("Check the amount and nutrition. Use an amount such as a bowl or 150 g, and realistic nutrition values."); }
}

// A renamed food may be a different food, so the old ingredients no longer apply.
function renamed(entry, foodName) {
  if (String(entry.foodName ?? "").trim() === String(foodName ?? "").trim()) return entry;
  const { ingredients: _stale, ...rest } = entry;
  return rest;
}

export function createMealReview(entries, owner, createdAt) {
  if (!owner || !Number.isFinite(Date.parse(createdAt))) throw new Error("This meal review is no longer available. Please start again.");
  if (!Array.isArray(entries) || entries.length > MAX_MEAL_FOODS) throw new Error("Review up to 20 foods at a time.");
  const mealType = MEAL_TYPES.includes(entries[0]?.mealType) ? entries[0].mealType : "Snack";
  return { owner, createdAt, mealType, nextId: entries.length,
    entries: entries.map((entry, index) => ({ ...reviewFood(entry, mealType), id: `meal-food-${index}`, origin: "analysis" })) };
}

export function updateReviewFood(review, id, values) {
  const food = reviewFood(values, review.mealType);
  if (id == null) {
    if (review.entries.length >= MAX_MEAL_FOODS) throw new Error("You can save up to 20 foods in one meal.");
    return { ...review, nextId: review.nextId + 1,
      entries: [...review.entries, { ...food, id: `meal-food-${review.nextId}` }] };
  }
  if (!review.entries.some(entry => entry.id === id)) throw new Error("This food was removed. Return to your meal review.");
  return { ...review, entries: review.entries.map(entry => entry.id === id ? { ...renamed(entry, food.foodName), ...food, id } : entry) };
}

export function reviewTotals(review) {
  return Object.fromEntries(["calories", "protein", "carbs", "fat"].map(field =>
    [field, Math.round(review.entries.reduce((sum, food) => sum + (Number.isFinite(Number(food[field])) && Number(food[field]) >= 0 ? Number(food[field]) : 0), 0) * 100) / 100]));
}

// Only the explicit Save action calls this boundary. A review carries no media,
// model credentials, database IDs or automatic persistence side effects. `data` is
// the data module (lib/store), which saves the foods as meals.
export function saveMealReview(review, owner, data, options = {}) {
  if (!owner || review?.owner !== owner) throw new Error("This meal review belongs to another session. Please start again.");
  if (!review.entries.length) throw new Error("Add at least one food before saving.");
  const entries = validateMealReview(review).entries;
  return data.createMeals(entries, { ...options, createdAt: review.createdAt });
}

// Keep partial field input in the local draft until explicit Save validates it.
export function setReviewField(review, id, field, value) {
  if (!["foodName", "quantity", "calories", "protein", "carbs", "fat", "iconId"].includes(field)) throw new Error("invalid_food_field");
  if (field === "iconId" && !FOOD_ICON_CATALOG.some(icon => icon.id === value)) throw new Error("invalid_food_icon");
  return { ...review, entries: review.entries.map(entry => entry.id === id ? { ...(field === "foodName" ? renamed(entry, value) : entry), [field]: value } : entry) };
}

export function addReviewFood(review) {
  if (review.entries.length >= MAX_MEAL_FOODS) throw new Error("You can save up to 20 foods in one meal.");
  const id = `meal-food-${review.nextId}`;
  return { ...review, nextId: review.nextId + 1, entries: [...review.entries, { id, origin: "added", foodName: "", quantity: "",
    mealType: review.mealType, calories: "", protein: "", carbs: "", fat: "" }] };
}

export function validateMealReview(review) {
  if (!review.entries.length) throw new Error("Add at least one food before saving.");
  return { ...review, entries: review.entries.map(entry => {
    try { return { ...reviewFood(entry, review.mealType), id: entry.id, ...(entry.iconId ? { iconId: entry.iconId } : {}) }; }
    catch (error) { error.foodId = entry.id; throw error; }
  }) };
}

export function hasIncompleteFood(review) {
  return review.entries.some(entry => { try { reviewFood(entry, review.mealType); return false; } catch { return true; } });
}
