import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, InteractionManager, PixelRatio, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { FormCard, GlassButton } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { SURFACES } from "@/constants/surfaces";
import { calendarStart, isDaySelectable, listMonths, monthCells, monthKey, monthRowCount, parseLocalDate } from "@/lib/calendarMonths.mjs";
import { calendarDayStatus } from "@/lib/nutritionPresentation.mjs";
import { localDateKey } from "@/lib/nutritionStore.mjs";

const CELL_HEIGHT = 38;
const MONTH_LABEL_HEIGHT = 34;
// A touch taller than a five-row month, so the neighboring month peeks in and shows there's more to scroll.
const VIEWPORT_HEIGHT = MONTH_LABEL_HEIGHT + 5 * CELL_HEIGHT + 18;
// Today's week rests at the bottom edge, so the list ends in clear space and the fade never dims it.
const BOTTOM_FADE = 10;
const SELECTED_DISC = 32;
const LOG_DOT = 4;
const CARD_PADDING = 4;
const CARD_GAP = 12;
// Below this progress the card fades, so its clipped last few points never show as a flat sliver.
const FADE_BELOW = 0.35;
// Clamped just under critical damping, so a move lands once without reversing a pixel or crawling to a stop.
// Progress runs 0 to 1, so the default rest thresholds would snap the last few points of height.
const SPRING = { mass: 0.9, stiffness: 300, damping: 30, overshootClamping: true, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.01 };

const monthHeight = ({ year, month }) => MONTH_LABEL_HEIGHT + monthRowCount(year, month) * CELL_HEIGHT;

