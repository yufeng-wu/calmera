import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppState, InteractionManager } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useIsFocused } from "@react-navigation/native";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FOOD_ENTRIES_API_URL, USERS_API_URL } from "@/constants/api";
import { localDateKey } from "@/lib/nutritionStore.mjs";
import { nutritionViewState, retryNutritionError } from "@/lib/nutritionPresentation.mjs";

export function useNutritionData(date = new Date(), history = false) {
  const { userId, getToken, isLoaded } = useAuth();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const { store, entriesRevision, goalsRevision, setShouldRefresh } = useRefreshSignal();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const focused = useIsFocused();
  const [wakeVersion, setWakeVersion] = useState(0);
  const dateKey = localDateKey(date);
  const loader = useCallback(async ({ resource, date: day, signal }) => {
    const token = await tokenRef.current();
    if (!store.isActive()) throw new Error("nutrition_store_disposed");
    if (!token) throw new Error("calmera_sign_in_required");
    const url = resource === "profile" ? `${USERS_API_URL}/get-user`
      : resource === "history" ? `${FOOD_ENTRIES_API_URL}/summaries`
        : `${FOOD_ENTRIES_API_URL}/summary-by-date/${day}`;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) controller.abort();
    const timeout = setTimeout(abort, 20000);
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      if (!response.ok) throw new Error(`nutrition_http_${response.status}`);
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted && !signal.aborted) throw new Error("nutrition_request_timeout");
      throw error;
    } finally { clearTimeout(timeout); signal.removeEventListener("abort", abort); }
  }, [store]);
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
  const deleteEntry = useCallback(async (id) => {
    if (!store.belongsTo(userId)) return;
    const removal = store.removeOptimistically(dateKey, id);
    if (!removal) return;
    let succeeded = false;
    try {
      const token = await tokenRef.current();
      if (!store.belongsTo(userId)) return;
      if (!token) throw new Error("calmera_sign_in_required");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(`${FOOD_ENTRIES_API_URL}/${id}`, { method: "DELETE", signal: controller.signal, headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("meal_delete_failed");
        succeeded = true;
      } finally { clearTimeout(timeout); }
    } finally { store.finishRemoval(removal, succeeded); if (store.isActive()) setShouldRefresh(true); }
  }, [store, dateKey, userId, setShouldRefresh]);
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
    refresh, refreshProfile, retryError, deleteEntry, snapshot, loader };
}
