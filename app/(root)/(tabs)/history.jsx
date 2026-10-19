import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
  Alert,
  Pressable,
  useWindowDimensions,
} from "react-native";
// Removed reanimated for meal group container to avoid date-switch animations
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AnimatedRe, { Layout as ReLayout } from "react-native-reanimated";

import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNutritionData } from "@/hooks/useNutritionData";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem, closeOpenMealActions } from "@/components/FoodEntryItem";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { FormCard, GlassButton } from "@/components/GlassForm";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ArrowButton = ({ direction, disabled, onPress }) => <GlassButton
  symbol={direction === "left" ? "chevron.left" : "chevron.right"}
  accessibilityLabel={direction === "left" ? "Previous month" : "Next month"}
  disabled={disabled} onPress={onPress} style={styles.navButton} />;

const AnimatedMealGroupContainer = AnimatedRe.createAnimatedComponent(View);
const AnimatedContent = AnimatedRe.createAnimatedComponent(View);

const MealGroup = ({ title, entries, onDelete, onEdit, shouldAnimate }) => {
  if (!entries || entries.length === 0) return null;
  const layoutAnim = shouldAnimate
    ? ReLayout.springify().damping(15)
    : undefined;
  return (
    <AnimatedMealGroupContainer
      style={styles.mealGroupContainer}
      layout={layoutAnim}
    >
      <Text style={styles.mealGroupTitle}>{title}</Text>
      {entries.map((item) => (
        <FoodEntryItem
          key={item.id}
          item={item}
          onDelete={onDelete}
          onEdit={onEdit}
          enableLayout={shouldAnimate}
        />
      ))}
    </AnimatedMealGroupContainer>
  );
};

const getLocalDateString = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

