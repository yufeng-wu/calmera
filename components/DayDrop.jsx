import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, InteractionManager, PixelRatio, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { FormCard, GlassButton } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { calendarStart, isDaySelectable, listMonths, monthCells, monthKey, monthRowCount } from "@/lib/calendarMonths.mjs";
import { calendarDayStatus } from "@/lib/nutritionPresentation.mjs";
import { localDateKey } from "@/lib/nutritionStore.mjs";

const CELL_HEIGHT = 38;
const MAX_ROWS = 6;
const SELECTED_DISC = 32;
const LOG_DOT = 4;
const CARD_PADDING = 4;
const CARD_GAP = 12;
const OPEN_SPRING = { mass: 0.9, stiffness: 300, damping: 28 };
const CLOSE_SPRING = { mass: 0.9, stiffness: 300, damping: 34, overshootClamping: true };

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
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  // Snapped down to whole pixels: seven rounded-up percentages can overflow and wrap a row.
  const cellWidth = Math.floor(width / 7 * PixelRatio.get()) / PixelRatio.get();
  return <View style={[styles.monthGrid, { width }]}>
    {cells.map((date, index) => {
      if (!date) return <View key={`blank-${index}`} style={[styles.day, { width: cellWidth }]} />;
      const key = localDateKey(date);
      const day = dataByDate[key];
      return <DayCell key={key} date={date} selected={key === selectedKey} isToday={key === todayKey}
        disabled={!isDaySelectable(date, signUpDate)} width={cellWidth} onSelect={onSelect}
        statusText={calendarDayStatus(day, calorieGoal, { historyAvailable }).text} logged={day?.entries?.length > 0} />;
    })}
  </View>;
});

