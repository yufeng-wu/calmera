import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { AccountLoadingScreen } from "@/components/AccountProfileGate";
import { todayCache, useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FOOD_ENTRIES_API_URL, USERS_API_URL } from "@/constants/api";
import { localDateKey } from "@/lib/nutritionStore.mjs";
import { readNutrition } from "@/lib/nutritionRequest.mjs";

// With nothing saved, Today gets this long to arrive, so a good connection opens on full numbers.
const READY_WAIT_MS = 1000;

// Holds launch only until there is something real to show: a saved Today, a fresh one, or the wait above.
// Returning to the app never waits, because the data already in memory is still good to show.
export default function FoodwrapStartupGate({ children, disabled = false, topInset = 0 }) {
  const { userId, getToken } = useAuth();
  const { store } = useRefreshSignal();
  const token = useRef(getToken);
  token.current = getToken;
  const [preparing, setPreparing] = useState(!disabled);

  useEffect(() => {
    if (disabled) { setPreparing(false); return; }
    let mounted = true;
    const reveal = () => { if (mounted) setPreparing(false); };
    const timer = setTimeout(reveal, READY_WAIT_MS);
    const loader = ({ resource, date, signal }) => readNutrition({
      getToken: () => token.current(), signal,
      url: resource === "profile" ? `${USERS_API_URL}/get-user`
        : `${FOOD_ENTRIES_API_URL}/summary-by-date/${date}`,
      isActive: () => store.belongsTo(userId),
    });
    if (userId && store.belongsTo(userId)) {
      const today = localDateKey();
      // Errors live in the store and are shown by the real page with Retry.
      Promise.allSettled([store.loadProfile(loader), store.loadDay(today, loader)]).finally(reveal);
      todayCache.read(userId, today).then((saved) => {
        if (!saved) return;
        store.hydrate(saved);
        if (saved.day && saved.profile) reveal();
      });
    }
    return () => { mounted = false; clearTimeout(timer); };
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
