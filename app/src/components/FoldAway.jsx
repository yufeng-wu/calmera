import { useEffect, useRef } from "react";
import Animated, { Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

// A deleted meal (or its whole group) fades and settles back a touch, then its height closes, so what is below
// slides up into its place by real layout, frame by frame. Nothing is clipped: the fading row passes under its
// neighbours, which draw on top. System Reduce Motion makes it immediate.
const FOLD = { duration: 400, easing: Easing.inOut(Easing.cubic) };

export default function FoldAway({ leaving, onGone, children }) {
  const height = useSharedValue(0);
  const fold = useSharedValue(1);
  const folding = useSharedValue(0);
  const gone = useRef(onGone);
  gone.current = onGone;
  const state = useRef("still");
  useEffect(() => {
    if (!leaving || state.current !== "still") return;
    state.current = "folding";
    const finish = () => {
      if (state.current !== "folding") return;
      state.current = "gone";
      gone.current?.();
    };
    folding.value = 1;
    fold.value = withTiming(0, FOLD, (finished) => { if (finished) runOnJS(finish)(); });
  }, [leaving, fold, folding]);
  // Taken away mid-fold (another day picked, say), the meal still goes.
  useEffect(() => () => {
    if (state.current !== "folding") return;
    state.current = "gone";
    gone.current?.();
  }, []);
  const style = useAnimatedStyle(() => folding.value ? {
    height: height.value * fold.value,
    opacity: interpolate(fold.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(fold.value, [0.4, 1], [0.97, 1], Extrapolation.CLAMP) }],
  } : {});
  return <Animated.View style={style} pointerEvents={leaving ? "none" : "box-none"}
    onLayout={leaving ? undefined : ({ nativeEvent }) => { height.value = nativeEvent.layout.height; }}>
    {children}
  </Animated.View>;
}
