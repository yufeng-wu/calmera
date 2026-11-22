import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAIPreferences } from "./preferences.mjs";

// This iPhone's AI preferences (preferences.mjs), in app storage.
export const aiPreferences = owner => createAIPreferences({ storage: AsyncStorage, owner });
