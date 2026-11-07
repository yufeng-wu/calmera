import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { SURFACES } from "@/constants/surfaces";
import { formatClock, formatNearClock, formatNumber } from "@/lib/insights/stats.mjs";

const MEAL_LABELS = { Breakfast: "Breakfast", Lunch: "Lunch", Dinner: "Dinner", Snack: "Snacks" };
const TICK_HOURS = 3 * 60;
const MARK_WIDTH = 64;
const STRIP = 12;
const DETAIL_STRIP = 28;
const DOT = 6;
const MARK_OVERHANG = 3;
const TIME_BIN = 5;
const TICK_WIDTH = 40;
// Dots fade with how crowded a row's busiest five minutes are, so a crowded time reads
// darker instead of as one blob, while a lone dot in a sparse row stays easy to see.
const DOT_OPACITY = { min: 0.35, max: 0.7 };
const dotOpacity = (busiest) => Math.min(DOT_OPACITY.max, Math.max(DOT_OPACITY.min, 1 - 0.05 ** (1 / Math.max(1, busiest))));
// Axis labels sit at fixed positions, so they can only grow so far.
const AXIS_TEXT = 1.3;

const count = (value, word) => `${formatNumber(value)} ${word}${value === 1 ? "" : "s"}`;

// Clock text on the chart: "8:15am" and "6am" in 12-hour regions, "08:15" and "06" in 24-hour ones.
const compact = (text) => text.replace(/\s*([AP])M/i, (_, half) => `${half.toLowerCase()}m`);
const hourLabel = (minutes) => compact(formatClock(minutes).replace(":00", ""));
const markLabel = (minutes) => compact(formatNearClock(minutes));

// Where a meal's average mark goes. Snacks have none: each is a dot where it happened.
export const averagesOf = (meal) => meal.average == null ? [] : [meal.average];

// Beside a meal's name on the overview: its average, or for snacks how many there were.
// The detail page writes the average on the plot and says the count under it instead.
export const timeLabel = (meal) => meal.average == null ? count(meal.events.length, "snack") : markLabel(meal.average);

export function describeMeal(meal) {
  if (meal.average == null) return `Snacks, ${count(meal.events.length, "snack")} on ${count(meal.days, "day")}.`;
  return `${MEAL_LABELS[meal.meal]}, average about ${formatNearClock(meal.average)}, ${count(meal.days, "day")}.`;
}

// A steady offset for a day's dot inside a tall strip, so dots at the same time stay countable.
const spread = (key) => {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 100003;
  const noise = Math.sin(hash) * 43758.5453;
  return noise - Math.floor(noise) - 0.5;
};

// Each meal on one clock. Every dot is one meal or snack, and the dark line is a meal's average.
// The overview strip merges dots in the same five minutes into one darker dot; the detail
// strip is taller and spreads a week's or month's dots up and down so they can be counted.
// In detail, each meal is a section: its name, its plot with its own axis, then whatever
// `notes` says about it, so the words sit under the picture they describe.
export default function DayTimeline({ rhythm, span, detail, notes }) {
  const [width, setWidth] = useState(0);
  const { meals, start, end } = rhythm;
  const strip = detail ? DETAIL_STRIP : STRIP;
  const height = strip + 2 * MARK_OVERHANG;
  const middle = MARK_OVERHANG + strip / 2;
  // Inset so a dot or line on the first or last hour isn't cut in half.
  const inset = DOT / 2 + 1;
  const x = (minutes) => inset + (minutes - start) / (end - start) * (width - 2 * inset);
  const ticks = [];
  for (let tick = Math.ceil(start / TICK_HOURS) * TICK_HOURS; tick <= end; tick += TICK_HOURS) ticks.push(tick);
  const dots = (meal) => {
    if (detail && span <= 30) {
      return meal.events.map(({ key, time }, index) => <Circle key={`${key}-${index}`} cx={x(time)} cy={middle + spread(key) * (strip - DOT)}
        r={DOT / 2} fill={COLORS.primary} fillOpacity={0.7} />);
    }
    const bins = new Map();
    for (const { time } of meal.events) { const bin = Math.round(time / TIME_BIN) * TIME_BIN; bins.set(bin, (bins.get(bin) ?? 0) + 1); }
    const opacity = dotOpacity(Math.max(...bins.values()));
    return [...bins].map(([time, many]) => <Circle key={time} cx={x(time)} cy={middle} r={DOT / 2} fill={COLORS.primary} fillOpacity={1 - (1 - opacity) ** many} />);
  };
  const tickPlace = (tick, index) => {
    if (index === 0 && x(tick) < TICK_WIDTH / 2) return [styles.tickStart, 0];
    if (index === ticks.length - 1 && width - x(tick) < TICK_WIDTH / 2) return [styles.tickEnd, width - TICK_WIDTH];
    return [styles.tickMiddle, x(tick) - TICK_WIDTH / 2];
  };
  const axis = () => <View style={styles.axis} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
    {ticks.map((tick, index) => {
      const [align, left] = tickPlace(tick, index);
      return <Text key={tick} numberOfLines={1} maxFontSizeMultiplier={AXIS_TEXT} style={[styles.tick, align, { left }]}>{hourLabel(tick)}</Text>;
    })}
  </View>;
  return <View style={[styles.wrap, detail && styles.wrapDetail]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    {meals.map((meal, index) => <View key={meal.meal} style={detail && index > 0 ? styles.sectionDivider : null}>
      <View accessible accessibilityLabel={describeMeal(meal)} style={styles.row}>
        <View style={styles.rowHead}>
          <Text style={[styles.name, detail && styles.nameDetail]}>{MEAL_LABELS[meal.meal]}</Text>
          {!detail && <Text style={styles.time}>{meal.average != null && <Text style={styles.timeWord}>Around </Text>}{timeLabel(meal)}</Text>}
        </View>
        {detail && width > 0 && meal.average != null && <View style={styles.markRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {averagesOf(meal).map((average) => <Text key={average} numberOfLines={1} maxFontSizeMultiplier={AXIS_TEXT}
            style={[styles.mark, { left: Math.min(Math.max(0, x(average) - MARK_WIDTH / 2), width - MARK_WIDTH) }]}>{markLabel(average)}</Text>)}
        </View>}
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
        {detail && width > 0 && axis()}
      </View>
      {detail && notes && <View style={styles.notes}>{notes(meal)}</View>}
    </View>)}
    {!detail && width > 0 && axis()}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  wrapDetail: { gap: 16 },
  sectionDivider: { paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.separator },
  row: { gap: 4 },
  nameDetail: { ...TYPOGRAPHY.sectionTitle },
  notes: { gap: 2, paddingTop: 4 },
  markRow: { height: 16, marginTop: 2 },
  mark: { ...TYPOGRAPHY.caption, position: "absolute", width: MARK_WIDTH, fontSize: 11, lineHeight: 16, color: COLORS.text, textAlign: "center", fontVariant: ["tabular-nums"] },
  rowHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 8 },
  name: { ...TYPOGRAPHY.body, color: COLORS.text },
  time: { ...TYPOGRAPHY.bodyMedium, flexShrink: 1, color: COLORS.text, textAlign: "right", fontVariant: ["tabular-nums"] },
  timeWord: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  axis: { height: 18, marginTop: -4 },
  tick: { ...TYPOGRAPHY.caption, position: "absolute", width: TICK_WIDTH, color: COLORS.textLight },
  tickStart: { textAlign: "left" },
  tickMiddle: { textAlign: "center" },
  tickEnd: { textAlign: "right" },
});
