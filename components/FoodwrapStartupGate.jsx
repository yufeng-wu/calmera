import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { usePathname } from "expo-router";
import { AccountLoadingScreen } from "@/components/AccountProfileGate";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FOOD_ENTRIES_API_URL, USERS_API_URL } from "@/constants/api";
import { localDateKey } from "@/lib/nutritionStore.mjs";
import { readNutrition } from "@/lib/nutritionRequest.mjs";
import { createResumeRefreshPolicy } from "@/lib/resumeRefreshPolicy.mjs";

// The navigator stays mounted so data loading never discards a form draft.

export default function FoodwrapStartupGate({ children, disabled = false, topInset = 0 }) {
  const { userId, getToken } = useAuth();
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  currentPath.current = pathname;
  const { store } = useRefreshSignal();
  const token = useRef(getToken);
  token.current = getToken;
  const [preparing, setPreparing] = useState(!disabled);

  useEffect(() => {
    if (disabled) { setPreparing(false); return; }
    let mounted = true;
    let pending = null;
    const shouldRefresh = createResumeRefreshPolicy({ initialState: AppState.currentState });
    const onToday = () => ["/", "/dashboard"].includes(currentPath.current);
    const loader = ({ resource, date, signal }) => readNutrition({
      getToken: () => token.current(), signal,
      url: resource === "profile" ? `${USERS_API_URL}/get-user`
        : `${FOOD_ENTRIES_API_URL}/summary-by-date/${date}`,
      isActive: () => store.belongsTo(userId),
    });
    const prepare = (force = false, showLoading = true) => {
      if (!mounted || pending || !userId || !store.belongsTo(userId)) return;
      if (showLoading) setPreparing(true);
      pending = Promise.allSettled([
        store.loadProfile(loader, { force }),
        store.loadDay(localDateKey(), loader, { force }),
      ]).finally(() => {
        pending = null;
        // Errors live in the store and are shown by the real page with Retry.
        if (mounted) setPreparing(false);
      });
    };
    prepare();
    const subscription = AppState.addEventListener("change", next => {
      // Notification Center / Control Center only make the app inactive.
      // They neither hide the current page nor start the background clock.
      if (shouldRefresh(next)) prepare(true, onToday());
    });
    return () => { mounted = false; subscription.remove(); };
  }, [store, userId, disabled]);

  return <View style={styles.container}>
    <View style={[styles.container, preparing && styles.hidden]}
      pointerEvents={preparing ? "none" : "auto"}
      accessibilityElementsHidden={preparing}
      importantForAccessibility={preparing ? "no-hide-descendants" : "auto"}>
      {children}
    </View>
    {preparing && <View style={StyleSheet.absoluteFill}>
      <AccountLoadingScreen topInset={topInset} />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hidden: { opacity: 0 },
});
