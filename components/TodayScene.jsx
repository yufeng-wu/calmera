import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Easing, measure, useAnimatedRef, useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { styles as home } from "../assets/styles/home.styles";
import CitrusBuddy, { BUDDY_SIZE } from "./CitrusBuddy";
import { LinearGradient } from "expo-linear-gradient";
import { skyAt, skyFade } from "../lib/skyClock.mjs";
import GroveScene, { GROVE_HEIGHT } from "./GroveScene";
import { DUSK_WASH_STRENGTH, WASH } from "./SkyLayer";
import HillScene, { HILL_BAND, hillTopAt, SKY_POINTS } from "./HillScene";
import useSkyClock from "../hooks/useSkyClock";
import { buddyFace } from "../lib/nutritionPresentation.mjs";

// The orange's two homes. Empty, it hangs from a bough above the greeting, part of the page. Once the first meal
// lands the bough lifts away, the orange drops, the hill rises to catch it, and from then on it sits on the hill.
// The hill, its sky and the seated orange are a stage pinned to the bottom of the screen, behind the page: the
// list scrolls over them, and the page leaves room at its end to show the whole scene. The stage is drawn by a
// host outside the scroll view (TodayStageHost), and this component sends it what to draw.
const HERO_TOP = 43;
const COMPANION_SCALE = 56 / BUDDY_SIZE;
// Seated, the orange's left edge, and how far the fruit overlaps the hill, so it plainly rests on it.
const SEAT = { left: 78, sink: 7 };
// The fruit stops short of its 80 pt box: its base is 42% of the box below the centre, before scaling.
const BODY_BELOW_CENTER = BUDDY_SIZE * 0.42 * COMPANION_SCALE;
const LIST_GAP = 30;
// Level with the seated orange's face, with its tail corner pointing back at it.
const PILL_ABOVE_BASE = 52;
// Taps near enough the seated orange count as tapping her, through the page that covers the stage.
const TAP_SLOP = 10;
// How long what she says stays up: a beat to read it, and a little longer for longer lines.
const speechMs = (text) => 1900 + text.length * 45;
const FALL = Easing.bezier(0.5, 0, 0.9, 0.5);
const RISE = Easing.bezier(0.2, 0.9, 0.3, 1.08);
const POP = Easing.bezier(0.2, 0.9, 0.3, 1.1);
// On an empty day the sky's tint sits behind the page, still, like the hill: it starts from nothing at the top
// of the page, so it meets the status bar without an edge, passes behind the header and the card, and keeps
// deepening down the screen to the same strength as the hill's sky, so the two match when she drops. It's halfway
// there this far down the page, about where the bough hangs: lower on today, under the day's card.
const GROVE_WASH_REACH = { today: 300, past: 170 };
// Gradient stops as native colours: the colour at each stop's strength.
const rgba = (hex, alpha) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;
// The hill and the seated orange sit this much lower than their band, so the scene rests nearer the screen's foot.
const SCENE_DROP = 81;
const DROP = { lift: 0, fall: 250, land: 870, meals: 900, cheer: 1250, settled: 1430 };

// A day's scene that goes away leaves its stage up this long, so the next day's (once its meals have loaded) takes
// over from it directly, with no blank frames between them.
const STAGE_LINGER_MS = 1500;

// Draws the stage behind the page. It holds what TodayScene last sent, so only it redraws when that changes.
export const TodayStageHost = forwardRef(function TodayStageHost(_, ref) {
  const [stage, setStage] = useState(null);
  const clearing = useRef(null);
  useEffect(() => () => clearTimeout(clearing.current), []);
  useImperativeHandle(ref, () => ({
    show: (next) => { clearTimeout(clearing.current); setStage(next); },
    release: () => { clearTimeout(clearing.current); clearing.current = setTimeout(() => setStage(null), STAGE_LINGER_MS); },
  }), []);
  return stage;
});

