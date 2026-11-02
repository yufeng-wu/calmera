import { StyleSheet } from "react-native";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// The band is drawn 400 units wide; the visible 190 points above the tab bar map to 200 units.
export const HILL_BAND = 190;
const UNITS_PER_POINT = 200 / HILL_BAND;
// Sky drawn above the band so the sun's glow is never sliced flat at the band's top edge.
const SKY = 32;
const SKY_POINTS = SKY / UNITS_PER_POINT;
const TONES = {
  day: { front: ["#FFD7A8", "#FFEBD3"], back: "#FFEFDD", sun: "#FFD27A", glow: "#FFE2A8" },
  evening: { front: ["#FFC998", "#FFE3C4"], back: "#FFE6CC", sun: "#FFB657", glow: "#FFC06B" },
  night: { front: ["#D9CFE6", "#EEE8F2"], back: "#E6DFF0", sun: null, glow: null },
};

// Where the sun sits for a share of the calorie goal: sunrise behind the orange on the left, noon at half,
// sunset on the hill's crest. The arc stays left of the floating Add button, whose frosted glass
// would otherwise smear the glow, and ends low enough that the sun sets half behind the hill.
export const sunAt = (progress) => {
  "worklet";
  const a = Math.PI * (1 + 0.04 + 0.92 * Math.min(1, Math.max(0, progress)));
  return { cx: 150 + 106 * Math.cos(a), cy: 100 + 90 * Math.sin(a) };
};

// The hill under the meal list. `progress` is a shared value of calories over goal, so the sun
// crosses the sky as the day fills. Stretched to the band's width and height, which reaches under the tab bar.
export default function HillScene({ progress, tone = "day", height }) {
  const colors = TONES[tone] || TONES.day;
  const sun = useAnimatedProps(() => sunAt(progress.value));
  const glow = useAnimatedProps(() => sunAt(progress.value));
  const units = Math.round(height * UNITS_PER_POINT);
  return <Svg pointerEvents="none" width="100%" height={height + SKY_POINTS} viewBox={`0 ${-SKY} 400 ${units + SKY}`} preserveAspectRatio="none" style={styles.sky}>
    <Defs><LinearGradient id={`hill-${tone}`} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor={colors.front[0]} /><Stop offset="1" stopColor={colors.front[1]} />
    </LinearGradient></Defs>
    {tone === "night"
      ? <>
        <Circle cx={318} cy={52} r={17} fill="#F3EEE4" /><Circle cx={310} cy={46} r={13} fill="#F4F0F8" />
        <Circle cx={60} cy={40} r={2} fill="#D9CFE6" /><Circle cx={130} cy={22} r={1.6} fill="#D9CFE6" /><Circle cx={250} cy={34} r={1.8} fill="#D9CFE6" />
      </>
      : <>
        <AnimatedCircle animatedProps={glow} r={40} fill={colors.glow} fillOpacity={0.28} />
        <AnimatedCircle animatedProps={sun} r={18} fill={colors.sun} />
      </>}
    <Path d={`M0 150 C90 100 180 104 250 100 C320 96 370 84 400 72 L400 ${units + 10} L0 ${units + 10} Z`} fill={colors.back} />
    <Path d={`M0 118 C50 58 150 52 215 76 C280 100 340 130 400 150 L400 ${units + 10} L0 ${units + 10} Z`} fill={`url(#hill-${tone})`} />
  </Svg>;
}

const styles = StyleSheet.create({ sky: { position: "absolute", left: 0, right: 0, top: -SKY_POINTS } });