const DayCell = memo(function DayCell({ date, selected, isToday, disabled, statusText, logged, width, onSelect }) {
  return <TouchableOpacity accessibilityRole="button"
    accessibilityLabel={date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
    accessibilityValue={{ text: statusText }} accessibilityState={{ selected, disabled }}
    disabled={disabled} onPress={() => onSelect(date)} style={[styles.day, { width }]}>
    <View style={[styles.number, selected && styles.numberSelected]}>
      <Text maxFontSizeMultiplier={1.2} style={[styles.dayNumber, isToday && styles.dayToday,
        disabled && styles.dayDisabled, selected && styles.dayNumberSelected]}>{date.getDate()}</Text>
      {/* Always holds its space so numbers line up across a row. */}
      <View style={[styles.logDot, logged && styles.logDotOn, logged && selected && styles.logDotSelected]} />
    </View>
  </TouchableOpacity>;
});

const MonthPage = memo(function MonthPage({ year, month, width, selectedKey, todayKey, signUpDate, dataByDate, calorieGoal, historyAvailable, onSelect }) {
  const cells = useMemo(() => monthCells(year, month, parseLocalDate(todayKey)), [year, month, todayKey]);
  // Snapped down to whole pixels: seven rounded-up percentages can overflow and wrap a row.
  const cellWidth = Math.floor(width / 7 * PixelRatio.get()) / PixelRatio.get();
  return <View style={{ width }}>
    <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.month}>
      {new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
    </Text>
    <View style={styles.monthGrid}>
      {cells.map((date, index) => {
        if (!date) return <View key={`blank-${index}`} style={[styles.day, { width: cellWidth }]} />;
        const key = localDateKey(date);
        const day = dataByDate[key];
        return <DayCell key={key} date={date} selected={key === selectedKey} isToday={key === todayKey}
          disabled={!isDaySelectable(date, signUpDate)} width={cellWidth} onSelect={onSelect}
          statusText={calendarDayStatus(day, calorieGoal, { historyAvailable }).text} logged={day?.entries?.length > 0} />;
      })}
    </View>
  </View>;
});

// Today's date header. Tapping it opens the calendar: one continuous scroll of months, oldest at the top.
export default function DayDrop({ selectedDate, isToday, onSelectDate, onToday, onOpen, onClose, dataByDate, calorieGoal, signUpDate,
  historyLoading = false, historyError = null, historyPending = false, onRetryHistory }) {
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pageWidth, setPageWidth] = useState(0);
  const selectedKey = localDateKey(selectedDate);
  const today = new Date();
  const todayKey = localDateKey(today);
  const list = useRef(null);
  const progress = useSharedValue(0);
  const chrome = useSharedValue(60);

  const dateKeys = useMemo(() => Object.keys(dataByDate), [dataByDate]);
  // Inverted, so the list starts on this month and older months arriving later can't move what's on screen.
  const months = useMemo(() => listMonths(calendarStart(signUpDate, dateKeys, new Date()), new Date()).reverse(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- todayKey rolls the list over at midnight.
    [signUpDate, dateKeys, todayKey]);
  const offsets = useMemo(() => {
    let total = BOTTOM_FADE;
    return months.map((month) => { const offset = total; total += monthHeight(month); return offset; });
  }, [months]);

  // Mounted ahead of the first tap: building the months mid-animation drops frames.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setMounted(true));
    return () => task.cancel();
  }, []);

  // Shows a date's month from its label down, unless that would crop the date itself off the bottom.
  const scrollToDate = useCallback((date, animated) => {
    const position = Math.max(months.findIndex((item) => item.key === monthKey(date)), 0);
    const { year, month } = months[position];
    const rowsBelow = monthRowCount(year, month) - 1 - Math.floor((new Date(year, month, 1).getDay() + date.getDate() - 1) / 7);
    const offset = offsets[position] + Math.min(monthHeight(months[position]) - VIEWPORT_HEIGHT, rowsBelow * CELL_HEIGHT - BOTTOM_FADE);
    list.current?.scrollToOffset({ offset: Math.max(offset, 0), animated });
  }, [months, offsets]);

  const toggle = useCallback((next) => {
    setOpen(next);
    if (next) {
      onOpen?.();
      setMounted(true);
      scrollToDate(selectedDate, false);
      progress.value = withSpring(1, SPRING);
    } else {
      onClose?.();
      progress.value = withSpring(0, SPRING);
    }
  }, [selectedDate, scrollToDate, progress, onOpen, onClose]);

  const select = useCallback((date) => {
    if (localDateKey(date) === selectedKey) toggle(false);
    else onSelectDate(date);
  }, [selectedKey, onSelectDate, toggle]);

  const goToToday = () => {
    onToday();
    if (open) list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // One height drives the page, so the cards below move with the calendar's edge.
  const panelStyle = useAnimatedStyle(() => ({
    height: progress.value * (chrome.value + VIEWPORT_HEIGHT),
    opacity: Math.min(progress.value / FADE_BELOW, 1),
  }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 180}deg` }] }));

  const label = selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const weekdays = fontScale > 1.4 ? ["S", "M", "T", "W", "T", "F", "S"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const historyAvailable = !historyLoading && !historyError;

  return <View>
    <View style={styles.header}>
      <Pressable onPress={() => toggle(!open)} accessibilityRole="button"
        accessibilityLabel={`${isToday ? "Today, " : ""}${label}. ${open ? "Hide" : "Show"} calendar`} accessibilityState={{ expanded: open }}
        style={styles.toggle}>
        <Text style={styles.date}>{isToday ? "Today" : label}</Text>
        {/* Drawn because the icon font's stroke is too thin beside the semibold date. Centered on 8, so it turns in place. */}
        <Animated.View style={chevronStyle}>
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <Path d="M3 5.5 L8 10.5 L13 5.5" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </Pressable>
      {!isToday && <GlassButton title="Today" accessibilityLabel="Go to today"
        onPress={goToToday}
        style={{ height: 40, width: 76 * Math.min(fontScale, 1.6) }} />}
    </View>
    <Animated.View style={[styles.panel, panelStyle]} pointerEvents={open ? "box-none" : "none"}
      accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
      {mounted && <FormCard variant="grouped" style={styles.card}>
        <View onLayout={({ nativeEvent }) => {
          const height = nativeEvent.layout.height + 2 * CARD_PADDING + CARD_GAP + 1;
          chrome.value = open ? withSpring(height, SPRING) : height;
        }}>
          {/* Dots fill in once history arrives. Only history that never loaded earns a line here. */}
          {Boolean(historyError) && <Pressable onPress={onRetryHistory} disabled={historyPending} accessibilityRole="button"
            accessibilityLabel="Meal history couldn’t load. Retry." accessibilityState={{ disabled: historyPending, busy: historyPending }}
            style={[styles.status, historyPending && styles.statusPending]}>
            <Text style={styles.statusText}>Meal history couldn’t load. <Text style={styles.retry}>Retry</Text></Text>
          </Pressable>}
          <View style={styles.weekdays}>
            {weekdays.map((day, position) => <Text key={position} maxFontSizeMultiplier={1.35} style={styles.weekday}>{day}</Text>)}
          </View>
        </View>
        <View style={styles.months} onLayout={({ nativeEvent }) => setPageWidth(nativeEvent.layout.width)}>
          {pageWidth > 0 && <FlatList ref={list} inverted data={months} contentContainerStyle={{ paddingTop: BOTTOM_FADE }} showsVerticalScrollIndicator={false} scrollsToTop={false}
            keyExtractor={(item) => item.key} initialNumToRender={2} maxToRenderPerBatch={2} windowSize={9} updateCellsBatchingPeriod={100}
            getItemLayout={(_, position) => ({ length: monthHeight(months[position]), offset: offsets[position], index: position })}
            renderItem={({ item }) => <MonthPage year={item.year} month={item.month} width={pageWidth} selectedKey={selectedKey}
              todayKey={todayKey} signUpDate={signUpDate} dataByDate={dataByDate} calorieGoal={calorieGoal}
              historyAvailable={historyAvailable} onSelect={select} />} />}
          {/* Months dissolve at the edges, so a row cut off by the scroll never reads as a glitch. */}
          <LinearGradient pointerEvents="none" colors={[SURFACES.grouped, `${SURFACES.grouped}00`]} style={[styles.fade, { top: 0, height: 16 }]} />
          <LinearGradient pointerEvents="none" colors={[`${SURFACES.grouped}00`, SURFACES.grouped]} style={[styles.fade, { bottom: 0, height: BOTTOM_FADE }]} />
        </View>
      </FormCard>}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, flexShrink: 1, flexGrow: 1 },
  date: { fontSize: 18, fontWeight: "600", color: COLORS.text, flexShrink: 1 },
  panel: { overflow: "hidden" },
  // Absolute so the panel's height can't reach it: with no room left, Yoga lays a child out at zero height.
  card: { position: "absolute", top: 0, left: 0, right: 0, paddingVertical: CARD_PADDING, paddingHorizontal: 0, gap: 0 },
  status: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  statusPending: { opacity: 0.5 },
  statusText: { color: COLORS.textLight, textAlign: "center", flexShrink: 1 },
  retry: { color: COLORS.primary },
  weekdays: { flexDirection: "row", paddingTop: 10, paddingBottom: 6 },
  weekday: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "500", color: COLORS.textLight },
  months: { height: VIEWPORT_HEIGHT, overflow: "hidden" },
  fade: { position: "absolute", left: 0, right: 0 },
  month: { height: MONTH_LABEL_HEIGHT, paddingTop: 10, paddingHorizontal: 16, fontSize: 15, fontWeight: "600", color: COLORS.text },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start" },
  day: { height: CELL_HEIGHT, alignItems: "center", justifyContent: "center" },
  number: { width: SELECTED_DISC, height: SELECTED_DISC, borderRadius: SELECTED_DISC / 2, alignItems: "center", justifyContent: "center" },
  numberSelected: { backgroundColor: COLORS.primary },
  logDot: { width: LOG_DOT, height: LOG_DOT, borderRadius: LOG_DOT / 2, marginTop: 1 },
  logDotOn: { backgroundColor: COLORS.primary },
  logDotSelected: { backgroundColor: COLORS.white },
  dayNumber: { fontSize: 15, fontWeight: "500", fontVariant: ["tabular-nums"], color: COLORS.text },
  dayNumberSelected: { color: COLORS.white },
  dayToday: { color: COLORS.primary },
  dayDisabled: { color: COLORS.textLight, opacity: 0.7 },
});
