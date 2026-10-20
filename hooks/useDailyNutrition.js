import { useCallback } from "react";
import { Alert, LayoutAnimation } from "react-native";
import { EMPTY_DAY } from "@/lib/nutritionStore.mjs";
import { useNutritionData } from "./useNutritionData";

export const useDailyNutrition = (date = new Date()) => {
  const data = useNutritionData(date);
  const { store, dateKey, refresh, deleteEntry: removeEntry } = data;
  const loadData = useCallback(() => refresh(), [refresh]);
  const deleteEntry = useCallback(async (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try { await removeEntry(id); }
    catch { Alert.alert("Couldn't delete meal", "Please try again."); }
  }, [removeEntry]);
  const addEntries = useCallback((entries) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    store.addConfirmed(dateKey, entries);
  }, [store, dateKey]);
  return { entries: data.day?.entries || [], summary: data.day?.summary || EMPTY_DAY.summary,
    hasData: Boolean(data.day), goals: data.goals, error: data.error, profileError: data.profileError,
    refreshProfile: data.refreshProfile, retryError: data.retryError, isSessionActive: store.isActive, isLoading: data.loading, loadData, deleteEntry, addEntries };
};
