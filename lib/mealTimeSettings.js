import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMealTimePreferences } from "./mealTimePreferences.mjs";

// Nonsecret, per-Calmera-user device preference. No account or backend writes.
export const mealTimePreferences = createMealTimePreferences(AsyncStorage);
