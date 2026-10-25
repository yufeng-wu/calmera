import AsyncStorage from "@react-native-async-storage/async-storage";
import { localDateKey } from "../nutritionStore.mjs";

// One ChatGPT report per week (weeks start Monday), saved on this phone.
// A new focus, tone or set of instructions starts a fresh one.
export function weekStart(date = new Date()) {
  const day = (date.getDay() + 6) % 7;
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - day));
}

const storageKey = (userId) => `calmera.insights.report.${userId || "preview"}`;
export const prefsSignature = (prefs) => `${prefs.focus}|${prefs.tone}|${prefs.notes || ""}`;

export async function readReport(userId, week, signature) {
  try {
    const value = JSON.parse(await AsyncStorage.getItem(storageKey(userId)) || "null");
    return value?.week === week && value.signature === signature ? value : null;
  } catch {
    return null;
  }
}

export async function saveReport(userId, report) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(report)).catch(() => {});
}