// `holdDrop` is for while something covers the page, like the voice sheet that saved the day's first meal: the
// scene stays as it was, empty, and the drop waits until it can be seen, instead of playing out behind the cover.
export default function TodayScene({ hasMeals: dayHasMeals, holdDrop = false, children, greeting, mood = "awake", isToday, bottomInset = 0, stageHost, style }) {
  // Whether the scene last settled with meals; null until it has been laid out once.
  const settled = useRef(null);
  const hasMeals = dayHasMeals && !(holdDrop && settled.current === false);
  // The hill, the seated orange and the meals mount as soon as the day has meals, held or not: parked out of sight,
  // they are ready when the drop starts, so it doesn't open on the frames it takes to build them.
  const mealsMounted = dayHasMeals;
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { height: screenHeight } = useWindowDimensions();
  const [laidOut, setLaidOut] = useState(false);
  const bandHeight = HILL_BAND + bottomInset;
  const hero = { left: width / 2 - BUDDY_SIZE / 2, top: HERO_TOP };
  // seatBase is where the bottom of the fruit itself sits, measured from the top of the band.
  const seatBase = hillTopAt(SEAT.left + BUDDY_SIZE * COMPANION_SCALE / 2, width) + SEAT.sink;
  const seatBox = { left: SEAT.left - BUDDY_SIZE * (1 - COMPANION_SCALE) / 2, bottom: bandHeight - seatBase + BODY_BELOW_CENTER - BUDDY_SIZE / 2 };
  const seatX = SEAT.left + BUDDY_SIZE * COMPANION_SCALE / 2;
  const ridgeTilt = Math.atan2(hillTopAt(seatX + 20, width) - hillTopAt(seatX - 20, width), 40) * 180 / Math.PI;
  const groveReach = isToday ? GROVE_WASH_REACH.today : GROVE_WASH_REACH.past;
  const groveFade = useMemo(() => skyFade(0.8, { shoulder: 0.5, reach: Math.min(1, groveReach / screenHeight), settle: 1 }), [groveReach, screenHeight]);

  const grove = useSharedValue(hasMeals ? 0 : 1);
  const band = useSharedValue(hasMeals ? 0 : 1);
  const list = useSharedValue(hasMeals ? 1 : 0);
  const onHill = useSharedValue(hasMeals ? 1 : 0);
  const speech = useSharedValue(0);
  const [said, setSaid] = useState(null);
  const quiet = useRef(null);
  const dropping = useRef(false);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(hasMeals ? COMPANION_SCALE : 1);
  const sy = useSharedValue(hasMeals ? COMPANION_SCALE : 1);
  const ground = useSharedValue(hasMeals ? 1 : 0);
  const heroRef = useAnimatedRef();
  const stageRef = useAnimatedRef();
  const stageView = useRef(null);
  const focused = useIsFocused();
  const clock = useSkyClock({ active: focused });
  const sceneId = useId();
  const [cheerSignal, setCheerSignal] = useState(0);
  const [landSignal, setLandSignal] = useState(0);
  const hillSeat = useMemo(() => ({ x: seatX, y: seatBase, width, tilt: ridgeTilt }), [seatX, seatBase, width, ridgeTilt]);
  const [bough, setBough] = useState(!hasMeals);
  const [inFront, setInFront] = useState(false);
  // The greeting goes when the first meal arrives, but it stays on the bough to fade out with it.
  const lastGreeting = useRef(greeting);
  if (greeting) lastGreeting.current = greeting;
  const shownGreeting = greeting ?? (bough ? lastGreeting.current : null);
  const timers = useRef([]);
  const seatAt = useSharedValue({ left: seatBox.left, bottom: seatBox.bottom });
  useEffect(() => { seatAt.value = { left: seatBox.left, bottom: seatBox.bottom }; }, [seatBox.left, seatBox.bottom, seatAt]);
  // The hand-off. The hanging orange does the lift itself, as part of the page, so she stays on the bough even if
  // the page is still moving (settling after a scroll, say). When she lets go, on the UI thread, she is
  // swapped for the seated orange exactly where she is, which falls from there to her seat.
  const lift = useSharedValue(0);
  const dropStart = useSharedValue(-1);
  const dropFrames = useFrameCallback(({ timestamp }) => {
    if (dropStart.value === -1) return;
    if (dropStart.value === 0) dropStart.value = timestamp;
    if (timestamp - dropStart.value < DROP.fall) return;
    dropStart.value = -1;
    const scale = COMPANION_SCALE;
    const from = measure(heroRef);
    const stage = measure(stageRef);
    onHill.value = 1;
    if (!from || !stage) {
      sx.value = scale;
      sy.value = scale;
      return;
    }
    // Measured without the lift, which is added back: 9 up, stretched 3% narrower and 4% taller.
    tx.value = from.pageX - (stage.pageX + seatAt.value.left);
    ty.value = from.pageY - 9 - (stage.pageY + stage.height - seatAt.value.bottom - BUDDY_SIZE);
    sx.value = 0.97;
    sy.value = 1.04;
    const beat = (to, duration) => withTiming(to, { duration, easing: Easing.out(Easing.quad) });
    const fall = { duration: 620, easing: FALL };
    // Across first, then down, so she falls in a curve rather than along a rail. Through the squash and the two
    // hops the bottom of the fruit stays on the hill.
    tx.value = withTiming(0, { duration: fall.duration, easing: Easing.out(Easing.quad) });
    ty.value = withSequence(withTiming(0, fall), beat(4, 100), beat(-10.4, 140),
      withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) }), beat(1.3, 70), beat(0, 90));
    sx.value = withSequence(withTiming(scale * 0.9, fall), beat(0.8, 100), beat(0.66, 140), beat(scale, 140), beat(0.73, 70), beat(scale, 90));
    sy.value = withSequence(withTiming(scale * 1.14, fall), beat(0.58, 100), beat(0.76, 140), beat(scale, 140), beat(0.66, 70), beat(scale, 90));
  }, false);

  // Before paint, so the frame where a day's last meal leaves already shows the bough, not a bare page.
  useLayoutEffect(() => {
    if (!laidOut) return undefined;
    const previous = settled.current;
    settled.current = hasMeals;
    if (previous === false && hasMeals && isToday && !reducedMotion) {
      // The drop: bough lifts, orange falls and squashes on the hill as it rises, meals spring in, the line pops.
      const t = (ms, fn) => timers.current.push(setTimeout(fn, ms));
      dropping.current = true;
      setInFront(true);
      grove.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) });
      band.value = withDelay(320, withTiming(0, { duration: 560, easing: RISE }));
      lift.value = withTiming(1, { duration: DROP.fall, easing: Easing.out(Easing.quad) });
      dropStart.value = 0;
      dropFrames.setActive(true);
      const beat = (to, duration) => withTiming(to, { duration, easing: Easing.out(Easing.quad) });
      // Her shadow gathers as she nears the hill, spreads on impact and tightens as she settles.
      ground.value = withDelay(DROP.fall + 300, withSequence(withTiming(1.25, { duration: 320, easing: Easing.in(Easing.quad) }), beat(0.7, 140), beat(1, 230)));
      list.value = withDelay(DROP.meals, withTiming(1, { duration: 420, easing: POP }));
      t(DROP.land, () => { setLandSignal((n) => n + 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {}); });
      t(DROP.cheer, () => setCheerSignal((n) => n + 1));
      t(DROP.lift + 420, () => setBough(false));
      t(DROP.settled, () => { dropping.current = false; setInFront(false); dropFrames.setActive(false); });
      return () => { timers.current.forEach(clearTimeout); timers.current = []; dropFrames.setActive(false); dropStart.value = -1; };
    }
    grove.value = hasMeals ? 0 : 1;
    band.value = hasMeals ? 0 : 1;
    list.value = hasMeals ? 1 : 0;
    onHill.value = hasMeals ? 1 : 0;
    lift.value = 0;
    dropping.current = false;
    ground.value = hasMeals ? 1 : 0;
    sx.value = hasMeals ? COMPANION_SCALE : 1;
    sy.value = hasMeals ? COMPANION_SCALE : 1;
    tx.value = 0;
    ty.value = 0;
    setInFront(false);
    setBough(!hasMeals);
    return undefined;
  }, [hasMeals, laidOut, isToday, reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  const groveStyle = useAnimatedStyle(() => ({ opacity: grove.value, transform: [{ translateY: (1 - grove.value) * -40 }] }));
  const groveWashStyle = useAnimatedStyle(() => ({ opacity: grove.value }));
  const groveDuskStyle = useAnimatedStyle(() => {
    const sky = skyAt(clock.value);
    return { opacity: DUSK_WASH_STRENGTH * sky.warm * (1 - sky.night) };
  });
  const groveNightStyle = useAnimatedStyle(() => ({ opacity: skyAt(clock.value).night }));
  const groveGradient = useMemo(() => ({
    locations: groveFade.map(([offset]) => offset),
    dusk: groveFade.map(([, strength]) => rgba(WASH.dusk, strength)),
    night: groveFade.map(([, strength]) => rgba(WASH.night, strength)),
  }), [groveFade]);
  // Parked low enough that its sky, sun and moon are out of sight too, not peeking from under the tab bar.
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ translateY: band.value * (bandHeight + SKY_POINTS) }] }));
  const listStyle = useAnimatedStyle(() => ({ opacity: list.value, transform: [{ translateY: (1 - list.value) * 14 }] }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, speech.value * 2), transform: [{ scale: 0.8 + speech.value * 0.2 }] }));
  // The hanging orange and the seated one swap in the same frame the drop starts, so there is only ever one.
  const hangingStyle = useAnimatedStyle(() => ({ opacity: 1 - onHill.value }));
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -9 * lift.value }, { scaleX: 1 - 0.03 * lift.value }, { scaleY: 1 + 0.04 * lift.value }] }));
  const seatedStyle = useAnimatedStyle(() => ({
    opacity: onHill.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scaleX: sx.value }, { scaleY: sy.value }],
  }));

  // She only speaks when tapped: each tap brings another face, and it clears itself after a moment.
  const speak = () => {
    if (dropping.current) return;
    const text = buddyFace(said);
    setSaid(text);
    clearTimeout(quiet.current);
    speech.value = reducedMotion ? 1 : withSequence(withTiming(1.06, { duration: 170, easing: POP }), withTiming(1, { duration: 90 }));
    quiet.current = setTimeout(() => { speech.value = withTiming(0, { duration: 180 }); }, speechMs(text));
  };
  // The page covers the stage, so a tap on the room left for the scene is checked against where she sits.
  const tapScene = ({ nativeEvent: { pageX, pageY } }) => {
    if (!hasMeals) return;
    stageView.current?.measureInWindow((x, y, _, stageHeight) => {
      const left = x + seatBox.left + BUDDY_SIZE * (1 - COMPANION_SCALE) / 2;
      const top = y + stageHeight - seatBox.bottom - BUDDY_SIZE + BUDDY_SIZE * (1 - COMPANION_SCALE) / 2;
      const size = BUDDY_SIZE * COMPANION_SCALE;
      if (pageX > left - TAP_SLOP && pageX < left + size + TAP_SLOP && pageY > top - TAP_SLOP && pageY < top + size + TAP_SLOP) {
        // As if she'd been tapped herself: a wiggle (with its haptic), then a line.
        if (!dropping.current) setCheerSignal((n) => n + 1);
        speak();
      }
    });
  };
  // A face belongs to the moment it was made in, so the first meal landing or a new day clears it.
  useEffect(() => { speech.value = 0; clearTimeout(quiet.current); }, [hasMeals, isToday, speech]);
  useEffect(() => () => clearTimeout(quiet.current), []);

  // Two layers of the screen, beside the page: the hill and its sky stay behind it; the orange's layer comes in
  // front of the page while she falls past the bough and the greeting, then goes back behind it once she lands.
  // The render where the first meal arrives is the one that mounts the seated orange; it is already mid-drop, so
  // it must not pop in on top of the hand-off.
  const dropStarting = settled.current === false && hasMeals && isToday && !reducedMotion;
  const attachStage = useCallback((view) => { stageRef(view); stageView.current = view; }, [stageRef]);
  // Rebuilt only when something on the stage changes, not on every render of the page (which can be every frame
  // while a meal row opens). The seated orange exists only once there are meals; on the bough there is just one.
  const stage = useMemo(() => <>
    {/* Native gradients: this tint covers the whole screen, too big to redraw as a drawing. Each day's scene gets
        its own: one reused from the day before loses its dusk and night strengths (an animated style only sets
        them on a view's first render) and shows full night until the clock next moves. */}
    {bough && <Animated.View key={sceneId} pointerEvents="none" style={[styles.groveWash, { height: screenHeight }, groveWashStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, groveDuskStyle]}>
        <LinearGradient colors={groveGradient.dusk} locations={groveGradient.locations} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, groveNightStyle]}>
        <LinearGradient colors={groveGradient.night} locations={groveGradient.locations} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>}
    <View ref={attachStage} collapsable={false} pointerEvents="none" style={[styles.stage, { height: bandHeight }]}>
      <Animated.View style={[StyleSheet.absoluteFill, bandStyle]}>
        {mealsMounted && <HillScene clock={clock} height={bandHeight} ground={ground} seat={hillSeat} />}
        {hasMeals && said && <Animated.View style={[styles.pill, { left: SEAT.left + BUDDY_SIZE * COMPANION_SCALE + 6, top: seatBase - PILL_ABOVE_BASE, maxWidth: width - SEAT.left - 72 }, pillStyle]}><Text style={styles.pillText}>{said}</Text></Animated.View>}
      </Animated.View>
    </View>
    <View pointerEvents="none" style={[styles.stage, { height: bandHeight, zIndex: inFront ? 2 : 0 }]}>
      {mealsMounted && <Animated.View style={[styles.orange, { left: seatBox.left, bottom: seatBox.bottom }, seatedStyle]}>
        <CitrusBuddy mood={mood} active={focused} arrive={!inFront && !dropStarting} cheerSignal={cheerSignal} landSignal={landSignal} />
      </Animated.View>}
    </View>
  </>, [bough, sceneId, screenHeight, groveWashStyle, groveDuskStyle, groveNightStyle, groveGradient, attachStage, bandHeight, bandStyle, hasMeals, mealsMounted, clock, focused, ground, hillSeat, said, seatBase, width, pillStyle, inFront, seatBox.left, seatBox.bottom, seatedStyle, mood, cheerSignal, landSignal, dropStarting]);
  // Sent whenever it changes; let go when this day's scene goes away, for the next day's scene to replace.
  useLayoutEffect(() => { stageHost?.current?.show(stage); }, [stage, stageHost]);
  useLayoutEffect(() => () => stageHost?.current?.release(), [stageHost]);

  // Laid out once is all the drop needs to know; the page resizing (every frame while a row opens) changes nothing.
  return <View style={[styles.scene, style]} onLayout={laidOut ? undefined : () => setLaidOut(true)}>
    {bough && <Animated.View pointerEvents="none" style={[styles.grove, groveStyle]}>
      <GroveScene clock={clock} />
      {shownGreeting && <View style={styles.greeting}>
        <Text style={home.emptyStateTitle}>{shownGreeting.title}</Text>
        <Text style={home.emptyStateText}>{shownGreeting.text}</Text>
      </View>}
    </Animated.View>}
    {mealsMounted && <Animated.View style={[styles.list, listStyle]}>{children}</Animated.View>}
    {/* Room at the end of the page to see the whole stage, which stays put behind it. */}
    <Pressable onPress={tapScene} accessible={false} style={[styles.room, { height: bandHeight - SCENE_DROP, marginBottom: -bottomInset }]} />
    {bough && <Animated.View ref={heroRef} collapsable={false} style={[styles.orange, hero, hangingStyle]}>
      <Animated.View style={liftStyle}>
        <CitrusBuddy mood={mood} active={focused} hang={!hasMeals} cheerSignal={0} landSignal={0} onTap={speak} />
      </Animated.View>
    </Animated.View>}
    {!hasMeals && said && <Animated.View pointerEvents="none" style={[styles.pill, { left: hero.left + BUDDY_SIZE + 2, top: HERO_TOP + 16, maxWidth: width - hero.left - BUDDY_SIZE - 18 }, pillStyle]}><Text style={styles.pillText}>{said}</Text></Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  scene: { flexGrow: 1, minHeight: 360 },
  groveWash: { position: "absolute", left: 0, right: 0, top: 0 },
  grove: { position: "absolute", left: 0, right: 0, top: 0, height: GROVE_HEIGHT },
  greeting: { alignItems: "center", paddingTop: HERO_TOP + BUDDY_SIZE + 10, paddingHorizontal: 24 },
  list: { paddingHorizontal: 16, paddingBottom: LIST_GAP },
  room: { marginTop: "auto" },
  stage: { position: "absolute", left: 0, right: 0, bottom: -SCENE_DROP },
  // Grows out of the corner that points at the orange.
  pill: { position: "absolute", transformOrigin: "0% 100%", paddingVertical: 6, paddingHorizontal: 11, borderRadius: 14, borderBottomLeftRadius: 4, backgroundColor: "#FFFFFF",
    shadowColor: "#4A3428", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 3 },
  pillText: { fontSize: 13, fontWeight: "600", color: "#4A3428" },
  orange: { position: "absolute" },
});
