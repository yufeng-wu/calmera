import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";

export function useMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    let mounted = true;
    let receivedMotionEvent = false;
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", value => {
      receivedMotionEvent = true;
      setReduceMotion(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted && !receivedMotionEvent) setReduceMotion(value);
    }).catch(() => {});
    const appState = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => {
      mounted = false;
      motion.remove();
      appState.remove();
    };
  }, []);
  return { reduceMotion, foreground };
}
