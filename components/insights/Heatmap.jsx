import { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { heatmapWeeks } from "@/lib/insights/stats.mjs";

// Fuller squares with a narrower gap, on the same 15 pt pitch so the columns and labels don't move. The corner is
// about a third of the side, drawn as an iOS continuous curve, so it flows into the edge with no visible join.
const GAP = 2;
const SIZE = 13;
const PITCH = SIZE + GAP;
const RADIUS = 4.5;
const DOT = 14;
const DOT_GAP = 5;
const WEEKDAYS = ["", "M", "", "W", "", "F", ""];
const LABEL_WIDTH = 12 + 6;
// Labels locked to the grid can only grow so far before they collide.
const GRID_TEXT = 1.2;

// Filled on logged days, gray on missed ones, and a fainter gray before you started,
// so every period always shows all its days.
const fillFor = (day) => !day ? null : day.started ? { backgroundColor: day.logged ? COLORS.primary : COLORS.track } : styles.notStarted;

// A small calendar of dots, one row per week with Sunday first, so weekends stay in
// the same place.
export function WeekDots({ keys, logged, started }) {
  const weeks = useMemo(() => heatmapWeeks(keys, logged, started), [keys, logged, started]);
  return <View style={styles.dots}>
    <View style={styles.dotRow}>
      {["S", "M", "T", "W", "T", "F", "S"].map((letter, index) => <Text key={index} maxFontSizeMultiplier={GRID_TEXT} style={styles.dotHeader}>{letter}</Text>)}
    </View>
    {weeks.map((week) => <View key={week.days.find(Boolean).key} style={styles.dotRow}>
      {week.days.map((day, position) => <View key={position} style={[styles.dot, fillFor(day)]} />)}
    </View>)}
  </View>;
}

// A calendar of rounded squares in the style of GitHub's contribution graph, filled
// on logged days. It's wider than the phone, so it scrolls and opens on the newest
// days, always stopping on a whole column.
export default function Heatmap({ keys, logged, started }) {
  const scroller = useRef(null);
  const weeks = useMemo(() => heatmapWeeks(keys, logged, started), [keys, logged, started]);
  const [available, setAvailable] = useState(0);
  const [scrolledTo, setScrolledTo] = useState(null);
  const columns = Math.min(weeks.length, Math.floor((available + GAP) / PITCH));
  // A month label running off either edge would show clipped, like "un" or "Ju".
  const firstColumn = scrolledTo ?? weeks.length - columns;
  return <View style={styles.wrap} onLayout={(event) => setAvailable(event.nativeEvent.layout.width - LABEL_WIDTH)}>
    <View style={styles.body}>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((label, index) => <Text key={index} maxFontSizeMultiplier={GRID_TEXT} style={styles.weekday}>{label}</Text>)}
      </View>
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} style={{ width: columns * PITCH - GAP }}
        snapToInterval={PITCH} decelerationRate="fast" scrollEventThrottle={16}
        onScroll={(event) => setScrolledTo(Math.round(event.nativeEvent.contentOffset.x / PITCH))}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
        <View>
          <View style={[styles.months, { width: weeks.length * PITCH - GAP }]}>
            {weeks.map((week, index) => week.month && index >= firstColumn && index < firstColumn + columns - 1 && <Text key={index} maxFontSizeMultiplier={GRID_TEXT} numberOfLines={1} style={[styles.month, { left: index * PITCH }]}>{week.month}</Text>)}
          </View>
          <View style={styles.weeks}>
            {weeks.map((week, index) => <View key={index} style={styles.week}>
              {week.days.map((day, position) => <View key={position} style={[styles.cell, fillFor(day)]} />)}
            </View>)}
          </View>
        </View>
      </ScrollView>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  body: { flexDirection: "row", justifyContent: "space-between" },
  dots: { gap: DOT_GAP },
  dotRow: { flexDirection: "row", gap: DOT_GAP },
  dotHeader: { width: DOT, fontSize: 10, lineHeight: 14, color: COLORS.textLight, textAlign: "center" },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  months: { height: 16, marginBottom: 4 },
  month: { ...TYPOGRAPHY.caption, position: "absolute", top: 0, width: 40, fontSize: 11, lineHeight: 16, color: COLORS.textLight },
  weeks: { flexDirection: "row", gap: GAP },
  week: { gap: GAP },
  cell: { width: SIZE, height: SIZE, borderRadius: RADIUS, borderCurve: "continuous" },
  // The missed-day gray, lighter: a soft full shape rather than a hairline outline, which read thin and uneven.
  notStarted: { backgroundColor: COLORS.track, opacity: 0.5 },
  weekdays: { gap: GAP, marginTop: 20, width: 12 },
  weekday: { height: SIZE, lineHeight: SIZE, fontSize: 10, color: COLORS.textLight, textAlign: "center" },
});
