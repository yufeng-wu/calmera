import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import * as Haptics from "expo-haptics";

export const BUDDY_SIZE = 80;
const SIZE = BUDDY_SIZE;
// Points per unit of the 100-unit canvas, so the eyes line up with what's drawn on it.
const UNIT = SIZE / 100;
const PEEL = "#FFA033";
const PEEL_SHADE = "#F5861C";
const CHEEK = "#FFC4A3";
const LEAF = "#7FB069";
const STEM = "#7A5230";
const FACE = "#4A3428";
const FIRST_GLANCE_MS = 900;
const ARRIVE = { mass: 0.7, stiffness: 180, damping: 11 };
const PORES = [[27, 44], [74, 42], [66, 31], [81, 60], [20, 60], [32, 81], [68, 83], [50, 86]];
// The "Wide" face: eyes far apart with a longer smile.
const EYE = { w: 9, h: 12.5, left: 30, right: 70, y: 53 };
const SMILE = "M41 63 Q50 71 59 63";
const SMILE_ASLEEP = "M47.5 64 Q50 66 52.5 64";
const EYES_CLOSED = "M24.9 51.4 Q30 57 35.1 51.4 M64.9 51.4 Q70 57 75.1 51.4";
const EYES_HAPPY = "M24.9 55.4 Q30 47 35.1 55.4 M64.9 55.4 Q70 47 75.1 55.4";

const between = (low, high) => low + Math.random() * (high - low);
const timing = (toValue, duration) => withTiming(toValue, { duration, easing: Easing.inOut(Easing.quad) });

function Canvas({ children }) {
  return <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100" fill="none" style={StyleSheet.absoluteFill}>{children}</Svg>;
}

