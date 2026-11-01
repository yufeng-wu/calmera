import { useCallback } from "react";
import { Alert, LayoutAnimation } from "react-native";
import { EMPTY_DAY, localDateKey } from "@/lib/nutritionStore.mjs";
import { useNutritionData } from "./useNutritionData";

export const useDailyNutrition = (date = new Date()) => {
  const data = useNutritionData(date);
  const { store, loader, dateKey, refresh, deleteEntry: removeEntry, isSessionActive } = data;
  const retryHistory = useCallback(() => store.loadHistory(loader, { force: true }).catch(() => {}), [store, loader]);
  // The calendar's rings refresh alongside the visible day but never fail its pull.
  const loadData = useCallback(() => {
    const day = refresh();
    retryHistory();
    return day;
  }, [refresh, retryHistory]);
  const deleteEntry = useCallback(async (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try { await removeEntry(id); }
    catch { Alert.alert("Couldn't delete meal", "Please try again."); }
  }, [removeEntry]);
  // New meals always belong to today, even if another day is on screen when they finish saving.
  const addEntries = useCallback((entries) => {
    if (!isSessionActive()) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    store.addConfirmed(localDateKey(), entries);
  }, [store, isSessionActive]);
  const historyError = data.snapshot.errors.history || null;
  return { dateKey, entries: data.day?.entries || [], summary: data.day?.summary || EMPTY_DAY.summary,
    hasData: Boolean(data.day), goals: data.goals, error: data.error, profileError: data.profileError,
    refreshProfile: data.refreshProfile, retryError: data.retryError,
    profile: data.profile, dataByDate: data.dataByDate, historyError, historyPending: data.historyPending,
    historyLoading: !data.snapshot.historyLoaded && !historyError, retryHistory,
    retrying: Boolean(data.snapshot.pending[`day:${dateKey}`] || data.profilePending), isSessionActive, isLoading: data.loading, loadData, deleteEntry, addEntries };
};
