import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";
import { createNutritionStore, localDateKey } from "@/lib/nutritionStore.mjs";
import { createTodayCache } from "@/lib/todayCache.mjs";

const EntriesRefreshContext = createContext(null);

export const todayCache = createTodayCache(AsyncStorage);

export const EntriesRefreshProvider = ({ children }) => {
  const { userId } = useAuth();
  // A store is only disposed when its account leaves this device, which takes the saved Today with it.
  const store = useMemo(() => createNutritionStore({ ownerKey: userId,
    onDispose: () => { if (userId) todayCache.clear(userId); } }), [userId]);
  const [entriesRevision, setEntriesRevision] = useState(0);
  const [goalsRevision, setGoalsRevision] = useState(0);
  useEffect(() => { store.retain(); return () => store.release(); }, [store]);
  useEffect(() => {
    if (!userId) return;
    let saved = {};
    return store.subscribe(() => {
      const { days, profile } = store.getSnapshot();
      const date = localDateKey();
      if (days[date] === saved.day && profile === saved.profile) return;
      saved = { day: days[date], profile };
      todayCache.write(userId, { date, day: days[date], profile });
    });
  }, [store, userId]);
  const setShouldRefresh = useCallback((changed) => {
    if (!changed) return;
    store.invalidateEntries();
    setEntriesRevision((value) => value + 1);
  }, [store]);
  const setShouldRefreshGoals = useCallback((changed) => {
    if (!changed) return;
    store.invalidateProfile();
    setGoalsRevision((value) => value + 1);
  }, [store]);
  const value = useMemo(() => ({ store, entriesRevision, goalsRevision, setShouldRefresh, setShouldRefreshGoals }),
    [store, entriesRevision, goalsRevision, setShouldRefresh, setShouldRefreshGoals]);
  return <EntriesRefreshContext.Provider value={value}>{children}</EntriesRefreshContext.Provider>;
};

export const useRefreshSignal = () => useContext(EntriesRefreshContext);
