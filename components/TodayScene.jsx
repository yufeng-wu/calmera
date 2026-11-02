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
const HERO_TOP = 43;
const COMPANION_SCALE = 56 / BUDDY_SIZE;
// Seated, the orange's left edge, and how far its base sinks into the grass so it never looks afloat.
const SEAT = { left: 78, sink: 5 };
const LIST_GAP = 30;
// Level with the seated orange's face, with its tail corner pointing back at it.
const PILL_ABOVE_BASE = 50;
// How long what she says stays up: a beat to read it, and a little longer for longer lines.
const speechMs = (text) => 1900 + text.length * 45;
const FALL = Easing.bezier(0.5, 0, 0.9, 0.5);
const RISE = Easing.bezier(0.2, 0.9, 0.3, 1.08);
const POP = Easing.bezier(0.2, 0.9, 0.3, 1.1);
const DROP = { lift: 0, fall: 250, land: 870, meals: 900, cheer: 1250, settled: 1430 };

export default function TodayScene({ hasMeals, children, greeting, lines, mood = "awake", progress = 0, isToday, bottomInset = 0, style }) {
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
  const seatX = SEAT.left + BUDDY_SIZE * COMPANION_SCALE / 2;
  const ridgeTilt = Math.atan2(hillTopAt(seatX + 20, width) - hillTopAt(seatX - 20, width), 40) * 180 / Math.PI;
  const [anchor, setAnchor] = useState(hasMeals ? "bottom" : "top");

  const grove = useSharedValue(hasMeals ? 0 : 1);
  const band = useSharedValue(hasMeals ? 0 : 1);
  const list = useSharedValue(hasMeals ? 1 : 0);
  const speech = useSharedValue(0);
  const [said, setSaid] = useState(null);
  const taps = useRef(0);
  const quiet = useRef(null);
  const dropping = useRef(false);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(hasMeals ? COMPANION_SCALE : 1);
  const sy = useSharedValue(hasMeals ? COMPANION_SCALE : 1);
  const ground = useSharedValue(hasMeals ? 1 : 0);
  const sun = useSharedValue(progress);
  const [cheerSignal, setCheerSignal] = useState(0);
  const [landSignal, setLandSignal] = useState(0);
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
      dropping.current = true;
      grove.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) });
      band.value = withDelay(320, withTiming(0, { duration: 560, easing: RISE }));
      const fall = { duration: 620, easing: FALL };
      const c = COMPANION_SCALE;
      const beat = (to, duration) => withTiming(to, { duration, easing: Easing.out(Easing.quad) });
      // Across first, then down, so she falls in a curve rather than along a rail.
      tx.value = withDelay(DROP.fall, withTiming(seat.x, { duration: fall.duration, easing: Easing.out(Easing.quad) }));
      // The bough lifts her a little before letting go, then she stretches as she speeds up. Through the
      // squash and the two hops the bottom of the fruit stays on the hill.
      ty.value = withSequence(beat(-9, DROP.fall), withTiming(seat.y, fall),
        beat(seat.y + 4.8, 100),
        beat(seat.y - 10.4, 140),
        withTiming(seat.y, { duration: 140, easing: Easing.in(Easing.quad) }),
        beat(seat.y + 1.6, 70),
        beat(seat.y, 90));
      sx.value = withSequence(beat(0.97, DROP.fall), withTiming(c * 0.9, fall), beat(0.8, 100), beat(0.66, 140), beat(c, 140), beat(0.73, 70), beat(c, 90));
      sy.value = withSequence(beat(1.04, DROP.fall), withTiming(c * 1.14, fall), beat(0.58, 100), beat(0.76, 140), beat(c, 140), beat(0.66, 70), beat(c, 90));
      // Her shadow gathers as she nears the hill, spreads on impact and tightens as she settles.
      ground.value = withDelay(DROP.fall + 300, withSequence(withTiming(1.25, { duration: 320, easing: Easing.in(Easing.quad) }), beat(0.7, 140), beat(1, 230)));
      list.value = withDelay(DROP.meals, withTiming(1, { duration: 420, easing: POP }));
      t(DROP.land, () => { setLandSignal((n) => n + 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {}); });
      t(DROP.cheer, () => setCheerSignal((n) => n + 1));
      t(DROP.lift + 420, () => setBough(false));
      // Settled: hand the seat to the bottom anchor, so later page resizes keep it on the hill.
      t(DROP.settled, () => { tx.value = 0; ty.value = 0; setAnchor("bottom"); dropping.current = false; });
      return () => { timers.current.forEach(clearTimeout); timers.current = []; };
    }
    grove.value = hasMeals ? 0 : 1;
    band.value = hasMeals ? 0 : 1;
    list.value = hasMeals ? 1 : 0;
    dropping.current = false;
    ground.value = hasMeals ? 1 : 0;
    sx.value = hasMeals ? COMPANION_SCALE : 1;
    sy.value = hasMeals ? COMPANION_SCALE : 1;
    tx.value = 0;
    ty.value = 0;
    setAnchor(hasMeals ? "bottom" : "top");
    setBough(!hasMeals);
    return undefined;
  }, [hasMeals, height, width, isToday, reducedMotion, seat.x, seat.y, grove, band, list, ground, tx, ty, sx, sy]);

  const groveStyle = useAnimatedStyle(() => ({ opacity: grove.value, transform: [{ translateY: (1 - grove.value) * -40 }] }));
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ translateY: band.value * bandHeight }] }));
  const listStyle = useAnimatedStyle(() => ({ opacity: list.value, transform: [{ translateY: (1 - list.value) * 14 }] }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, speech.value * 2), transform: [{ scale: 0.8 + speech.value * 0.2 }] }));
  const orangeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scaleX: sx.value }, { scaleY: sy.value }] }));

  // She only speaks when tapped: each tap moves to the next line, and it clears itself after a moment.
  const speak = () => {
    if (dropping.current || !lines?.length) return;
    const text = lines[taps.current % lines.length];
    taps.current += 1;
    setSaid(text);
    clearTimeout(quiet.current);
    speech.value = reducedMotion ? 1 : withSequence(withTiming(1.06, { duration: 170, easing: POP }), withTiming(1, { duration: 90 }));
    quiet.current = setTimeout(() => { speech.value = withTiming(0, { duration: 180 }); }, speechMs(text));
  };
  // A line belongs to the moment it was said in, so a new meal or a new day clears it.
  useEffect(() => { speech.value = 0; clearTimeout(quiet.current); }, [hasMeals, isToday, lines?.[0], speech]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(quiet.current), []);

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
      <HillScene progress={sun} tone={tone} height={bandHeight} ground={ground} seat={{ x: seatX, y: seatBase, width, tilt: ridgeTilt }} />
      {hasMeals && said && <Animated.View style={[styles.pill, { left: SEAT.left + BUDDY_SIZE * COMPANION_SCALE + 6, top: seatBase - PILL_ABOVE_BASE, maxWidth: width - SEAT.left - 72 }, pillStyle]}><Text style={styles.pillText}>{said}</Text></Animated.View>}
    </Animated.View>
    {height > 0 && <Animated.View style={[styles.orange, anchor === "top" ? hero : seatBox, orangeStyle]}>
      <CitrusBuddy mood={mood} hang={!hasMeals} cheerSignal={cheerSignal} landSignal={landSignal} onTap={speak} />
    </Animated.View>}
    {!hasMeals && said && <Animated.View pointerEvents="none" style={[styles.pill, { left: hero.left + BUDDY_SIZE + 2, top: HERO_TOP + 16, maxWidth: width - hero.left - BUDDY_SIZE - 18 }, pillStyle]}><Text style={styles.pillText}>{said}</Text></Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  scene: { flexGrow: 1, minHeight: 360 },
  grove: { position: "absolute", left: 0, right: 0, top: 0, height: GROVE_HEIGHT },
  greeting: { alignItems: "center", paddingTop: HERO_TOP + BUDDY_SIZE + 10, paddingHorizontal: 24 },
  // Above the band, so the sun's glow passes behind the cards.
  list: { paddingHorizontal: 16, paddingBottom: LIST_GAP, zIndex: 1 },
  band: { marginTop: "auto" },
  // Grows out of the corner that points at the orange.
  pill: { position: "absolute", transformOrigin: "0% 100%", paddingVertical: 6, paddingHorizontal: 11, borderRadius: 14, borderBottomLeftRadius: 4, backgroundColor: "#FFFFFF",
    shadowColor: "#4A3428", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 3 },
  pillText: { fontSize: 13, fontWeight: "600", color: "#4A3428" },
  orange: { position: "absolute" },
});
