import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useFocusEffect } from "@react-navigation/native";
import { USERS_API_URL } from "@/constants/api";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { profileGoals } from "@/hooks/useNutritionData";
import { readNutrition } from "@/lib/nutritionRequest.mjs";

// The signed-in profile and goals from the shared store, read again on focus once the
// store's copy is stale or a goals save has invalidated it (coming back from that page
// is a focus). Nothing else is loaded.
export default function useProfile() {
  const { userId, getToken, isLoaded } = useAuth();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const { store } = useRefreshSignal();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const loader = useCallback(({ signal }) => readNutrition({ getToken: () => tokenRef.current(), url: `${USERS_API_URL}/get-user`, signal,
    isActive: () => ownerRef.current === userId && store.belongsTo(userId) }), [store, userId]);
  useFocusEffect(useCallback(() => {
    if (!isLoaded || !userId || !store.belongsTo(userId)) return;
    store.loadProfile(loader).catch(() => {});
  }, [store, loader, isLoaded, userId]));
  const goals = useMemo(() => profileGoals(snapshot.profile), [snapshot.profile]);
  return { profile: snapshot.profile, goals, failed: !snapshot.profile && Boolean(snapshot.errors.profile) };
}
