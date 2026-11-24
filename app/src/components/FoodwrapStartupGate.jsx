import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import AppLoadingScreen from "@/components/AppLoadingScreen";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { dataLoader, localDateKey } from "@/lib/nutritionStore.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { useDataStore } from "@/lib/store";

// Today lives on this iPhone, so it's usually ready long before this gives up waiting.
const READY_WAIT_MS = 1000;

// Holds launch only until there is something real to show: Today and the goals, or the wait above.
// Returning to the app never waits, because the data already in memory is still good to show.
export default function FoodwrapStartupGate({ children, disabled = false }) {
  const { store } = useRefreshSignal();
  const data = useDataStore();
  const [preparing, setPreparing] = useState(!disabled);

  useEffect(() => {
    if (disabled) { setPreparing(false); return; }
    let mounted = true;
    const reveal = () => { if (mounted) setPreparing(false); };
    const timer = setTimeout(reveal, READY_WAIT_MS);
    const loader = dataLoader(data, () => store.belongsTo(LOCAL_OWNER));
    // Errors live in the store and are shown by the real page with Retry.
    Promise.allSettled([store.loadProfile(loader), store.loadDay(localDateKey(), loader)]).finally(reveal);
    return () => { mounted = false; clearTimeout(timer); };
  }, [store, data, disabled]);

  return <View style={styles.container}>
    <View style={[styles.container, preparing && styles.hidden]}
      pointerEvents={preparing ? "none" : "auto"}
      accessibilityElementsHidden={preparing}
      importantForAccessibility={preparing ? "no-hide-descendants" : "auto"}>
      {children}
    </View>
    {preparing && <View style={StyleSheet.absoluteFill}>
      <AppLoadingScreen />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hidden: { opacity: 0 },
});
