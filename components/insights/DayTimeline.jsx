import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { formatClock, formatNearClock } from "@/lib/insights/stats.mjs";

const MEAL_LABELS = { Breakfast: "Breakfast", Lunch: "Lunch", Dinner: "Dinner", Snack: "Snacks" };
const HOUR = 60;
const BAR = 10;
const LINE_NAME = 74;
const LINE_TIME = 66;
const LINE_GAP = 8;

// Each meal on the same clock: the band is the middle half of days, the dot the usual time.
// Compact puts each meal on one line: name, clock, time.
export default function DayTimeline({ meals, compact }) {
  const { fontScale } = useWindowDimensions();
  const start = Math.max(0, Math.floor(Math.min(...meals.map((meal) => meal.low)) / (3 * HOUR)) * 3 * HOUR);
  const end = Math.min(29 * HOUR, Math.ceil(Math.max(...meals.map((meal) => meal.high)) / (3 * HOUR)) * 3 * HOUR);
  const span = Math.max(end - start, 6 * HOUR);
  const at = (minutes) => `${(minutes - start) / span * 100}%`;
  const label = (minutes) => formatClock(minutes).replace(":00", "");
  const middle = Math.round((start + span / 2) / (3 * HOUR)) * 3 * HOUR;
  const track = (meal) => <View style={[styles.track, compact && styles.trackCompact]}>
    <View style={[styles.band, { left: at(meal.low), width: `${Math.max((meal.high - meal.low) / span * 100, 2)}%` }]} />
    <View style={[styles.dot, { left: at(meal.median) }]} />
  </View>;
  const nameWidth = LINE_NAME * fontScale, timeWidth = LINE_TIME * fontScale;
  const axis = <View style={[styles.axis, compact && { marginLeft: nameWidth + LINE_GAP, marginRight: timeWidth + LINE_GAP }]}>
    <Text style={styles.tick}>{label(start)}</Text>
    <Text style={[styles.tick, styles.tickMiddle, { left: at(middle) }]}>{label(middle)}</Text>
    <Text style={styles.tick}>{label(start + span)}</Text>
  </View>;
  if (compact) {
    return <View>
      {meals.map((meal) => <View key={meal.meal} accessible accessibilityLabel={`${MEAL_LABELS[meal.meal]}, usually about ${formatNearClock(meal.median)}`} style={styles.line}>
        <Text numberOfLines={1} style={[styles.name, { width: nameWidth }]}>{MEAL_LABELS[meal.meal]}</Text>
        {track(meal)}
        <Text numberOfLines={1} style={[styles.time, styles.lineTime, { width: timeWidth }]}>{formatNearClock(meal.median)}</Text>
      </View>)}
      {axis}
    </View>;
  }
  return <View style={styles.wrap}>
    {meals.map((meal) => <View key={meal.meal} accessible accessibilityLabel={`${MEAL_LABELS[meal.meal]}, usually about ${formatNearClock(meal.median)}, logged on ${meal.days} days`} style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.name}>{MEAL_LABELS[meal.meal]}</Text>
        <Text style={styles.time}>{formatNearClock(meal.median)}</Text>
      </View>
      {track(meal)}
    </View>)}
    {axis}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 2 },
  row: { gap: 6 },
  rowHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 8 },
  name: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  time: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
  track: { height: BAR, borderRadius: BAR / 2, backgroundColor: COLORS.track },
  band: { position: "absolute", top: 0, bottom: 0, borderRadius: BAR / 2, backgroundColor: COLORS.soft },
  dot: { position: "absolute", top: 0, width: BAR, height: BAR, marginLeft: -BAR / 2, borderRadius: BAR / 2, backgroundColor: COLORS.primary },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  line: { flexDirection: "row", alignItems: "center", gap: LINE_GAP, minHeight: 26 },
  lineTime: { textAlign: "right" },
  trackCompact: { flex: 1 },
  tick: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  tickMiddle: { position: "absolute", width: 80, marginLeft: -40, textAlign: "center" },
});
