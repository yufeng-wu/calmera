import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Easing, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { minutesOf, nearestClock } from "@/lib/today/skyClock.mjs";

const TICK_MS = 60000;
// A minute moves the sun a fraction of a point, too little to see, so a tick just sets the new time: one redraw
// a minute instead of an animation. Coming back after hours away is a real change, so the sky takes its time,
// longer the further it has to go, or a whole dusk would race past in a blink.
const returnGlide = (change) => ({ duration: Math.min(2400, Math.max(800, change * 5)), easing: Easing.inOut(Easing.sin) });
const BIG_CHANGE = 5;
const NO_CHANGE = 0.05;

// Local minutes since midnight as a shared value that never wraps, for the sky to read. Every day shows the sky
// as it is now, so moving between days never changes it. It runs only while the app is open and this screen is
// showing, and only redraws the sky when there is something to move.
export default function useSkyClock({ active = true } = {}) {
  const reducedMotion = useReducedMotion();
  const read = () => minutesOf(new Date());
  const last = useRef(null);
  if (last.current === null) last.current = read();
  const clock = useSharedValue(last.current);

  useEffect(() => {
    const update = () => {
      const target = nearestClock(last.current, read());
      const change = Math.abs(target - last.current);
      if (change < NO_CHANGE) return;
      last.current = target;
      clock.value = reducedMotion || change <= BIG_CHANGE ? target : withTiming(target, returnGlide(change));
    };
    if (!active) return undefined;
    let timer = null;
    const start = () => {
      clearInterval(timer);
      update();
      timer = setInterval(update, TICK_MS);
    };
    start();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else clearInterval(timer);
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [clock, reducedMotion, active]);

  return clock;
}
