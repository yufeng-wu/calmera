import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { formatClock, formatNearClock } from "@/lib/insights/stats.mjs";

const MEAL_LABELS = { Breakfast: "Breakfast", Lunch: "Lunch", Dinner: "Dinner", Snack: "Snacks" };
const SIX_HOURS = 6 * 60;
const STRIP = 12;
const DETAIL_STRIP = 28;
const DOT = 6;
const MARK_OVERHANG = 3;
const TIME_BIN = 5;
const TICK_WIDTH = 64;
// Fainter dots for longer periods, so a crowded time reads darker instead of as one blob.
const DOT_OPACITY = { 7: 0.7, 30: 0.4, 365: 0.12 };
// Axis labels sit at fixed positions, so they can only grow so far.
const AXIS_TEXT = 1.3;

const count = (value, word) => `${value} ${word}${value === 1 ? "" : "s"}`;

// A clock label for the axis: "6 AM" in 12-hour regions, "06:00" in 24-hour ones.
const hourLabel = (minutes) => { const text = formatClock(minutes); return /[AP]M/i.test(text) ? text.replace(":00", "") : text; };

// Where a meal's average marks go: one for a meal, one per habit for snacks.
export const averagesOf = (meal) => meal.clusters ? meal.clusters.map(({ average }) => average) : [meal.average];

// The time beside a meal's name: its average, or each snack habit's.
export const timeLabel = (meal) => meal.clusters
  ? meal.clusters.length ? meal.clusters.map(({ average }) => formatNearClock(average)).join(" · ") : "Varies"
  : formatNearClock(meal.average);

export function describeMeal(meal) {
  if (!meal.clusters) return `${MEAL_LABELS[meal.meal]}, average about ${formatNearClock(meal.average)}, ${count(meal.days, "day")}.`;
  const snacks = `${count(meal.events.length, "snack")} on ${count(meal.days, "day")}`;
  return meal.clusters.length ? `Snacks, usually about ${meal.clusters.map(({ average }) => formatNearClock(average)).join(" and ")}, ${snacks}.`
    : `Snacks at varied times, ${snacks}.`;
}

// A steady offset for a day's dot inside a tall strip, so dots at the same time stay countable.
const spread = (key) => {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 100003;
  const noise = Math.sin(hash) * 43758.5453;
  return noise - Math.floor(noise) - 0.5;
};

// Each meal on one clock. Every dot is one meal or snack, and the dark line is the average.
// The overview strip merges dots in the same five minutes into one darker dot; the detail
// strip is taller and spreads a week's or month's dots up and down so they can be counted.
export default function DayTimeline({ rhythm, span, detail }) {
  const [width, setWidth] = useState(0);
  const { meals, start, end } = rhythm;
  const strip = detail ? DETAIL_STRIP : STRIP;
  const height = strip + 2 * MARK_OVERHANG;
  const middle = MARK_OVERHANG + strip / 2;
  // Inset so a dot or line on the first or last hour isn't cut in half.
  const inset = DOT / 2 + 1;
  const x = (minutes) => inset + (minutes - start) / (end - start) * (width - 2 * inset);
  const ticks = [];
  for (let tick = Math.ceil(start / SIX_HOURS) * SIX_HOURS; tick <= end; tick += SIX_HOURS) ticks.push(tick);
  const opacity = DOT_OPACITY[span] ?? DOT_OPACITY[30];
  const dots = (meal) => {
    if (detail && span <= 30) {
      return meal.events.map(({ key, time }, index) => <Circle key={`${key}-${index}`} cx={x(time)} cy={middle + spread(key) * (strip - DOT)}
        r={DOT / 2} fill={COLORS.primary} fillOpacity={0.7} />);
    }
    const bins = new Map();
    for (const { time } of meal.events) { const bin = Math.round(time / TIME_BIN) * TIME_BIN; bins.set(bin, (bins.get(bin) ?? 0) + 1); }
    return [...bins].map(([time, many]) => <Circle key={time} cx={x(time)} cy={middle} r={DOT / 2} fill={COLORS.primary} fillOpacity={1 - (1 - opacity) ** many} />);
  };
  const tickPlace = (tick, index) => {
    if (index === 0 && x(tick) < TICK_WIDTH / 2) return [styles.tickStart, 0];
    if (index === ticks.length - 1 && width - x(tick) < TICK_WIDTH / 2) return [styles.tickEnd, width - TICK_WIDTH];
    return [styles.tickMiddle, x(tick) - TICK_WIDTH / 2];
  };
  return <View style={styles.wrap} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    {meals.map((meal) => <View key={meal.meal} accessible accessibilityLabel={describeMeal(meal)} style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.name}>{MEAL_LABELS[meal.meal]}</Text>
        <Text style={styles.time}>{timeLabel(meal)}</Text>
      </View>
      <View style={{ height }}>
        {width > 0 && <Svg width={width} height={height}>
          <Rect x={0} y={MARK_OVERHANG} width={width} height={strip} rx={Math.min(strip / 2, 8)} fill={COLORS.track} />
          {ticks.filter((tick) => tick > start && tick < end).map((tick) => <Line key={tick} x1={x(tick)} x2={x(tick)} y1={MARK_OVERHANG} y2={MARK_OVERHANG + strip}
            stroke={COLORS.textLight} strokeOpacity={0.25} strokeWidth={1} />)}
          {dots(meal)}
          {averagesOf(meal).map((average) => <Rect key={average} x={x(average) - 1} y={0} width={2} height={height} rx={1}
            fill={COLORS.text} stroke={COLORS.white} strokeWidth={1} />)}
        </Svg>}
      </View>
    </View>)}
    {width > 0 && <View style={styles.axis} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {ticks.map((tick, index) => {
        const [align, left] = tickPlace(tick, index);
        return <Text key={tick} numberOfLines={1} maxFontSizeMultiplier={AXIS_TEXT} style={[styles.tick, align, { left }]}>{hourLabel(tick)}</Text>;
      })}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { gap: 4 },
  rowHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 8 },
  name: { ...TYPOGRAPHY.body, color: COLORS.text },
  time: { ...TYPOGRAPHY.bodyMedium, flexShrink: 1, color: COLORS.text, textAlign: "right", fontVariant: ["tabular-nums"] },
  axis: { height: 18, marginTop: -4 },
  tick: { ...TYPOGRAPHY.caption, position: "absolute", width: TICK_WIDTH, color: COLORS.textLight },
  tickStart: { textAlign: "left" },
  tickMiddle: { textAlign: "center" },
  tickEnd: { textAlign: "right" },
});
