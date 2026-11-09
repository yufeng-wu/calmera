import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Ellipse, G } from "react-native-svg";
import { MOST_PRINTS, pawTrail, pawVisitor } from "@/lib/pawTrail.mjs";

// One soft shade, a little see-through, reads as a print pressed into the hill on the gold day hill and the
// lavender night one alike, so the prints never need recolouring as the sky turns.
const SHADE = "#7A4E62";
const STRENGTH = 0.3;
// Each print is drawn once, pointing up, in a small square of its own centred on its place.
const BOX = 14;
const PAW_SCALE = 1.25;
// A new print presses in: it settles from a little larger into the hill as it shows. When several foods come in
// together, their prints land one after another, oldest first, like the visitor trotting up to her.
const PRESS = { from: 1.3, duration: 460, between: 220, most: 3 };
// After coming back to the page (from logging a meal, say), a beat for the page to settle first.
const AFTER_RETURN = 350;
// The first food lands with the orange: its print follows once she has settled on the hill.
const AFTER_LANDING = 1300;

// A pad and four toes, the outer two turned out. A dog's paw is a little wider than a cat's.
const Paw = memo(function Paw({ kind }) {
  const wide = kind === "dog";
  const outer = wide ? 2.5 : 2.1;
  const inner = wide ? 0.9 : 0.75;
  return <Svg width={BOX} height={BOX} viewBox={`${-BOX / 2} ${-BOX / 2} ${BOX} ${BOX}`}>
    <G transform={`scale(${PAW_SCALE})`} fill={SHADE}>
      <Ellipse cy={1.1} rx={wide ? 2.4 : 1.9} ry={wide ? 1.9 : 1.6} />
      <Ellipse cx={-outer} cy={-0.7} rx={0.8} ry={1.05} transform={`rotate(-22 ${-outer} -0.7)`} />
      <Ellipse cx={-inner} cy={-2.2} rx={0.8} ry={1.1} />
      <Ellipse cx={inner} cy={-2.2} rx={0.8} ry={1.1} />
      <Ellipse cx={outer} cy={-0.7} rx={0.8} ry={1.05} transform={`rotate(22 ${outer} -0.7)`} />
    </G>
  </Svg>;
});

// The day's paw trail on the hill: a dog or cat, picked by the date, leaves one print per food, climbing to the
// orange, newest at her feet. Still drawings that only change when a food is added or removed; the only motion is a
// new print pressing in, once, on the native driver. Nothing runs between meals. `seat` is the bottom-centre of the
// seated orange, in the band's points.
export default memo(function PawTrail({ count, seat, seed, active, arriving }) {
  const kind = pawVisitor(seed);
  const prints = useMemo(() => pawTrail({ count, seat, width: seat.width, seed, kind }), [count, seat, seed, kind]);
  const reducedMotion = useReducedMotion();
  // How many foods the trail has shown prints for. Arriving with the orange, the first print is still to come.
  const shown = useRef(arriving && !reducedMotion ? 0 : count);
  const landing = useRef(arriving && !reducedMotion);
  const press = useRef(Array.from({ length: MOST_PRINTS }, (_, k) => new Animated.Value(k < count - shown.current ? 0 : 1))).current;

  useEffect(() => {
    const fresh = Math.min(PRESS.most, MOST_PRINTS, count - shown.current);
    if (fresh <= 0 || reducedMotion) {
      shown.current = count;
      press.forEach((value) => value.setValue(1));
      return undefined;
    }
    // New prints wait, hidden, until the page is showing to press them in.
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
    // Interrupted (the page left, or another food came in), the prints show in full rather than stopping halfway.
    return () => { animation.stop(); press.forEach((value) => value.setValue(1)); };
  }, [count, active, reducedMotion, press]);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {prints.map((print, k) => <Animated.View key={k} style={[styles.print, {
      left: print.x - BOX / 2,
      top: print.y - BOX / 2,
      opacity: Animated.multiply(press[k], STRENGTH * print.strength),
      transform: [{ rotate: `${print.turn}deg` }, { scale: press[k].interpolate({ inputRange: [0, 1], outputRange: [PRESS.from, 1] }) }],
    }]}>
      <Paw kind={kind} />
    </Animated.View>)}
  </View>;
});

const styles = StyleSheet.create({ print: { position: "absolute", width: BOX, height: BOX } });