const MonthCalendar = ({
  monthDate,
  selectedDate,
  onSelectDate,
  dataByDate,
  calorieGoal,
  signUpDate,
}) => {
  const today = new Date();
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  // Determine number of days in month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Build list for all days in the month (including future days)
  const days = Array.from(
    { length: totalDays },
    (_, i) => new Date(year, month, i + 1)
  );

  // Determine the weekday (0=Sun) of the 1st day to pad grid
  const firstWeekday = new Date(year, month, 1).getDay();

  const { fontScale } = useWindowDimensions();
  const weekdayLabels = fontScale > 1.4 ? ["S", "M", "T", "W", "T", "F", "S"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const renderDay = (day) => {
    const dateStr = getLocalDateString(day);
    const isSelected = dateStr === getLocalDateString(selectedDate);
    const isFuture =
      day > today && year === today.getFullYear() && month === today.getMonth();
    // Compare dates only (ignore time) to avoid timezone issues
    const signupLocal = signUpDate ? getLocalDateString(signUpDate) : null;
    const isBeforeSignup = signupLocal && dateStr < signupLocal;

    const dateNumber = day.getDate();

    // Determine status color (only for days with entries)
    let indicatorColor = "transparent";
    const cached = dataByDate[dateStr];
    if (cached && cached.entries && cached.entries.length > 0) {
      const consumed = Number(
        cached.summary?.calories ?? cached.summary?.dailyTotals?.calories ?? 0
      );

      // Prefer the historical goal for this date if the backend provided it
      const goalForDate =
        cached.summary?.goals?.calorieGoal != null
          ? cached.summary.goals.calorieGoal
          : calorieGoal; // fallback to current goal

      if (goalForDate != null) {
        indicatorColor =
          consumed > goalForDate ? COLORS.expense : COLORS.income;
      }
    }

    const onPress = () => {
      if (isFuture || isBeforeSignup) return;
      onSelectDate(day);
    };

    return (
      <TouchableOpacity
        key={dateStr}
        accessibilityRole="button"
        accessibilityLabel={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        accessibilityState={{ selected: isSelected, disabled: Boolean(isFuture || isBeforeSignup) }}
        style={[styles.dayContainer, isSelected && styles.daySelected]}
        disabled={isFuture || isBeforeSignup}
        onPress={onPress}
      >
        <Text maxFontSizeMultiplier={1.35}
          style={[
            styles.dayNumber,
            (isFuture || isBeforeSignup) && styles.dayDisabled,
          ]}
        >
          {dateNumber}
        </Text>
        <View
          style={[styles.indicatorDot, { backgroundColor: indicatorColor }]}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View>
      {/* Weekday header */}
      <View style={styles.weekHeaderRow}>
        {weekdayLabels.map((label, index) => (
          <Text key={index} maxFontSizeMultiplier={1.35} style={styles.weekHeaderText}>
            {label}
          </Text>
        ))}
      </View>

      {/* Days grid */}
      <View style={styles.monthGrid}>
        {/* empty spacers for first week offset */}
        {Array.from({ length: firstWeekday }).map((_, idx) => (
          <View key={`spacer-${idx}`} style={styles.daySpacer} />
        ))}
        {days.map(renderDay)}
      </View>
    </View>
  );
};

const previewNote = () => Alert.alert("UI preview", "This example stays local. No meal records are read or changed.");
export default function HistoryScreen({ calmeraPreview = false } = {}) {
  return calmeraPreview ? <HistoryPreview /> : <HistoryConnected />;
}

function HistoryConnected() {
  const tabBarHeight = useBottomTabBarHeight();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const data = useNutritionData(selectedDate, true);
  return <HistoryView selectedDate={selectedDate} setSelectedDate={setSelectedDate} data={data}
    floatingBarInset={Platform.OS === "ios" ? tabBarHeight : 0} />;
}

function HistoryPreview() {
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 9, 19));
  const data = useMemo(() => ({
    dataByDate: { "2026-10-19": { entries: [
      { id: "ui-history-banana", foodName: "Banana", mealType: "Breakfast", localTime: "09:00:00", calories: 105, protein: 1, carbs: 27, fat: 0 },
      { id: "ui-history-toast", foodName: "Avocado toast", mealType: "Lunch", localTime: "12:00:00", calories: 280, protein: 8, carbs: 32, fat: 14 },
    ], summary: { calories: 385, protein: 9, carbs: 59, fat: 14 } } },
    profile: { createdAtLocalDate: "2026-09-01" },
    goals: { calorieGoal: 2000, proteinGoal: 150, carbsGoal: 200, fatGoal: 50 },
    error: null, refresh: async () => {}, deleteEntry: async () => previewNote(), historyLoading: false,
  }), []);
  return <HistoryView selectedDate={selectedDate} setSelectedDate={setSelectedDate} data={data} preview />;
}

function HistoryView({ selectedDate, setSelectedDate, data, floatingBarInset = 0, preview = false }) {
  const { fontScale } = useWindowDimensions();
  const { dataByDate, profile, goals, error, refresh, deleteEntry, historyLoading } = data;
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); } catch {} finally { setRefreshing(false); }
  }, [refresh]);
  const calorieGoal = goals.calorieGoal;
  const signUpDate = useMemo(() => profile?.createdAtLocalDate
    ? new Date(`${profile.createdAtLocalDate.split("T")[0]}T00:00:00`) : null, [profile?.createdAtLocalDate]);
  const [suppressGroupAnim, setSuppressGroupAnim] = useState(false);
  useEffect(() => {
    setSuppressGroupAnim(true);
    const id = setTimeout(() => setSuppressGroupAnim(false), 50);
    return () => clearTimeout(id);
  }, [selectedDate]);

  // Store the last selected day for each month so we can return to it when navigating
  const lastSelectedPerMonth = useRef({}); // { '2025-6': Date }

  // Helper to determine if a given date can be tapped/selected
  const isDateSelectable = useCallback(
    (date) => {
      const today = new Date();
      if (date > today) return false;
      if (signUpDate && date < signUpDate) return false;
      return true;
    },
    [signUpDate]
  );

  // Remember the most recently selected day for its month
  useEffect(() => {
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}`;
    lastSelectedPerMonth.current[key] = selectedDate;
  }, [selectedDate]);

  // helper to compare months relative to signup date
  const isBeforeSignupMonth = (date) => {
    if (!signUpDate) return false;
    return (
      date.getFullYear() < signUpDate.getFullYear() ||
      (date.getFullYear() === signUpDate.getFullYear() &&
        date.getMonth() < signUpDate.getMonth())
    );
  };

  const handleDelete = (id) => {
    Alert.alert("Delete Entry", "Are you sure you want to delete this food entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        try { await deleteEntry(id); }
        catch { Alert.alert("Couldn't delete meal", "Please try again."); }
      } },
    ]);
  };

  // Navigation between months
  const changeMonth = (delta) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDate((prev) => {
      const today = new Date();

      // Move to the first day of the target month to avoid overflow (e.g. 31 → 30)
      let target = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);

      // Prevent navigating into future months
      if (
        target.getFullYear() > today.getFullYear() ||
        (target.getFullYear() === today.getFullYear() &&
          target.getMonth() > today.getMonth())
      ) {
        return today; // current date is the furthest in the future we allow
      }

      // Prevent navigating before the signup month
      if (isBeforeSignupMonth(target)) {
        // Snap to the signup month (day will be adjusted below)
        target = new Date(signUpDate.getFullYear(), signUpDate.getMonth(), 1);
      }

      // 1️⃣ Try to restore the previously selected day for this month
      const monthKey = `${target.getFullYear()}-${target.getMonth()}`;
      const remembered = lastSelectedPerMonth.current[monthKey];
      if (remembered && isDateSelectable(remembered)) {
        return new Date(remembered);
      }

      // 2️⃣ Otherwise fall back to the last selectable day of the month
      let lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);

      // Clamp to today if we are looking at the current month
      if (
        lastDay.getFullYear() === today.getFullYear() &&
        lastDay.getMonth() === today.getMonth()
      ) {
        lastDay = today;
      }

      // Clamp to signup date if this is the signup month and signup day is after lastDay (shouldn't normally happen)
      if (
        signUpDate &&
        lastDay.getFullYear() === signUpDate.getFullYear() &&
        lastDay.getMonth() === signUpDate.getMonth() &&
        lastDay < signUpDate
      ) {
        lastDay = new Date(signUpDate);
      }

      return lastDay;
    });
  };

  const today = new Date();
  const isCurrentMonth =
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getFullYear() === today.getFullYear();

  const isSignupMonthView =
    signUpDate &&
    selectedDate.getMonth() === signUpDate.getMonth() &&
    selectedDate.getFullYear() === signUpDate.getFullYear();

  const monthLabel = selectedDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const dateStr = getLocalDateString(selectedDate);
  const entries = dataByDate[dateStr]?.entries || [];
  // Sort entries the same deterministic way as Dashboard (localTime ASC, id ASC)
  const sortedEntries = [...entries].sort((a, b) => {
    const tA = (a.localTime || a.local_time || "").toString();
    const tB = (b.localTime || b.local_time || "").toString();
    if (tA !== tB) {
      return tA.localeCompare(tB); // earlier time first
    }
    return a.id - b.id; // tie-breaker: older entry first
  });

  const summary = dataByDate[dateStr]?.summary || {};

  const groupedEntries = sortedEntries.reduce((acc, entry) => {
    const meal = entry.mealType || entry.meal_type;
    if (!acc[meal]) acc[meal] = [];
    acc[meal].push(entry);
    return acc;
  }, {});

  const mealOrder = ["Breakfast", "Lunch", "Dinner", "Snack"];

  return (
    <View style={styles.container}>
      {/* Date navigation & summary */}
      <ScrollView key={`history-text-${fontScale}`} onScrollBeginDrag={closeOpenMealActions} directionalLockEnabled alwaysBounceHorizontal={false}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 40 + floatingBarInset }}
        scrollIndicatorInsets={{ bottom: floatingBarInset }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerContainer}>
          <Text accessibilityRole="header" style={styles.pageTitle}>History</Text>
          <FormCard style={styles.calendarCard}>
          {/* Month navigation + label */}
          <View style={styles.dateNav}>
            <ArrowButton
              direction="left"
              onPress={() => changeMonth(-1)}
              disabled={isSignupMonthView}
            />
            <Text style={styles.dateText}>{monthLabel}</Text>
            <ArrowButton
              direction="right"
              onPress={() => changeMonth(1)}
              disabled={isCurrentMonth}
            />
          </View>

          {historyLoading && <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 12 }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.emptyText}>Getting your meals…</Text>
          </View>}
          {error && <Pressable onPress={() => refresh().catch(() => {})} accessibilityRole="button" style={{ padding: 12 }}>
            <Text style={styles.emptyText}>Meals couldn’t refresh. Tap to retry.</Text>
          </Pressable>}
          {/* Week calendar row */}
          <MonthCalendar
            monthDate={selectedDate}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d)}
            dataByDate={dataByDate}
            calorieGoal={calorieGoal}
            signUpDate={signUpDate}
          />
          </FormCard>
          {entries.length > 0 && (
            <NutritionSummaryCard
              onEditGoals={preview ? previewNote : undefined}
              summary={summary}
              goals={summary.goals || goals} // TODO: 1. what is || goal for ? 2. performance optimization: when the user updates goals, we only need to update today's goal and rerender today's summary card.
            />
          )}
        </View>

        <AnimatedContent
          key={dateStr}
          style={styles.transactionsContainer}
          // Disable layout animation completely for container on date switch
          layout={ReLayout.duration(0)}
        >
          {entries.length > 0 ? (
            mealOrder.map((meal) => (
              <MealGroup
                key={meal}
                title={meal}
                entries={groupedEntries[meal] || []}
                onDelete={handleDelete}
                onEdit={preview ? previewNote : undefined}
                shouldAnimate={!suppressGroupAnim}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>{historyLoading ? "" : error ? "" : "No entries for this date."}</Text>
          )}
        </AnimatedContent>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    marginBottom: 0,
  },
  pageTitle: { marginTop: 20, marginBottom: 20, textAlign: "center", fontSize: 18, fontWeight: "600", color: COLORS.text },
  calendarCard: { padding: 12, gap: 0, marginBottom: 12 },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
    marginBottom: 12,
    gap: 8,
  },
  navButton: { width: 44, height: 44, minHeight: 44 },
  dateText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginHorizontal: 2,
    flex: 1,
    textAlign: "center",
  },
  mealGroupContainer: {
    marginBottom: 10,
  },
  mealGroupTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },
  transactionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    color: COLORS.textLight,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dayContainer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: 6,
    borderRadius: 14,
    width: `${100 / 7}%`,
  },
  daySelected: {
    backgroundColor: COLORS.primary + "20", // light tint
  },
  dayLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  indicatorDot: {
    marginTop: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textLight,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  daySpacer: {
    width: `${100 / 7}%`,
    paddingVertical: 6,
  },
  dayDisabled: {
    color: COLORS.textLight,
    opacity: 0.7,
  },
});
