import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

// UIKit owns the pull threshold, feedback and inset animation. The only app
// state is the actual request lifetime; never extend it to time an animation.
export default function FoodwrapRefreshScrollView({ children, onRefresh, active = true, ...props }) {
  const mounted = useRef(true);
  const busy = useRef(false);
  const current = useRef({ active, onRefresh });
  current.current = { active, onRefresh };
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current || !current.current.active) return;
    busy.current = true;
    setRefreshing(true);
    try {
      await current.current.onRefresh();
    } catch {
      // The data owner keeps cached meals and displays its retry state.
    } finally {
      busy.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  return <ScrollView {...props} alwaysBounceVertical
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}
      enabled={active} tintColor={COLORS.primary} colors={[COLORS.primary]}
      title={refreshing ? "Fetching data…" : "Pull to refresh"} titleColor={COLORS.textLight} />}
  >{children}</ScrollView>;
}
