import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { createNutritionStore } from "@/lib/nutritionStore.mjs";

const EntriesRefreshContext = createContext(null);

export const EntriesRefreshProvider = ({ children }) => {
  const { userId } = useAuth();
  const store = useMemo(() => createNutritionStore({ ownerKey: userId }), [userId]);
  const [entriesRevision, setEntriesRevision] = useState(0);
  const [goalsRevision, setGoalsRevision] = useState(0);
  useEffect(() => { store.retain(); return () => store.release(); }, [store]);
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
