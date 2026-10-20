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
import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from "react";
import AnimatedRe, { Layout as ReLayout } from "react-native-reanimated";

import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNutritionData } from "@/hooks/useNutritionData";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem, closeOpenMealActions } from "@/components/FoodEntryItem";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { FormCard, GlassButton } from "@/components/GlassForm";
import { calendarDayStatus, nutritionViewState, retryNutritionError } from "@/lib/nutritionPresentation.mjs";
import { createNutritionStore } from "@/lib/nutritionStore.mjs";
import { readNutrition } from "@/lib/nutritionRequest.mjs";

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
  historyAvailable,
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

    const status = calendarDayStatus(dataByDate[dateStr], calorieGoal, { historyAvailable });
    const indicatorColor = status.goalStatus === "above" ? COLORS.expense
      : status.goalStatus === "within" ? COLORS.income : "transparent";

    const onPress = () => {
      if (isFuture || isBeforeSignup) return;
      onSelectDate(day);
    };

    return (
      <TouchableOpacity
        key={dateStr}
        accessibilityRole="button"
        accessibilityLabel={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        accessibilityValue={{ text: status.text }}
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
export default function HistoryScreen({ calmeraPreview = false, calmeraPreviewState = "ready" } = {}) {
  return calmeraPreview ? <HistoryPreview state={calmeraPreviewState} /> : <HistoryConnected />;
}

function HistoryConnected() {
  const tabBarHeight = useBottomTabBarHeight();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const data = useNutritionData(selectedDate, true);
  return <HistoryView selectedDate={selectedDate} setSelectedDate={setSelectedDate} data={data}
    floatingBarInset={Platform.OS === "ios" ? tabBarHeight : 0} />;
}

function HistoryPreview({ state }) {
  return ["cold-loading", "profile-error", "history-error"].includes(state)
    ? <HistoryRecoveryPreview mode={state} /> : <HistoryReadyPreview />;
}

function HistoryReadyPreview() {
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

const previewProfile = { createdAtLocalDate: "2026-09-01", calorieGoal: 2000,
  proteinGoal: 150, carbsGoal: 200, fatGoal: 50 };
const previewHistory = { "2026-10-19": {
  foodEntries: [
    { id: "ui-history-banana", foodName: "Banana", mealType: "Breakfast", localTime: "09:00:00", calories: 105, protein: 1, carbs: 27, fat: 0 },
    { id: "ui-history-toast", foodName: "Avocado toast", mealType: "Lunch", localTime: "12:00:00", calories: 280, protein: 8, carbs: 32, fat: 14 },
  ],
  dailyTotals: { calories: 385, protein: 9, carbs: 59, fat: 14 },
  goals: { calorieGoal: 2000, proteinGoal: 150, carbsGoal: 200, fatGoal: 50 },
} };

function HistoryRecoveryPreview({ mode }) {
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 9, 19));
  const fixture = useMemo(() => {
    // This component never calls useNutritionData, useAuth or the real provider.
    // Its private memory store receives only fixed synthetic token/JSON values.
    const store = createNutritionStore({ ownerKey: "synthetic-history-review" });
    const attempts = { history: 0, profile: 0 };
    const loader = ({ resource, signal }) => {
      const attempt = ++attempts[resource];
      const tokenStall = mode === "cold-loading" && resource === "history" && attempt === 1;
      const fail = attempt === 2 && ((mode === "profile-error" && resource === "profile")
        || (mode === "history-error" && resource === "history"));
      return readNutrition({ url: `https://calmera.invalid/nutrition/${resource}`, signal,
        timeoutMs: tokenStall ? 4000 : 20000, isActive: () => store.isActive(),
        getToken: tokenStall ? () => new Promise(() => {}) : async () => "synthetic-history-token",
        fetchImpl: async () => {
          if (fail) return { ok: false, status: 503 };
          // Explicit retries remain pending long enough to inspect feedback.
          // The bounded reader owns cancellation even if a fake ignores abort.
          if (attempt > 1) await new Promise(resolve => setTimeout(resolve, 1000));
          return { ok: true, status: 200, json: async () => resource === "profile" ? previewProfile : previewHistory };
        },
      });
    };
    return { store, loader };
  }, [mode]);
  const { store, loader } = fixture;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    let active = true;
    store.retain();
    (async () => {
      await Promise.all([store.loadProfile(loader), store.loadHistory(loader)]);
      if (!active) return;
      if (mode === "profile-error") await store.loadProfile(loader, { force: true });
      else if (mode === "history-error") await store.loadHistory(loader, { force: true });
    })().catch(() => {});
    return () => { active = false; store.release(); };
  }, [store, loader, mode]);
  const presentation = nutritionViewState(snapshot, getLocalDateString(selectedDate), true);
  const refresh = useCallback(() => Promise.all([
    store.loadHistory(loader, { force: true }), store.loadProfile(loader, { force: true }),
  ]), [store, loader]);
  const refreshProfile = useCallback(() => store.loadProfile(loader, { force: true }), [store, loader]);
  const retryError = useCallback(() => retryNutritionError(
    { error: presentation.error, profileError: presentation.profileError }, { refresh, refreshProfile }),
  [presentation.error, presentation.profileError, refresh, refreshProfile]);
  const profile = snapshot.profile || {};
  const stats = store.getDiagnostics();
  const data = { ...presentation, dataByDate: snapshot.days, profile: snapshot.profile,
    goals: { calorieGoal: profile.calorieGoal, proteinGoal: profile.proteinGoal,
      carbsGoal: profile.carbsGoal, fatGoal: profile.fatGoal },
    refresh, retryError, deleteEntry: async () => previewNote(),
    historyPending: Boolean(snapshot.pending.history), profilePending: Boolean(snapshot.pending.profile),
    previewDiagnostics: { history: stats.historyRequests, profile: stats.profileRequests,
      historyPending: snapshot.pending.history ? 1 : 0, profilePending: snapshot.pending.profile ? 1 : 0 },
  };
  return <HistoryView selectedDate={selectedDate} setSelectedDate={setSelectedDate} data={data} preview />;
}

