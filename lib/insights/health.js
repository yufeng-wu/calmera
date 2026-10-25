import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import AsyncStorage from "@react-native-async-storage/async-storage";

const native = Platform.OS === "ios" ? requireOptionalNativeModule("CalmeraChatGPT") : null;
const supported = Boolean(native?.healthSummary && native.healthAvailable?.());
const connectedKey = (userId) => `calmera.insights.health.${userId || "preview"}`;
const hasData = (summary) => Object.values(summary?.series || {}).some((values) => values.some((value) => value >= 0));

// Read-only Apple Health summary. The user opts in once; Apple's own sheet
// decides which types are shared. Simulators get seeded sample data.
export function useHealth(userId, days = 60) {
  const [state, setState] = useState({ status: supported ? "checking" : "unavailable", summary: null });

  const load = useCallback(async () => {
    let summary = await native.healthSummary(days);
    // seedSampleHealth only writes in simulator builds; on a device it returns 0.
    if (!hasData(summary) && native.seedSampleHealth) {
      if (await native.seedSampleHealth() > 0) summary = await native.healthSummary(days);
    }
    setState({ status: "ready", summary });
  }, [days]);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    AsyncStorage.getItem(connectedKey(userId)).then((value) => {
      if (!active) return;
      if (value === "1") load().catch(() => active && setState({ status: "error", summary: null }));
      else setState({ status: "off", summary: null });
    }).catch(() => active && setState({ status: "off", summary: null }));
    return () => { active = false; };
  }, [userId, load]);

  const connect = useCallback(async () => {
    if (!supported) return;
    setState((current) => ({ ...current, status: "checking" }));
    try {
      await native.requestHealthAccess();
      await AsyncStorage.setItem(connectedKey(userId), "1");
      await load();
    } catch {
      setState({ status: "error", summary: null });
    }
  }, [userId, load]);

  return { ...state, connect };
}
