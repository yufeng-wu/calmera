import { useCallback } from "react";
import { InteractionManager } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

const pages = [
  () => import("@/app/(root)/theme"),
  () => import("@/app/(root)/update-goals"),
  () => import("@/app/(root)/voice-language"),
  () => import("@/app/(root)/chatgpt"),
  () => import("@/app/(root)/api-key"),
  () => import("@/app/(root)/export-data"),
  () => import("@/app/(root)/erase-data"),
  () => import("@/app/(root)/privacy"),
];
const warmed = new Set();

// Evaluate route modules while Settings is idle, rather than on the first tap.
// This does not mount screens, run their effects, load data or start providers.
export default function useWarmSettingsRoutes() {
  useFocusEffect(useCallback(() => {
    let active = true;
    let work;
    let index = 0;
    const next = () => {
      while (index < pages.length && warmed.has(index)) index += 1;
      if (!active || index === pages.length) return;
      const page = index++;
      work = InteractionManager.runAfterInteractions(() => {
        if (!active) return;
        pages[page]().then(() => warmed.add(page), () => {}).then(next);
      });
    };
    next();
    return () => { active = false; work?.cancel(); };
  }, []));
}
