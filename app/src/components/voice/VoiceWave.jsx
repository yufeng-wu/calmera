import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

const BARS = 29;
const MIDDLE = (BARS - 1) / 2;
const BAR_WIDTH = 4;
const GAP = 4;
const REST = 4;
export const WAVE_HEIGHT = 72;
export const WAVE_WIDTH = BARS * BAR_WIDTH + (BARS - 1) * GAP;
// Clementine at the ends warming to the mark's tangerine in the middle.
const EDGE = [255, 160, 51];
const CENTER = [232, 117, 36];
const mix = t => `rgb(${EDGE.map((value, index) => Math.round(value + (CENTER[index] - value) * t)).join(",")})`;
const BAR_COLORS = Array.from({ length: BARS }, (_, index) => mix(1 - Math.abs(index - MIDDLE) / MIDDLE));
// Taller in the middle, so the wave reads as one voice rather than a level meter.
const ENVELOPE = Array.from({ length: BARS }, (_, index) => 0.28 + 0.72 * (1 - Math.abs(index - MIDDLE) / MIDDLE) ** 1.4);

// Bars that follow the voice: `level` (0–1, a shared value fed by the recognizer's volume) sets
// how tall they reach, and a slow drift keeps neighbours from moving in lockstep. Paused, they
// settle into a row of dots.
export default memo(function VoiceWave({ level, active }) {
  const reducedMotion = useReducedMotion();
  const time = useSharedValue(0);
  const live = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    live.value = withTiming(active ? 1 : 0, { duration: active ? 260 : 420, easing: Easing.out(Easing.cubic) });
  }, [active, live]);
  const frames = useFrameCallback(frame => {
    time.value += frame.timeSincePreviousFrame ?? 16;
  }, false);
  useEffect(() => {
    frames.setActive(active && !reducedMotion);
  }, [active, reducedMotion, frames]);
  return <View style={styles.row} accessible={false} importantForAccessibility="no-hide-descendants">
    {ENVELOPE.map((envelope, index) => <Bar key={index} index={index} envelope={envelope} color={BAR_COLORS[index]}
      level={level} time={time} live={live} />)}
  </View>;
});

function Bar({ index, envelope, color, level, time, live }) {
  const style = useAnimatedStyle(() => {
    const t = time.value;
    // Two slow waves at different speeds, so the motion never visibly repeats.
    const drift = 0.62 + 0.38 * Math.sin(t * 0.0062 + index * 0.72) * Math.sin(t * 0.0021 + index * 1.31);
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.0032 - index * 0.38);
    const voiced = level.value * envelope * drift * (WAVE_HEIGHT - REST);
    const idle = 5 * breathe * envelope;
    return { height: REST + live.value * (voiced + idle) };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: { height: WAVE_HEIGHT, width: WAVE_WIDTH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "center" },
  bar: { width: BAR_WIDTH, borderRadius: BAR_WIDTH / 2, minHeight: REST },
});
