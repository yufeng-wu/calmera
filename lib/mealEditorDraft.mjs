// The list already has a complete meal. Reuse only this account's in-memory
// copy while the editor validates it with a fresh GET; never put meal data in a URL.
export function storedMealForEditor(store, ownerKey, entryId) {
  return storedMeal(store, ownerKey, entryId)?.entry ?? null;
}

// The day a stored meal is filed under, so the editor can delete it the way the lists do.
export function storedMealDateKey(store, ownerKey, entryId) {
  return storedMeal(store, ownerKey, entryId)?.dateKey ?? null;
}

function storedMeal(store, ownerKey, entryId) {
  if (!ownerKey || entryId == null || !store?.belongsTo(ownerKey)) return null;
  for (const [dateKey, day] of Object.entries(store.getSnapshot().days)) {
    const entry = day.entries.find(value => String(value.id) === String(entryId));
    if (entry) return { dateKey, entry };
  }
  return null;
}

// The API sends decimals as fixed-point strings ("450.00"); show only digits that carry value.
export function editorNumber(value) {
  if (value == null || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(value);
}

export function mealEditorValues(entry = {}) {
  return {
    foodName: entry.foodName ?? entry.food_name ?? "",
    quantity: String(entry.quantity ?? ""),
    calories: editorNumber(entry.calories),
    protein: editorNumber(entry.protein),
    carbs: editorNumber(entry.carbs),
    fat: editorNumber(entry.fat),
    mealType: entry.mealType ?? entry.meal_type ?? "Breakfast",
  };
}
