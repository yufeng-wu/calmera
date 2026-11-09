import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { dataLoader, localDateKey } from "@/lib/nutritionStore.mjs";
import { nutritionViewState, retryNutritionError } from "@/lib/nutritionPresentation.mjs";
import { completeNutritionRefresh } from "@/lib/completeNutritionRefresh.mjs";
import { removeStoredNutritionEntry } from "@/lib/nutritionDelete.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { useDataStore } from "@/lib/store";

// History is the whole meal log, so it waits until Today has landed and the page has settled.
const HISTORY_DELAY_MS = 2000;

export function profileGoals(profile) {
  const p = profile || {};
  return { calorieGoal: p.calorieGoal ?? p.calorie_goal ?? p.calories,
    proteinGoal: p.proteinGoal ?? p.protein_goal ?? p.protein,
    carbsGoal: p.carbsGoal ?? p.carbs_goal ?? p.carbs,
    fatGoal: p.fatGoal ?? p.fat_goal ?? p.fat };
}

export function useNutritionData(date = new Date(), history = false) {
  const userId = LOCAL_OWNER, isLoaded = true;
  const data = useDataStore();
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const { store, entriesRevision, goalsRevision, setShouldRefresh } = useRefreshSignal();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const focused = useIsFocused();
  const [wakeVersion, setWakeVersion] = useState(0);
  const dateKey = localDateKey(date);
  const isSessionActive = useCallback(() => ownerRef.current === userId && store.belongsTo(userId), [store, userId]);
  const loader = useMemo(() => dataLoader(data, isSessionActive), [data, isSessionActive]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setWakeVersion((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!focused || !isLoaded || !userId || !store.belongsTo(userId)) return;
    let active = true;
    let prefetch;
    store.loadProfile(loader).catch(() => {});
    const request = history ? store.loadHistory(loader) : store.loadDay(dateKey, loader);
    request.then(() => {
      if (!history && active) {
        prefetch = setTimeout(() => { store.loadHistory(loader).catch(() => {}); }, HISTORY_DELAY_MS);
      }
    }).catch(() => {});
    return () => { active = false; clearTimeout(prefetch); };
  }, [store, loader, focused, isLoaded, userId, dateKey, history, entriesRevision, goalsRevision, wakeVersion]);
  // Reads the screen's meals and goals again; the retry for a read that failed.
  const refresh = useCallback(() => {
    const data = history ? store.loadHistory(loader, { force: true }) : store.loadDay(dateKey, loader, { force: true });
    return completeNutritionRefresh([data, store.loadProfile(loader, { force: true })]);
  }, [store, loader, history, dateKey]);
  const refreshProfile = useCallback(() => store.loadProfile(loader, { force: true }), [store, loader]);
  const deleteEntry = useCallback((id) => removeStoredNutritionEntry({
    store, ownerKey: userId, dateKey, id,
    deleteMeal: (options) => data.deleteMeal(id, options),
    isActive: isSessionActive,
    onSettled: () => {
      if (isSessionActive()) setShouldRefresh(true);
    },
  }), [store, data, dateKey, userId, isSessionActive, setShouldRefresh]);
  const goals = useMemo(() => profileGoals(snapshot.profile), [snapshot.profile]);
  const presentation = nutritionViewState(snapshot, dateKey, history);
  const retryError = useCallback(() => retryNutritionError(
    { error: presentation.error, profileError: presentation.profileError }, { refresh, refreshProfile }),
  [presentation.error, presentation.profileError, refresh, refreshProfile]);
  return { store, dateKey, ...presentation, goals, profile: snapshot.profile, dataByDate: snapshot.days,
    historyPending: Boolean(snapshot.pending.history), profilePending: Boolean(snapshot.pending.profile),
    refresh, refreshProfile, retryError, deleteEntry, isSessionActive, snapshot, loader };
}
