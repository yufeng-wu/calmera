import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";

export default function usePageExit(fallback = "/dashboard") {
  const router = useRouter();
  const exiting = useRef(false);
  const focused = useRef(false);
  const navigation = useNavigation();
  useFocusEffect(useCallback(() => {
    focused.current = true;
    exiting.current = false;
    return () => { focused.current = false; exiting.current = true; };
  }, []));
  useEffect(() => navigation.addListener("beforeRemove", event => {
    // A draft guard can cancel an exit without blurring the page. Observe the
    // final event state after all guards run, then allow another explicit Back.
    Promise.resolve().then(() => {
      if (event.defaultPrevented && focused.current) exiting.current = false;
    });
  }), [navigation]);
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
