import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMealTimePreferences } from "./mealTimePreferences.mjs";

// Nonsecret device preference, kept on this iPhone.
export const mealTimePreferences = createMealTimePreferences(AsyncStorage);
