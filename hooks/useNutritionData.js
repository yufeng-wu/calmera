import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppState, InteractionManager } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useIsFocused } from "@react-navigation/native";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FOOD_ENTRIES_API_URL, USERS_API_URL } from "@/constants/api";
import { localDateKey } from "@/lib/nutritionStore.mjs";
import { nutritionViewState, retryNutritionError } from "@/lib/nutritionPresentation.mjs";
import { readNutrition } from "@/lib/nutritionRequest.mjs";
import { removeStoredNutritionEntry } from "@/lib/nutritionDelete.mjs";

export function useNutritionData(date = new Date(), history = false) {
  const { userId, getToken, isLoaded } = useAuth();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const { store, entriesRevision, goalsRevision, setShouldRefresh } = useRefreshSignal();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const focused = useIsFocused();
  const [wakeVersion, setWakeVersion] = useState(0);
  const dateKey = localDateKey(date);
  const isSessionActive = useCallback(() => ownerRef.current === userId && store.belongsTo(userId), [store, userId]);
  const loader = useCallback(({ resource, date: day, signal }) => {
    const url = resource === "profile" ? `${USERS_API_URL}/get-user`
      : resource === "history" ? `${FOOD_ENTRIES_API_URL}/summaries`
        : `${FOOD_ENTRIES_API_URL}/summary-by-date/${day}`;
    return readNutrition({ getToken: () => tokenRef.current(), url, signal,
      isActive: () => ownerRef.current === userId && store.belongsTo(userId) });
  }, [store, userId]);
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
        prefetch = InteractionManager.runAfterInteractions(() => { store.loadHistory(loader).catch(() => {}); });
      }
    }).catch(() => {});
    return () => { active = false; prefetch?.cancel(); };
  }, [store, loader, focused, isLoaded, userId, dateKey, history, entriesRevision, goalsRevision, wakeVersion]);
  const refresh = useCallback(() => {
    const data = history ? store.loadHistory(loader, { force: true }) : store.loadDay(dateKey, loader, { force: true });
    return Promise.all([data, store.loadProfile(loader, { force: true })]);
  }, [store, loader, history, dateKey]);
  const refreshProfile = useCallback(() => store.loadProfile(loader, { force: true }), [store, loader]);
  const deleteEntry = useCallback((id) => removeStoredNutritionEntry({
    store, ownerKey: userId, dateKey, id,
    getToken: () => tokenRef.current(), url: `${FOOD_ENTRIES_API_URL}/${id}`,
    isActive: () => ownerRef.current === userId && store.belongsTo(userId),
    onSettled: () => {
      if (ownerRef.current === userId && store.belongsTo(userId)) setShouldRefresh(true);
    },
  }), [store, dateKey, userId, setShouldRefresh]);
  const goals = useMemo(() => {
    const p = snapshot.profile || {};
    return { calorieGoal: p.calorieGoal ?? p.calorie_goal ?? p.calories,
      proteinGoal: p.proteinGoal ?? p.protein_goal ?? p.protein,
      carbsGoal: p.carbsGoal ?? p.carbs_goal ?? p.carbs,
      fatGoal: p.fatGoal ?? p.fat_goal ?? p.fat };
  }, [snapshot.profile]);
  const presentation = nutritionViewState(snapshot, dateKey, history);
  const retryError = useCallback(() => retryNutritionError(
    { error: presentation.error, profileError: presentation.profileError }, { refresh, refreshProfile }),
  [presentation.error, presentation.profileError, refresh, refreshProfile]);
  return { store, dateKey, ...presentation, goals, profile: snapshot.profile, dataByDate: snapshot.days,
    historyPending: Boolean(snapshot.pending.history), profilePending: Boolean(snapshot.pending.profile),
    refresh, refreshProfile, retryError, deleteEntry, isSessionActive, snapshot, loader };
}
