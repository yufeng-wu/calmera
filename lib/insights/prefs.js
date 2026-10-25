import { useCallback, useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_PREFS } from "./harness.mjs";

// Per-user and on this phone only; the harness is never sent to calmera's backend.
// One shared copy so the tab, chat and harness editor always agree.
const storageKey = (userId) => `calmera.insights.${userId || "preview"}`;
const cache = new Map();
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

export function useInsightPrefs(userId) {
  const key = storageKey(userId);
  const prefs = useSyncExternalStore(subscribe, () => cache.get(key) || DEFAULT_PREFS);
  useEffect(() => {
    if (cache.has(key)) return;
    AsyncStorage.getItem(key).then((value) => {
      if (!cache.has(key)) { cache.set(key, { ...DEFAULT_PREFS, ...(value ? JSON.parse(value) : {}) }); emit(); }
    }).catch(() => {});
  }, [key]);
  const save = useCallback((patch) => {
    const next = { ...(cache.get(key) || DEFAULT_PREFS), ...patch };
    cache.set(key, next); emit();
    AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
  }, [key]);
  return { prefs, save };
}