function HistoryView({ selectedDate, setSelectedDate, data, floatingBarInset = 0, preview = false }) {
  const { fontScale } = useWindowDimensions();
  const { dataByDate, profile, goals, error, profileError, refresh, retryError, deleteEntry, historyLoading,
    historyPending = false, profilePending = false } = data;
  const [refreshing, setRefreshing] = useState(false);
  const [retryContext, setRetryContext] = useState(null);
  const retryRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const retrying = retryContext !== null;
  const retryKind = retryContext || (error ? "history" : "profile");
  const retryPending = retryKind === "history" ? historyPending : profilePending;
  const onRetry = useCallback(async () => {
    if (retryRef.current || !retryError || !(error || profileError) || (error ? historyPending : profilePending)) return;
    retryRef.current = true;
    setRetryContext(error ? "history" : "profile");
    try { await retryError(); } catch {} finally {
      retryRef.current = false;
      if (mounted.current) setRetryContext(null);
    }
  }, [retryError, error, profileError, historyPending, profilePending]);
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
          <FormCard variant="grouped" style={styles.calendarCard}>
          {/* Month navigation + label */}
          <View style={styles.dateNav}>
            <ArrowButton
              direction="left"
              onPress={() => changeMonth(-1)}
              disabled={isSignupMonthView}
            />
            <Text accessibilityRole="header" style={styles.dateText}>{monthLabel}</Text>
            <ArrowButton
              direction="right"
              onPress={() => changeMonth(1)}
              disabled={isCurrentMonth}
            />
          </View>

          {historyLoading && !retrying && <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 12 }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.emptyText}>Getting your meals…</Text>
          </View>}
          {(error || profileError || retrying) && <Pressable onPress={onRetry} accessibilityRole="button"
            accessibilityLabel={retrying ? "Retrying nutrition data" : error ? "Meals couldn’t refresh. Retry meals." : "Your nutrition goals couldn’t refresh. Retry nutrition goals."}
            accessibilityState={{ disabled: retrying || retryPending, busy: retrying || retryPending }}
            disabled={retrying || retryPending} style={styles.retryRow}>
            {retrying && <ActivityIndicator size="small" color={COLORS.primary} accessible={false} />}
            <Text style={styles.retryText} accessibilityLiveRegion="polite">{retrying ? "Retrying…"
              : <>{error ? "Meals couldn’t refresh." : "Your nutrition goals couldn’t refresh."} <Text style={styles.retryAction}>Retry</Text></>}</Text>
          </Pressable>}
          {/* Week calendar row */}
          <MonthCalendar
            monthDate={selectedDate}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d)}
            dataByDate={dataByDate}
            calorieGoal={calorieGoal}
            signUpDate={signUpDate}
            historyAvailable={!historyLoading && !error && !(retrying && retryKind === "history")}
          />
          </FormCard>
          {data.previewDiagnostics && <Text style={styles.previewDiagnostics}>
            Synthetic requests · history {data.previewDiagnostics.history} · profile {data.previewDiagnostics.profile}
            {"\n"}Pending · history {data.previewDiagnostics.historyPending} · profile {data.previewDiagnostics.profilePending}
          </Text>}
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
  calendarCard: { padding: 12, gap: 0, marginBottom: 12 },
  retryRow: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8 },
  retryText: { color: COLORS.textLight, textAlign: "center", flexShrink: 1 },
  retryAction: { color: COLORS.primary },
  previewDiagnostics: { fontSize: 12, color: COLORS.textLight, marginBottom: 8 },
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
