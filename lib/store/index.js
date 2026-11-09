import AsyncStorage from "@react-native-async-storage/async-storage";
import { createPhoneStore } from "./phone.mjs";

// The one place the app reads and writes meals, goals and the profile. Everything lives on
// this iPhone (./phone.mjs); screens, components and hooks only call these methods.
// `lib/nutritionStore.mjs` is the in-memory copy screens share while the app is open.
//
// Days of meals
//   readDay(date)        One day ("YYYY-MM-DD"): { date, foodEntries, dailyTotals, mealTotals, goals? }.
//                        `goals` are the ones in effect that day.
//   readDays()           Every day with something logged, as { [date]: day }.
// One meal (one food on a day)
//   readMeal(id)         The meal, or rejects with code "meal_not_found".
//   createMeals(foods, { createdAt })
//                        Saves 1–20 reviewed foods eaten at `createdAt` (local ISO time with
//                        offset) and resolves with the saved meals, each with its new id.
//   updateMeal(id, meal) Saves foodName, quantity, calories, protein, carbs, fat and mealType.
//   deleteMeal(id)       Resolves with { deleted: true }.
// Goals, each set in effect from its start date until a later set starts
//   readGoals()          The latest goals: { calorieGoal, proteinGoal, carbsGoal, fatGoal }.
//   saveGoals(goals, { startDate })
// The profile
//   readProfile()        { createdAtLocalDate, calorieGoal, …Goal }: the day calmera was first
//                        opened and the latest goals. The first read starts it, with default goals.
// Everything
//   eraseAll()           Removes every meal, goal and the profile from this iPhone.
//
// Meals carry id, foodName, quantity, calories, protein, carbs, fat, mealType, localTime
// ("HH:MM:SS") and, when known, ingredients.
//
// Every method takes a last options argument: `signal` cancels the call and `isActive()`
// returning false stops it before it writes. Failures reject with an Error whose `code`
// says what happened; a cancelled read is an AbortError.

let shared = null;

// One store for the whole app, so every screen shares its queue.
export function createDataStore() {
  return (shared ??= createPhoneStore({ storage: AsyncStorage }));
}

export function useDataStore() {
  return createDataStore();
}
