import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { styles as home } from "../assets/styles/home.styles";
import CitrusBuddy, { BUDDY_SIZE } from "./CitrusBuddy";
import GroveScene, { GROVE_HEIGHT } from "./GroveScene";
import HillScene, { HILL_BAND, hillTopAt } from "./HillScene";

// The orange's two homes. Empty, it hangs from a bough above the greeting. Once the first meal lands the
// bough lifts away, the orange drops, the hill rises to catch it, and from then on it sits under the list
// while the sun crosses the sky. Everything that moves lives in this one view, measured once, so the drop
// is a single choreography rather than two screens swapping.
const HERO_TOP = 46;
const COMPANION_SCALE = 56 / BUDDY_SIZE;
// Seated, the orange's left edge, and how far its base sinks into the grass so it never looks afloat.
const SEAT = { left: 62, sink: 5 };
const LIST_GAP = 30;
const FALL = Easing.bezier(0.5, 0, 0.9, 0.5);
const RISE = Easing.bezier(0.2, 0.9, 0.3, 1.08);
const POP = Easing.bezier(0.2, 0.9, 0.3, 1.1);
const DROP = { lift: 0, fall: 250, land: 870, meals: 900, line: 1200, cheer: 1250 };

export default function TodayScene({ hasMeals, children, greeting, line, mood = "awake", progress = 0, isToday, bottomInset = 0, style }) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [height, setHeight] = useState(0);
  const bandHeight = HILL_BAND + bottomInset;
  // Hanging, the orange is placed from the top of the scene; seated, from the bottom, so it stays on the
  // hill however the page above it resizes. The drop travels between the two in top coordinates.
  const hero = { left: width / 2 - BUDDY_SIZE / 2, top: HERO_TOP };
  // The scaled orange is drawn centred in its 80 pt box, so its base sits (1 + scale) / 2 of the box down.
  const seatBase = hillTopAt(SEAT.left + BUDDY_SIZE * COMPANION_SCALE / 2, width) + SEAT.sink;
  const seatBox = { left: SEAT.left - BUDDY_SIZE * (1 - COMPANION_SCALE) / 2, bottom: HILL_BAND - seatBase - BUDDY_SIZE * (1 - COMPANION_SCALE) / 2 };
  const seat = { x: seatBox.left - hero.left, y: height - seatBox.bottom - BUDDY_SIZE - hero.top };
  const [anchor, setAnchor] = useState(hasMeals ? "bottom" : "top");

  const grove = useSharedValue(hasMeals ? 0 : 1);
  const band = useSharedValue(hasMeals ? 0 : 1);
  const list = useSharedValue(hasMeals ? 1 : 0);
  const pill = useSharedValue(hasMeals ? 1 : 0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(hasMeals ? COMPANION_SCALE : 1);
  const sy = useSharedValue(hasMeals ? COMPANION_SCALE : 1);
  const sun = useSharedValue(progress);
  const [cheerSignal, setCheerSignal] = useState(0);
  const [bough, setBough] = useState(!hasMeals);
  const settled = useRef(null);
  const timers = useRef([]);

  useEffect(() => {
    sun.value = reducedMotion ? progress : withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, reducedMotion, sun]);

  useEffect(() => {
    if (!height) return undefined;
    const previous = settled.current;
    settled.current = hasMeals;
    if (previous === false && hasMeals && isToday && !reducedMotion) {
      // The drop: bough lifts, orange falls and squashes on the hill as it rises, meals spring in, the line pops.
      const t = (ms, fn) => timers.current.push(setTimeout(fn, ms));
      grove.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) });
      band.value = withDelay(320, withTiming(0, { duration: 560, easing: RISE }));
      const fall = { duration: 620, easing: FALL };
      tx.value = withDelay(DROP.fall, withTiming(seat.x, fall));
      // Keep the bottom of the fruit on the hill through the squash and the hop.
      ty.value = withDelay(DROP.fall, withSequence(withTiming(seat.y, fall),
        withTiming(seat.y + 4.8, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(seat.y - 10.4, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(seat.y, { duration: 140, easing: Easing.in(Easing.quad) })));
      sx.value = withDelay(DROP.fall, withSequence(withTiming(COMPANION_SCALE, fall), withTiming(0.8, { duration: 100 }), withTiming(0.66, { duration: 140 }), withTiming(COMPANION_SCALE, { duration: 140 })));
      sy.value = withDelay(DROP.fall, withSequence(withTiming(COMPANION_SCALE, fall), withTiming(0.58, { duration: 100 }), withTiming(0.76, { duration: 140 }), withTiming(COMPANION_SCALE, { duration: 140 })));
      list.value = withDelay(DROP.meals, withTiming(1, { duration: 420, easing: POP }));
      pill.value = withDelay(DROP.line, withSequence(withTiming(1.08, { duration: 220, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 100 })));
      t(DROP.land, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {}));
      t(DROP.cheer, () => setCheerSignal((n) => n + 1));
      t(DROP.lift + 420, () => setBough(false));
      // Settled: hand the seat to the bottom anchor, so later page resizes keep it on the hill.
      t(DROP.fall + 620 + 380 + 20, () => { tx.value = 0; ty.value = 0; setAnchor("bottom"); });
      return () => { timers.current.forEach(clearTimeout); timers.current = []; };
    }
    grove.value = hasMeals ? 0 : 1;
    band.value = hasMeals ? 0 : 1;
    list.value = hasMeals ? 1 : 0;
    pill.value = hasMeals ? 1 : 0;
    sx.value = hasMeals ? COMPANION_SCALE : 1;
    sy.value = hasMeals ? COMPANION_SCALE : 1;
    tx.value = 0;
    ty.value = 0;
    setAnchor(hasMeals ? "bottom" : "top");
    setBough(!hasMeals);
    return undefined;
  }, [hasMeals, height, width, isToday, reducedMotion, seat.x, seat.y, grove, band, list, pill, tx, ty, sx, sy]);

  const groveStyle = useAnimatedStyle(() => ({ opacity: grove.value, transform: [{ translateY: (1 - grove.value) * -40 }] }));
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ translateY: band.value * bandHeight }] }));
  const listStyle = useAnimatedStyle(() => ({ opacity: list.value, transform: [{ translateY: (1 - list.value) * 14 }] }));
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: pill.value }] }));
  const orangeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scaleX: sx.value }, { scaleY: sy.value }] }));

  const tone = mood === "asleep" ? "night" : mood === "happy" ? "evening" : "day";
  return <View style={[styles.scene, style]} onLayout={({ nativeEvent }) => setHeight(Math.round(nativeEvent.layout.height))}>
    {bough && <Animated.View pointerEvents="none" style={[styles.grove, groveStyle]}>
      <GroveScene night={mood === "asleep"} />
      {greeting && <View style={styles.greeting}>
        <Text style={home.emptyStateTitle}>{greeting.title}</Text>
        <Text style={home.emptyStateText}>{greeting.text}</Text>
      </View>}
    </Animated.View>}
    {hasMeals && <Animated.View style={[styles.list, listStyle]}>{children}</Animated.View>}
    <Animated.View pointerEvents="none" style={[styles.band, { height: bandHeight, marginBottom: -bottomInset }, bandStyle]}>
      <HillScene progress={sun} tone={tone} height={bandHeight} />
      {line && <Animated.View style={[styles.pill, { top: seatBase - BUDDY_SIZE * (1 + COMPANION_SCALE) / 2 + 2 }, pillStyle]}><Text style={styles.pillText}>{line}</Text></Animated.View>}
    </Animated.View>
    {height > 0 && <Animated.View style={[styles.orange, anchor === "top" ? hero : seatBox, orangeStyle]}>
      <CitrusBuddy mood={mood} hang={!hasMeals} cheerSignal={cheerSignal} />
    </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  scene: { flexGrow: 1, minHeight: 360 },
  grove: { position: "absolute", left: 0, right: 0, top: 0, height: GROVE_HEIGHT },
  greeting: { alignItems: "center", paddingTop: HERO_TOP + BUDDY_SIZE + 10, paddingHorizontal: 24 },
  list: { paddingHorizontal: 16, paddingBottom: LIST_GAP },
  band: { marginTop: "auto" },
  // Beside the seated orange's head, clear of the Add button on the right.
  pill: { position: "absolute", left: 124, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 14, borderBottomLeftRadius: 4, backgroundColor: "#FFFFFF",
    shadowColor: "#4A3428", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 3 },
  pillText: { fontSize: 13, fontWeight: "600", color: "#4A3428" },
  orange: { position: "absolute" },
});
