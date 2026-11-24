import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createNutritionStore } from "@/lib/store/nutritionStore.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";

const EntriesRefreshContext = createContext(null);

// The in-memory copy of meals and goals that every screen shares. The data itself lives in
// lib/store; a reset after Erase all data mounts a new provider, and with it a new copy.
export const EntriesRefreshProvider = ({ children }) => {
  const store = useMemo(() => createNutritionStore({ ownerKey: LOCAL_OWNER }), []);
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
