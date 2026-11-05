import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, RefreshControl, ScrollView } from "react-native";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

// UIKit owns the pull threshold, feedback and inset animation. The only app
// state is the actual request lifetime; never extend it to time an animation.
// No title: UIKit swaps it before the spinner collapses, so text flashes.
//
// UIKit can be left drawing a spinner it no longer tracks when a refresh ends
// while the screen is off the window (another tab, a pushed page, the app in
// the background) or while the finger is still down, and the New Architecture
// guards neither case. So a refresh ends only once the finger lifts, leaving
// the screen drops its spinner (the request still finishes), and every return
// to the screen mounts a fresh native control, so a stuck one can't stay.
export default function FoodwrapRefreshScrollView({ children, onRefresh, active = true, scrollRef,
  onScrollBeginDrag, onScrollEndDrag, ...props }) {
  const mounted = useRef(true);
  const latest = useRef(onRefresh);
  latest.current = onRefresh;
  const [foreground, setForeground] = useState(AppState.currentState !== "background");
  const visible = active && foreground;
  // Counts returns to the screen; the control is keyed by it.
  const visits = useRef({ count: 0, visible });
  if (visible && !visits.current.visible) visits.current.count += 1;
  visits.current.visible = visible;
  // The pull whose spinner shows, and the visit it began in.
  const [pull, setPull] = useState(null);
  const pulls = useRef(0);
  const request = useRef(null);
  const dragging = useRef(false);
  const endOnRelease = useRef(0);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", state => setForeground(state !== "background"));
    return () => { mounted.current = false; subscription.remove(); };
  }, []);

  const refresh = useCallback(async () => {
    const id = ++pulls.current;
    setPull({ id, visit: visits.current.count });
    // A pull while one is still running joins it instead of starting another.
    request.current ??= (async () => {
      try { await latest.current(); } catch {
        // The data owner keeps cached meals and displays its retry state.
      } finally { request.current = null; }
    })();
    await request.current;
    if (!mounted.current || pulls.current !== id) return;
    if (dragging.current) endOnRelease.current = id;
    else setPull(null);
  }, []);

  const beginDrag = event => {
    dragging.current = true;
    onScrollBeginDrag?.(event);
  };
  const endDrag = event => {
    dragging.current = false;
    onScrollEndDrag?.(event);
    const id = endOnRelease.current;
    if (!id) return;
    endOnRelease.current = 0;
    // Let UIKit take the release first, then end the refresh.
    requestAnimationFrame(() => { if (mounted.current && pulls.current === id) setPull(null); });
  };

  const refreshing = Boolean(pull) && visible && pull.visit === visits.current.count;
  return <ScrollView {...props} ref={scrollRef} alwaysBounceVertical
    onScrollBeginDrag={beginDrag} onScrollEndDrag={endDrag}
    refreshControl={<RefreshControl key={visits.current.count} refreshing={refreshing} onRefresh={refresh}
      enabled={active} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
  >{children}</ScrollView>;
}
