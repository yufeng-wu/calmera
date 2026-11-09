import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";
import { foodSteps, MOST_STEPS } from "@/lib/foodSteps.mjs";

// One soft shade, a little see-through, reads as a print pressed into the hill on the gold day hill and the
// lavender night one alike, so the prints never need recolouring as the sky turns.
const SHADE = "#7A4E62";
const STRENGTH = 0.26;
// Each print is drawn once, pointing up, in a small square of its own centred on its step.
const BOX = 14;
// A new step presses in: it settles from a little larger into the hill as it shows. When several foods come in
// together, their steps land one after another, oldest first, like walking up to her.
const PRESS = { from: 1.3, duration: 460, between: 220, most: 3 };
// After coming back to the page (from logging a meal, say), a beat for the page to settle first.
const AFTER_RETURN = 350;
// The first food lands with the orange: its step follows once she has settled on the hill.
const AFTER_LANDING = 1300;

// A right foot, drawn small: a rounded sole and three toes, the biggest on the inside. A left foot is its mirror.
const Foot = memo(function Foot({ mirrored }) {
  return <Svg width={BOX} height={BOX} viewBox={`${-BOX / 2} ${-BOX / 2} ${BOX} ${BOX}`}>
    <G transform={mirrored ? "scale(-1 1)" : undefined} fill={SHADE}>
      <Path d="M-0.4 -2.9 C1.9 -3.3 3.1 -1.6 2.9 0.9 C2.7 3.3 1.4 4.9 -0.2 4.9 C-1.8 4.9 -2.9 3.4 -2.8 1.1 C-2.7 -1.2 -2.2 -2.6 -0.4 -2.9 Z" />
      <Circle cx={-1.75} cy={-4.65} r={1.2} />
      <Circle cx={0.35} cy={-5.15} r={0.98} />
      <Circle cx={2.2} cy={-4.3} r={0.82} />
    </G>
  </Svg>;
});

// The day's food steps on the hill: one per food, climbing to the orange, newest at her feet. Still drawings that
// only change when a food is added or removed; the only motion is a new step pressing in, once, on the native
// driver. Nothing runs between meals. `seat` is the bottom-centre of the seated orange, in the band's points.
export default memo(function FoodSteps({ count, seat, seed, active, arriving }) {
  const steps = useMemo(() => foodSteps({ count, seat, width: seat.width, seed }), [count, seat, seed]);
  const reducedMotion = useReducedMotion();
  // How many foods the trail has shown its steps for. Arriving with the orange, the first step is still to come.
  const shown = useRef(arriving && !reducedMotion ? 0 : count);
  const landing = useRef(arriving && !reducedMotion);
  const press = useRef(Array.from({ length: MOST_STEPS }, (_, k) => new Animated.Value(k < count - shown.current ? 0 : 1))).current;

  useEffect(() => {
    const fresh = Math.min(PRESS.most, MOST_STEPS, count - shown.current);
    if (fresh <= 0 || reducedMotion) {
      shown.current = count;
      press.forEach((value) => value.setValue(1));
      return undefined;
    }
    // New steps wait, hidden, until the page is showing to press them in.
    press.forEach((value, k) => value.setValue(k < fresh ? 0 : 1));
    if (!active) return undefined;
    const wait = landing.current ? AFTER_LANDING : AFTER_RETURN;
    landing.current = false;
    shown.current = count;
    const animation = Animated.parallel(Array.from({ length: fresh }, (_, k) => Animated.timing(press[k], {
      toValue: 1, duration: PRESS.duration, delay: wait + (fresh - 1 - k) * PRESS.between,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    })));
    animation.start();
    // Interrupted (the page left, or another food came in), the steps show in full rather than stopping halfway.
    return () => { animation.stop(); press.forEach((value) => value.setValue(1)); };
  }, [count, active, reducedMotion, press]);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {steps.map((step, k) => <Animated.View key={k} style={[styles.step, {
      left: step.x - BOX / 2,
      top: step.y - BOX / 2,
      opacity: Animated.multiply(press[k], STRENGTH * step.strength),
      transform: [{ rotate: `${step.turn}deg` }, { scale: press[k].interpolate({ inputRange: [0, 1], outputRange: [PRESS.from, 1] }) }],
    }]}>
      <Foot mirrored={step.foot === "left"} />
    </Animated.View>)}
  </View>;
});

const styles = StyleSheet.create({ step: { position: "absolute", width: BOX, height: BOX } });
