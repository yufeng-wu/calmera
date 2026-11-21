import { useCallback } from "react";
import { Alert, LayoutAnimation } from "react-native";
import { EMPTY_DAY, localDateKey } from "@/lib/nutritionStore.mjs";
import { useNutritionData } from "./useNutritionData";

export const useDailyNutrition = (date = new Date()) => {
  const data = useNutritionData(date);
  const { store, loader, dateKey, deleteEntry: removeEntry, isSessionActive } = data;
  const retryHistory = useCallback(() => store.loadHistory(loader, { force: true }).catch(() => {}), [store, loader]);
  // Opening the calendar asks for its dots at once, ahead of the delayed load behind Today.
  const loadCalendar = useCallback(() => store.loadHistory(loader).catch(() => {}), [store, loader]);
  // Today folds a deleted meal away itself; a layout animation here would replay over the closed gap.
  const deleteEntry = useCallback(async (id) => {
    try { await removeEntry(id); }
    catch { Alert.alert("Couldn't delete meal", "Please try again."); }
  }, [removeEntry]);
  // New meals always belong to today, even if another day is on screen when they finish saving.
  const addEntries = useCallback((entries) => {
    if (!isSessionActive()) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    store.addConfirmed(localDateKey(), entries);
  }, [store, isSessionActive]);
  // Once loaded, the calendar keeps its dots through a failed read.
  const historyError = data.snapshot.historyLoaded ? null : data.snapshot.errors.history || null;
  return { dateKey, entries: data.day?.entries || [], summary: data.day?.summary || EMPTY_DAY.summary,
    hasData: Boolean(data.day), goals: data.goals, error: data.error, profileError: data.profileError,
    goalsLoading: !data.profile && data.profilePending && !data.profileError,
    refreshProfile: data.refreshProfile, retryError: data.retryError,
    profile: data.profile, dataByDate: data.dataByDate, historyError, historyPending: data.historyPending,
    historyLoading: !data.snapshot.historyLoaded && !historyError, retryHistory, loadCalendar,
    retrying: Boolean(data.snapshot.pending[`day:${dateKey}`] || data.profilePending), isSessionActive, isLoading: data.loading, deleteEntry, addEntries };
};
