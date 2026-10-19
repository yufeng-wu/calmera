import { useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import { Redirect } from "expo-router";
import Constants from "expo-constants";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { COLORS } from "@/constants/colors";

export default function PerformanceCheck() {
  const { store } = useRefreshSignal();
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/dashboard" />;
  const counters = store.getDiagnostics();
  return <View style={{ flex: 1, padding: 28, gap: 16, backgroundColor: COLORS.background }}>
    <Text style={{ fontSize: 20, color: COLORS.text }}>Network request counts</Text>
    {Object.entries(counters).map(([key, value]) => <Text key={key} style={{ color: COLORS.text }}>{key}: {value}</Text>)}
    <Text style={{ color: COLORS.textLight }}>Diagnostic numbers only. No meals or account details are displayed.</Text>
  </View>;
}