// Today's date header. Tapping it opens a month with a dot on each logged day;
// months flip with the chevrons or a horizontal swipe.
export default function DayDrop({ selectedDate, isToday, onSelectDate, onToday, onClose, onMovingChange, dataByDate, calorieGoal, signUpDate,
  historyLoading = false, historyError = null, historyPending = false, onRetryHistory }) {
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pageWidth, setPageWidth] = useState(0);
  const selectedKey = localDateKey(selectedDate);
  const [viewKey, setViewKey] = useState(monthKey(selectedDate));
  const today = new Date();
  const todayKey = localDateKey(today);
  const list = useRef(null);
  const progress = useSharedValue(0);
  const chrome = useSharedValue(90);
  const grid = useSharedValue(0);
  const rowsShown = useRef(0);

  const dateKeys = useMemo(() => Object.keys(dataByDate), [dataByDate]);
  const months = useMemo(() => listMonths(calendarStart(signUpDate, dateKeys, new Date()), new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- todayKey rolls the list over at midnight.
    [signUpDate, dateKeys, todayKey]);
  const found = months.findIndex((item) => item.key === viewKey);
  const index = found < 0 ? months.length - 1 : found;
  const current = months[index];
  const rows = monthRowCount(current.year, current.month);

  // Mounted ahead of the first tap: building the grid mid-animation drops frames.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setMounted(true));
    return () => task.cancel();
  }, []);

  // Reports when a move settles, so the page can hold other layout animations until then.
  const settled = useCallback((finished) => {
    "worklet";
    if (finished && onMovingChange) runOnJS(onMovingChange)(false);
  }, [onMovingChange]);

  useEffect(() => {
    if (rowsShown.current === rows) return;
    rowsShown.current = rows;
    const height = rows * CELL_HEIGHT;
    if (!open) { grid.value = height; return; }
    onMovingChange?.(true);
    grid.value = withSpring(height, OPEN_SPRING, settled);
  }, [open, rows, grid, settled, onMovingChange]);

  const toggle = useCallback((next) => {
    setOpen(next);
    onMovingChange?.(true);
    if (next) {
      const key = monthKey(selectedDate);
      const position = Math.max(months.findIndex((item) => item.key === key), 0);
      const target = months[position] || months[months.length - 1];
      setViewKey(target.key);
      rowsShown.current = monthRowCount(target.year, target.month);
      grid.value = rowsShown.current * CELL_HEIGHT;
      setMounted(true);
      list.current?.scrollToIndex({ index: position, animated: false });
      progress.value = withSpring(1, OPEN_SPRING, settled);
    } else {
      onClose?.();
      progress.value = withSpring(0, CLOSE_SPRING, settled);
    }
  }, [selectedDate, months, grid, progress, onClose, onMovingChange, settled]);

  const select = useCallback((date) => {
    if (localDateKey(date) === selectedKey) toggle(false);
    else onSelectDate(date);
  }, [selectedKey, onSelectDate, toggle]);

  const flip = (delta) => {
    const target = months[index + delta];
    if (!target) return;
    setViewKey(target.key);
    list.current?.scrollToIndex({ index: index + delta, animated: true });
  };

  const goToToday = () => {
    onToday();
    if (!open) return;
    setViewKey(months[months.length - 1].key);
    list.current?.scrollToIndex({ index: months.length - 1, animated: true });
  };

  // One height drives the page, so the cards below move with the calendar's edge.
  const panelStyle = useAnimatedStyle(() => ({ height: progress.value * (chrome.value + grid.value) }));
  const gridStyle = useAnimatedStyle(() => ({ height: grid.value }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 180}deg` }] }));

  const label = selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const monthLabel = new Date(current.year, current.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekdays = fontScale > 1.4 ? ["S", "M", "T", "W", "T", "F", "S"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const historyAvailable = !historyLoading && !historyError;

  return <View>
    <View style={styles.header}>
      <Pressable onPress={() => toggle(!open)} accessibilityRole="button"
        accessibilityLabel={`${isToday ? "Today, " : ""}${label}. ${open ? "Hide" : "Show"} calendar`} accessibilityState={{ expanded: open }}
        style={styles.toggle}>
        <Text style={styles.date}>{isToday ? "Today" : label}</Text>
        <Animated.View style={chevronStyle}><Ionicons name="chevron-down" size={16} color={COLORS.primary} /></Animated.View>
      </Pressable>
      {!isToday && <GlassButton title="Today" accessibilityLabel="Go to today"
        onPress={goToToday}
        style={{ height: 40, width: 76 * Math.min(fontScale, 1.6) }} />}
    </View>
    <Animated.View style={[styles.panel, panelStyle]} pointerEvents={open ? "box-none" : "none"}
      accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
      {mounted && <FormCard variant="grouped" style={styles.card}>
        <View onLayout={({ nativeEvent }) => {
          chrome.value = nativeEvent.layout.height + 2 * CARD_PADDING + CARD_GAP + 1;
        }}>
          <View style={styles.nav}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" accessibilityState={{ disabled: index === 0 }}
              disabled={index === 0} onPress={() => flip(-1)} hitSlop={4} style={[styles.navButton, index === 0 && styles.navDisabled]}>
              <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            </Pressable>
            <Text accessibilityRole="header" style={styles.month}>{monthLabel}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{ disabled: index === months.length - 1 }}
              disabled={index === months.length - 1} onPress={() => flip(1)} hitSlop={4}
              style={[styles.navButton, index === months.length - 1 && styles.navDisabled]}>
              <Ionicons name="chevron-forward" size={22} color={COLORS.text} />
            </Pressable>
          </View>
          {historyLoading && <View style={styles.status}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.statusText}>Getting your meals…</Text>
          </View>}
          {Boolean(historyError) && <Pressable onPress={onRetryHistory} disabled={historyPending} accessibilityRole="button"
            accessibilityLabel={historyPending ? "Retrying meal history" : "Meal history couldn’t refresh. Retry."}
            accessibilityState={{ disabled: historyPending, busy: historyPending }} style={styles.status}>
            {historyPending && <ActivityIndicator size="small" color={COLORS.primary} accessible={false} />}
            <Text style={styles.statusText} accessibilityLiveRegion="polite">{historyPending ? "Retrying…"
              : <>Meal history couldn’t refresh. <Text style={styles.retry}>Retry</Text></>}</Text>
          </Pressable>}
          <View style={styles.weekdays}>
            {weekdays.map((day, position) => <Text key={position} maxFontSizeMultiplier={1.35} style={styles.weekday}>{day}</Text>)}
          </View>
        </View>
        <Animated.View style={[styles.grid, gridStyle]} onLayout={({ nativeEvent }) => setPageWidth(nativeEvent.layout.width)}>
          {pageWidth > 0 && <FlatList ref={list} key={`${months.length}-${pageWidth}`} data={months} horizontal pagingEnabled
            style={{ height: MAX_ROWS * CELL_HEIGHT }} showsHorizontalScrollIndicator={false} scrollsToTop={false}
            keyExtractor={(item) => item.key} initialScrollIndex={index} initialNumToRender={1} windowSize={3} maxToRenderPerBatch={1}
            getItemLayout={(_, position) => ({ length: pageWidth, offset: pageWidth * position, index: position })}
            onMomentumScrollEnd={({ nativeEvent }) => {
              const target = months[Math.round(nativeEvent.contentOffset.x / pageWidth)];
              if (target) setViewKey(target.key);
            }}
            renderItem={({ item }) => <MonthPage year={item.year} month={item.month} width={pageWidth} selectedKey={selectedKey}
              todayKey={todayKey} signUpDate={signUpDate} dataByDate={dataByDate} calorieGoal={calorieGoal}
              historyAvailable={historyAvailable} onSelect={select} />} />}
        </Animated.View>
      </FormCard>}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, flexShrink: 1, flexGrow: 1 },
  date: { fontSize: 18, fontWeight: "600", color: COLORS.text, flexShrink: 1 },
  panel: { overflow: "hidden" },
  card: { paddingVertical: CARD_PADDING, paddingHorizontal: 0, gap: 0, marginBottom: CARD_GAP },
  nav: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 8 },
  navButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navDisabled: { opacity: 0.35 },
  month: { flex: 1, fontSize: 16, fontWeight: "600", color: COLORS.text, textAlign: "center" },
  status: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  statusText: { color: COLORS.textLight, textAlign: "center", flexShrink: 1 },
  retry: { color: COLORS.primary },
  weekdays: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "500", color: COLORS.textLight },
  grid: { overflow: "hidden" },
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
