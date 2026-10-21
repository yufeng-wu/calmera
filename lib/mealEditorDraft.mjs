// The list already has a complete meal. Reuse only this account's in-memory
// copy while the editor validates it with a fresh GET; never put meal data in a URL.
export function storedMealForEditor(store, ownerKey, entryId) {
  if (!ownerKey || entryId == null || !store?.belongsTo(ownerKey)) return null;
  for (const day of Object.values(store.getSnapshot().days)) {
    const entry = day.entries.find(value => String(value.id) === String(entryId));
    if (entry) return entry;
  }
  return null;
}

export function mealEditorValues(entry = {}) {
  return {
    foodName: entry.foodName ?? entry.food_name ?? "",
    quantity: String(entry.quantity ?? ""),
    calories: String(entry.calories ?? ""),
    protein: String(entry.protein ?? ""),
    carbs: String(entry.carbs ?? ""),
    fat: String(entry.fat ?? ""),
    mealType: entry.mealType ?? entry.meal_type ?? "Breakfast",
  };
}