// Today's character. Awake it blinks and glances down at the Add button; happy it keeps smiling eyes
// after dinner; asleep on past days with nothing logged. `hang` sways it from its stem, as on the bough.
// Decorative, so VoiceOver skips it. A changed `cheerSignal` makes it cheer, as does a tap.
// `arrive` pops it in when it mounts; off when it takes over from another orange mid-motion. While `active` is
// false (its screen isn't showing) it holds still, so nothing runs where no one can see it.
export default function CitrusBuddy({ mood = "awake", asleep = false, hang = false, arrive = true, active = true, cheerSignal = 0, landSignal = 0, onTap, style }) {
  const state = asleep ? "asleep" : mood;
  const reducedMotion = useReducedMotion();
  const lid = useSharedValue(0);
  const look = useSharedValue(0);
  const tilt = useSharedValue(0);
  const leaf = useSharedValue(0);
  const joy = useSharedValue(state === "happy" ? 1 : 0);
  const sway = useSharedValue(0);
  const scale = useSharedValue(reducedMotion || state === "asleep" || !arrive ? 1 : 0.86);

  useEffect(() => {
    joy.value = reducedMotion ? (state === "happy" ? 1 : 0) : timing(state === "happy" ? 1 : 0, 220);
  }, [state, reducedMotion, joy]);

  // Hanging, it swings once when it comes into view and then rests: a loop that never ends would redraw the page
  // every frame for as long as Today is open.
  useEffect(() => {
    if (reducedMotion || !hang || !active) { sway.value = 0; return undefined; }
    sway.value = withSequence(timing(2.5, 900), timing(-2, 1300), timing(1, 1100), timing(0, 900));
    return () => { sway.value = 0; };
  }, [hang, active, reducedMotion, sway]);

  useEffect(() => {
    if (reducedMotion) return undefined;
    if (!active || state === "asleep") { scale.value = 1; return undefined; }
    scale.value = arrive ? withSpring(1, ARRIVE) : 1;
    if (state === "happy") return undefined;
    const blink = (times = 1) => {
      const once = () => withSequence(timing(1, 70), timing(0, 110));
      lid.value = times > 1 ? withSequence(once(), once()) : once();
    };
    let blinkTimer, glanceTimer;
    const nextBlink = () => {
      blinkTimer = setTimeout(() => { blink(Math.random() < 0.2 ? 2 : 1); nextBlink(); }, between(2200, 4800));
    };
    const nextGlance = (delay) => {
      glanceTimer = setTimeout(() => {
        // A blink as the face turns is what makes the look read as alive.
        blink();
        look.value = withSequence(timing(1, 260), withDelay(1100, timing(0, 320)));
        leaf.value = withSequence(timing(10, 220), timing(-6, 260), timing(0, 260));
        nextGlance(between(6000, 9000));
      }, delay);
    };
    nextBlink();
    nextGlance(FIRST_GLANCE_MS);
    return () => { clearTimeout(blinkTimer); clearTimeout(glanceTimer); };
  }, [state, active, reducedMotion, lid, look, leaf, scale]); // eslint-disable-line react-hooks/exhaustive-deps -- `arrive` only matters on mount

  const cheer = () => {
    Haptics.selectionAsync().catch(() => {});
    if (reducedMotion) return;
    tilt.value = withSequence(timing(-9, 80), timing(8, 120), timing(-5, 110), timing(0, 130));
    leaf.value = withSequence(timing(14, 110), timing(-10, 150), timing(0, 170));
    if (state === "awake") joy.value = withSequence(timing(1, 90), withDelay(700, timing(0, 180)));
  };
  useEffect(() => { if (cheerSignal) cheer(); }, [cheerSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  // On landing the leaf is still falling, so it whips down and settles after the fruit has stopped.
  useEffect(() => {
    if (landSignal && !reducedMotion) leaf.value = withSequence(timing(24, 90), timing(-12, 170), timing(5, 150), timing(0, 150));
  }, [landSignal, reducedMotion, leaf]);

  const hangStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value}deg` }] }));
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${look.value * 4 + tilt.value}deg` }, { scale: scale.value }] }));
  // The leaf trails the sway, a little further than the fruit, like something light on a heavy thing.
  const leafStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${leaf.value - sway.value * 1.8}deg` }] }));
  // The whole face slides toward the Add button, at the bottom right of the screen.
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateX: look.value * 6 * UNIT }, { translateY: look.value * 4 * UNIT }] }));
  // Cheeks travel half as far, so they stay on the fruit and the turn reads as round.
  const cheeksStyle = useAnimatedStyle(() => ({ transform: [{ translateX: look.value * 3 * UNIT }, { translateY: look.value * 2 * UNIT }] }));
  const eyesStyle = useAnimatedStyle(() => ({ opacity: 1 - joy.value, transform: [{ scaleY: 1 - lid.value * 0.9 }] }));
  const happyStyle = useAnimatedStyle(() => ({ opacity: joy.value }));

  return <Pressable onPress={() => { cheer(); onTap?.(); }} accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.fruit, style]}>
    <Animated.View style={[StyleSheet.absoluteFill, styles.hang, hangStyle]}>
    <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.leaf, leafStyle]}>
        <Canvas><Path d="M52 17 C55 7 66 3 76 6 C74 16 63 22 52 17 Z" fill={LEAF} /></Canvas>
      </Animated.View>
      <Canvas>
        <Path d="M50 21 C50 18 51 15 52 13" stroke={STEM} strokeWidth={4} strokeLinecap="round" />
        <Path d="M50 19 C71 19 88 35 88 56 C88 77 71 92 50 92 C29 92 12 77 12 56 C12 35 29 19 50 19 Z" fill={PEEL} />
        <Path d="M16 68 C22 83 35 92 50 92 C65 92 78 83 84 68 C76 79 64 85 50 85 C36 85 24 79 16 68 Z" fill={PEEL_SHADE} />
        {PORES.map(([cx, cy]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.9} fill={PEEL_SHADE} />)}
        <Path d="M23 43 C25 35 31 29 39 27" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" />
        <Ellipse cx={50} cy={20.5} rx={5} ry={2} fill={LEAF} />
      </Canvas>
      <Animated.View style={[StyleSheet.absoluteFill, cheeksStyle]}>
        <Canvas>
          <Ellipse cx={23} cy={66} rx={5.5} ry={3.8} fill={CHEEK} />
          <Ellipse cx={77} cy={66} rx={5.5} ry={3.8} fill={CHEEK} />
        </Canvas>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, faceStyle]}>
        <Canvas>
          <Path d={state === "asleep" ? SMILE_ASLEEP : SMILE} stroke={FACE} strokeWidth={3} strokeLinecap="round" />
        </Canvas>
        {state === "asleep"
          ? <Canvas><Path d={EYES_CLOSED} stroke={FACE} strokeWidth={3} strokeLinecap="round" /></Canvas>
          : <Animated.View style={[StyleSheet.absoluteFill, eyesStyle]}>
            <View style={[styles.eye, { left: (EYE.left - EYE.w / 2) * UNIT }]}><View style={styles.shine} /></View>
            <View style={[styles.eye, { left: (EYE.right - EYE.w / 2) * UNIT }]}><View style={styles.shine} /></View>
          </Animated.View>}
        <Animated.View style={[StyleSheet.absoluteFill, happyStyle]}>
          <Canvas><Path d={EYES_HAPPY} stroke={FACE} strokeWidth={3.5} strokeLinecap="round" /></Canvas>
        </Animated.View>
      </Animated.View>
    </Animated.View>
    </Animated.View>
  </Pressable>;
}

const styles = StyleSheet.create({
  fruit: { width: SIZE, height: SIZE },
  // Swings from the stem, like fruit on a branch.
  hang: { transformOrigin: "50% 13%" },
  // Turns on its base at the stem.
  leaf: { transformOrigin: "52% 17%" },
  eye: { position: "absolute", top: (EYE.y - EYE.h / 2) * UNIT, width: EYE.w * UNIT, height: EYE.h * UNIT, borderRadius: EYE.w / 2 * UNIT, backgroundColor: FACE },
  shine: { position: "absolute", top: 2.2 * UNIT, right: 1.8 * UNIT, width: 3.2 * UNIT, height: 3.2 * UNIT, borderRadius: 2 * UNIT, backgroundColor: "#FFFFFF" },
});
