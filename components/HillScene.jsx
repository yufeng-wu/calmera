import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
// The band is drawn 400 units wide; the visible 190 points above the tab bar map to 200 units.
export const HILL_BAND = 190;
const UNITS_PER_POINT = 200 / HILL_BAND;
// Sky drawn above the band so the sun's glow is never sliced flat at the band's top edge.
const SKY = 44;
const SKY_POINTS = SKY / UNITS_PER_POINT;
const TONES = {
  day: { front: ["#FFD7A8", "#FFEBD3"], back: "#FFEFDD", sun: "#FFD27A", glow: "#FFE2A8" },
  evening: { front: ["#FFC998", "#FFE3C4"], back: "#FFE6CC", sun: "#FFB657", glow: "#FFC06B" },
  night: { front: ["#D9CFE6", "#EEE8F2"], back: "#E6DFF0", sun: null, glow: null },
};

// Where the sun sits for a share of the calorie goal: it rises from behind the hill to the orange's right,
// never behind her head, where it would read as a second fruit. The arc stays left of the floating Add
// button, whose frosted glass would smear the glow, and ends low enough to set half behind the hill.
// Mornings climb fast, so by the first meal the sun is already up and clear of her head.
export const sunAt = (progress) => {
  "worklet";
  const share = Math.min(1, Math.max(0, progress));
  const a = Math.PI * (1 + 0.04 + 0.92 * share);
  const height = -Math.sin(a);
  return { cx: 205 + 54 * Math.cos(a), cy: 96 - 96 * (share < 0.5 ? Math.pow(height, 0.25) : height) };
};

// The front hill's ridge, as drawn below: one cubic from the left edge to the crest's far side.
const RIDGE = [[0, 118], [50, 58], [150, 52], [215, 76]];
const bezier = (p0, p1, p2, p3, t) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;

// Height of the front hill's surface, in points below the band's top, at `x` points from the left
// of a band `width` points wide. Used to seat the orange on the grass whatever the phone's width.
export const hillTopAt = (x, width) => {
  const target = Math.min(RIDGE[3][0], Math.max(0, x * 400 / width));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (bezier(RIDGE[0][0], RIDGE[1][0], RIDGE[2][0], RIDGE[3][0], mid) < target) lo = mid; else hi = mid;
  }
  return bezier(RIDGE[0][1], RIDGE[1][1], RIDGE[2][1], RIDGE[3][1], (lo + hi) / 2) / UNITS_PER_POINT;
};

// The hill under the meal list. `progress` is a shared value of calories over goal, so the sun
// crosses the sky as the day fills. Stretched to the band's width and height, which reaches under the tab bar.
export default function HillScene({ progress, tone = "day", height, seat, ground }) {
  const colors = TONES[tone] || TONES.day;
  const sun = useAnimatedProps(() => sunAt(progress.value));
  const glow = useAnimatedProps(() => sunAt(progress.value));
  const shadow = useAnimatedProps(() => ({ rx: 15 + ground.value * 9, fillOpacity: Math.min(1, ground.value) }));
  const units = Math.round(height * UNITS_PER_POINT);
  const shadowX = seat ? seat.x * 400 / seat.width : 0;
  const shadowY = seat ? seat.y * UNITS_PER_POINT - 1 : 0;
  const front = `M0 118 C50 58 150 52 215 76 C280 100 340 130 400 150 L400 ${units + 10} L0 ${units + 10} Z`;
  return <>
    {/* Ground below the drawing, so bouncing past the end of the page never shows where the hill stops. */}
    <View style={[styles.below, { top: height - 1, backgroundColor: colors.front[1] }]} />
    <Svg pointerEvents="none" width="100%" height={height + SKY_POINTS} viewBox={`0 ${-SKY} 400 ${units + SKY}`} preserveAspectRatio="none" style={styles.sky}>
    <Defs><LinearGradient id={`hill-${tone}`} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor={colors.front[0]} /><Stop offset="1" stopColor={colors.front[1]} />
    </LinearGradient>
      <RadialGradient id="seatShadow"><Stop offset="0" stopColor="#A85F1F" stopOpacity={0.5} /><Stop offset="0.5" stopColor="#A85F1F" stopOpacity={0.24} /><Stop offset="1" stopColor="#A85F1F" stopOpacity={0} /></RadialGradient>
    </Defs>
    {tone === "night"
      ? <>
        <Circle cx={318} cy={52} r={17} fill="#F3EEE4" /><Circle cx={310} cy={46} r={13} fill="#F4F0F8" />
        <Circle cx={60} cy={40} r={2} fill="#D9CFE6" /><Circle cx={130} cy={22} r={1.6} fill="#D9CFE6" /><Circle cx={250} cy={34} r={1.8} fill="#D9CFE6" />
      </>
      : <>
        <AnimatedCircle animatedProps={glow} r={30} fill={colors.glow} fillOpacity={0.28} />
        <AnimatedCircle animatedProps={sun} r={18} fill={colors.sun} />
      </>}
    <Path d={`M0 150 C90 100 180 104 250 100 C320 96 370 84 400 72 L400 ${units + 10} L0 ${units + 10} Z`} fill={colors.back} />
    <Path d={front} fill={`url(#hill-${tone})`} />
    {/* Tilted along the ridge, so the orange's shadow lies on the hill and never on the sky. */}
    {seat && <AnimatedEllipse animatedProps={shadow} cx={shadowX} cy={shadowY} ry={5} transform={`rotate(${seat.tilt} ${shadowX} ${shadowY})`} fill="url(#seatShadow)" />}
  </Svg>
  </>;
}

const styles = StyleSheet.create({ sky: { position: "absolute", left: 0, right: 0, top: -SKY_POINTS }, below: { position: "absolute", left: 0, right: 0, height: 1200 } });
