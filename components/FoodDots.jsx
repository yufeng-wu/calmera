import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { foodDots, MOST_DOTS } from "@/lib/foodDots.mjs";

// One soft shade, a little see-through, reads as part of the hill on the gold day hill and the lavender night one
// alike, so the dots never need recolouring as the sky turns.
const SHADE = "#7A4E62";
const STRENGTH = 0.3;
const SIZE = 6;
// A new dot grows in with a small overshoot. When several foods come in together, their dots arrive one after
// another, oldest first, up the hill towards her.
const GROW = { duration: 420, between: 200, most: 3 };
// After coming back to the page (from logging a meal, say), a beat for the page to settle first.
const AFTER_RETURN = 350;
// The first food lands with the orange: its dot follows once she has settled on the hill.
const AFTER_LANDING = 1300;

// The day's food dots on the hill: one per food, climbing to the orange, newest at her feet. Plain native circles
// that only change when a food is added or removed; the only motion is a new dot growing in, once, on the native
// driver. Nothing runs between meals. `seat` is the bottom-centre of the seated orange, in the band's points.
export default memo(function FoodDots({ count, seat, seed, active, arriving }) {
  const dots = useMemo(() => foodDots({ count, seat, width: seat.width, seed }), [count, seat, seed]);
  const reducedMotion = useReducedMotion();
  // How many foods the trail has shown dots for. Arriving with the orange, the first dot is still to come.
  const shown = useRef(arriving && !reducedMotion ? 0 : count);
  const landing = useRef(arriving && !reducedMotion);
  const grow = useRef(Array.from({ length: MOST_DOTS }, (_, k) => new Animated.Value(k < count - shown.current ? 0 : 1))).current;

  useEffect(() => {
    const fresh = Math.min(GROW.most, MOST_DOTS, count - shown.current);
    if (fresh <= 0 || reducedMotion) {
      shown.current = count;
      grow.forEach((value) => value.setValue(1));
      return undefined;
    }
    // New dots wait, hidden, until the page is showing to grow them in.
    grow.forEach((value, k) => value.setValue(k < fresh ? 0 : 1));
    if (!active) return undefined;
    const wait = landing.current ? AFTER_LANDING : AFTER_RETURN;
    landing.current = false;
    shown.current = count;
    const animation = Animated.parallel(Array.from({ length: fresh }, (_, k) => Animated.timing(grow[k], {
      toValue: 1, duration: GROW.duration, delay: wait + (fresh - 1 - k) * GROW.between,
      easing: Easing.out(Easing.back(1.6)), useNativeDriver: true,
    })));
    animation.start();
    // Interrupted (the page left, or another food came in), the dots show in full rather than stopping halfway.
    return () => { animation.stop(); grow.forEach((value) => value.setValue(1)); };
  }, [count, active, reducedMotion, grow]);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {dots.map((dot, k) => <Animated.View key={k} style={[styles.dot, {
      left: dot.x - SIZE / 2,
      top: dot.y - SIZE / 2,
      opacity: Animated.multiply(grow[k].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }), STRENGTH * dot.strength),
      transform: [{ scale: grow[k] }],
    }]} />)}
  </View>;
});

const styles = StyleSheet.create({ dot: { position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: SHADE } });
