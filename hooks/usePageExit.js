import { useCallback } from "react";
import { useRouter } from "expo-router";

export default function usePageExit(fallback = "/dashboard") {
  const router = useRouter();
  return useCallback(() => {
    // Review screens must never pop into account-backed pages below them.
    if (fallback === "/ui-gallery") router.replace(fallback);
    else if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
