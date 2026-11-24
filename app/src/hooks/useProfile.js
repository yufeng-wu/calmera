import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { profileGoals } from "@/hooks/useNutritionData";
import { dataLoader } from "@/lib/store/nutritionStore.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { useDataStore } from "@/lib/store";

// The profile and goals from the shared store, read again on focus once the
// store's copy is stale or a goals save has invalidated it (coming back from that page
// is a focus). Nothing else is loaded.
export default function useProfile() {
  const userId = LOCAL_OWNER, isLoaded = true;
  const data = useDataStore();
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const { store } = useRefreshSignal();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const loader = useMemo(() => dataLoader(data, () => ownerRef.current === userId && store.belongsTo(userId)),
    [data, store, userId]);
  useFocusEffect(useCallback(() => {
    if (!isLoaded || !userId || !store.belongsTo(userId)) return;
    store.loadProfile(loader).catch(() => {});
  }, [store, loader, isLoaded, userId]));
  const goals = useMemo(() => profileGoals(snapshot.profile), [snapshot.profile]);
  return { profile: snapshot.profile, goals, failed: !snapshot.profile && Boolean(snapshot.errors.profile) };
}
