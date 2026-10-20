import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

export default function usePageExit(fallback = "/dashboard") {
  const router = useRouter();
  const exiting = useRef(false);
  useFocusEffect(useCallback(() => {
    exiting.current = false;
    return () => { exiting.current = true; };
  }, []));
  return useCallback(() => {
    // Native buttons can deliver two presses before the first pop finishes.
    // Permit one exit per focus; returning to this page unlocks it again.
    if (exiting.current) return;
    exiting.current = true;
    try {
      // Review screens must never pop into account-backed pages below them.
      if (fallback === "/ui-gallery") router.replace(fallback);
      else if (router.canGoBack()) router.back();
      else router.replace(fallback);
    } catch (error) {
      exiting.current = false;
      throw error;
    }
  }, [router, fallback]);
}
