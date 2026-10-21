import { parseMeal } from "./chatgpt/protocol.mjs";
import { validateMealNutrition } from "./mealNutritionValidation.mjs";
import { saveEstimatedEntries } from "./chatgpt/entryPersistence.mjs";

export const PHOTO_MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];
export const MAX_PHOTO_FOODS = 20;

export function reviewFood(values, mealType) {
  const foodName = String(values.foodName ?? "").trim();
  const quantity = String(values.quantity ?? "").trim();
  if (!foodName || foodName.length > 255) throw new Error("Enter a food name, up to 255 characters.");
  if (!quantity || quantity.length > 255) throw new Error("Enter an amount, such as 150 g or 1 bowl.");
  const nutrition = validateMealNutrition(values);
  if (nutrition.error) throw new Error(`${nutrition.error.title}: ${nutrition.error.message}`);
  try { return parseMeal(JSON.stringify({ foodName, quantity, mealType, ...nutrition.values })); }
  catch { throw new Error("Check the amount and nutrition. Use a positive amount such as 150 g or 1 bowl, and realistic nutrition values."); }
}

export function createPhotoMealReview(entries, owner, createdAt) {
  if (!owner || !Number.isFinite(Date.parse(createdAt))) throw new Error("This meal review is no longer available. Please start again.");
  if (!Array.isArray(entries) || entries.length > MAX_PHOTO_FOODS) throw new Error("Review up to 20 foods at a time.");
  const mealType = PHOTO_MEAL_TYPES.includes(entries[0]?.mealType) ? entries[0].mealType : "Snack";
  return { owner, createdAt, mealType, nextId: entries.length,
    entries: entries.map((entry, index) => ({ ...reviewFood(entry, mealType), id: `photo-food-${index}` })) };
}

export function updatePhotoReviewFood(review, id, values) {
  const food = reviewFood(values, review.mealType);
  if (id == null) {
    if (review.entries.length >= MAX_PHOTO_FOODS) throw new Error("You can save up to 20 foods in one meal.");
    return { ...review, nextId: review.nextId + 1,
      entries: [...review.entries, { ...food, id: `photo-food-${review.nextId}` }] };
  }
  if (!review.entries.some(entry => entry.id === id)) throw new Error("This food was removed. Return to your meal review.");
  return { ...review, entries: review.entries.map(entry => entry.id === id ? { ...food, id } : entry) };
}

export function photoReviewTotals(review) {
  return Object.fromEntries(["calories", "protein", "carbs", "fat"].map(field =>
    [field, Math.round(review.entries.reduce((sum, food) => sum + food[field], 0) * 100) / 100]));
}

// Only the explicit Save action calls this boundary. A review carries no media,
// model credentials, database IDs or automatic persistence side effects.
export function savePhotoMealReview(review, owner, options) {
  if (!owner || review?.owner !== owner) throw new Error("This meal review belongs to another session. Please start again.");
  if (!review.entries.length) throw new Error("Add at least one food before saving.");
  const entries = review.entries.map(entry => reviewFood(entry, review.mealType));
  return saveEstimatedEntries(entries, { ...options, createdAt: review.createdAt });
}
