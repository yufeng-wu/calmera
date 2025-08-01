import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
  Alert,
  Pressable,
} from "react-native";
// Removed reanimated for meal group container to avoid date-switch animations
import { useState, useEffect, useCallback, useRef } from "react";
import { useUser, useAuth } from "@clerk/clerk-expo";
import AnimatedRe, { Layout as ReLayout } from "react-native-reanimated";

import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem } from "@/components/FoodEntryItem";
import PageLoader from "@/components/PageLoader";
import { COLORS } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { FOOD_ENTRIES_API_URL, USERS_API_URL } from "@/constants/api";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ArrowButton = ({ direction, disabled, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    hitSlop={8}
    style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.5 : 1 }]}
  >
    <Ionicons
      name={direction === "left" ? "chevron-back" : "chevron-forward"}
      size={22}
      color={disabled ? COLORS.border : COLORS.text}
    />
  </Pressable>
);

const AnimatedMealGroupContainer = AnimatedRe.createAnimatedComponent(View);
const AnimatedContent = AnimatedRe.createAnimatedComponent(View);

const MealGroup = ({ title, entries, onDelete, shouldAnimate }) => {
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

const getStartOfWeek = (date) => {
  const start = new Date(date);
  const day = start.getDay(); // 0 (Sun) - 6 (Sat)
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
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

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
        style={[styles.dayContainer, isSelected && styles.daySelected]}
        disabled={isFuture || isBeforeSignup}
        onPress={onPress}
      >
        <Text
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
        {weekdayLabels.map((label) => (
          <Text key={label} style={styles.weekHeaderText}>
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

export default function HistoryScreen() {
  const { user } = useUser();
  const [signUpDate, setSignUpDate] = useState(null);
  const { getToken } = useAuth();
  const {
    shouldRefresh,
    setShouldRefresh,
    shouldRefreshGoals,
    setShouldRefreshGoals,
  } = useRefreshSignal();

  const [selectedDate, setSelectedDate] = useState(new Date());
  // Temporarily suppress group layout animation immediately after a date switch
  const [suppressGroupAnim, setSuppressGroupAnim] = useState(false);

  useEffect(() => {
    // Suppress for the first frame after changing the date
    setSuppressGroupAnim(true);
    const id = setTimeout(() => setSuppressGroupAnim(false), 50); // ~1 frame at 60fps
    return () => clearTimeout(id);
  }, [selectedDate]);
  const [dataByDate, setDataByDate] = useState({}); // Cache per date
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState({});
  const [calorieGoal, setCalorieGoal] = useState(null);

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

  // ---- Helpers --------------------------------------------------
  const fetchUserGoals = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getToken();
      if (!token) {
        // Clerk session not ready yet; try again on next focus/render without logging error
        return;
      }
      const response = await fetch(`${USERS_API_URL}/get-user`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch user goals");
      const data = await response.json();
      // Set signup date from backend data
      if (data.createdAtLocalDate) {
        // Ensure we interpret the date in local timezone at midnight to avoid UTC shift
        const dateOnlyStr = data.createdAtLocalDate.split("T")[0]; // e.g. '2025-07-15'
        setSignUpDate(new Date(`${dateOnlyStr}T00:00:00`));
      }
      const goalObj = {
        calorieGoal: data.calorieGoal ?? data.calorie_goal ?? data.calories,
        proteinGoal: data.proteinGoal ?? data.protein_goal ?? data.protein,
        carbsGoal: data.carbsGoal ?? data.carbs_goal ?? data.carbs,
        fatGoal: data.fatGoal ?? data.fat_goal ?? data.fat,
      };
      setGoals(goalObj);
      setCalorieGoal(goalObj.calorieGoal);
    } catch (error) {
      console.error("Error fetching user goals", error);
    }
  }, [getToken, user]);

  const fetchAllSummaries = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`${FOOD_ENTRIES_API_URL}/summaries`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch summaries");
      const allData = await response.json();
      const transformed = {};
      Object.keys(allData).forEach((dateKey) => {
        const summaryObj = allData[dateKey];
        transformed[dateKey] = {
          entries: summaryObj.foodEntries || [],
          summary: summaryObj,
        };
      });
      setDataByDate(transformed);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // Fetch user goals (once)
  useEffect(() => {
    if (!user || Object.keys(goals).length > 0) return;
    fetchUserGoals();
  }, [user, goals, fetchUserGoals]);

  // Fetch all summaries once when component mounts
  useEffect(() => {
    if (Object.keys(dataByDate).length === 0 && user) {
      fetchAllSummaries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Refresh goals when goal refresh signal is triggered
  useEffect(() => {
    if (shouldRefreshGoals) {
      // 1) Refresh the latest goals (affects dot coloring going forward)
      fetchUserGoals();

      // 2) Refresh only TODAY's summary (the only one affected by a new goal)
      const today = new Date();
      fetchDailyData(today);

      // 3) Clear the flag so it doesn't loop
      setShouldRefreshGoals(false);
    }
    // Intentionally exclude fetchAllSummaries here for performance
  }, [
    shouldRefreshGoals,
    fetchUserGoals,
    fetchDailyData,
    setShouldRefreshGoals,
  ]);

  // Helper to fetch daily summary & entries
  const fetchDailyData = useCallback(
    async (date) => {
      setLoading(true);
      const dateStr = getLocalDateString(date);
      try {
        const token = await getToken();
        const response = await fetch(
          `${FOOD_ENTRIES_API_URL}/summary-by-date/${dateStr}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!response.ok) throw new Error("Failed to fetch daily summary");
        const data = await response.json();

        setDataByDate((prev) => ({
          ...prev,
          [dateStr]: {
            entries: data.foodEntries || [],
            summary: data,
          },
        }));
      } catch (error) {
        console.error(error);
        Alert.alert("Error", error.message);
      } finally {
        setLoading(false);
      }
    },
    [getToken]
  );

  // Refresh data when other screens (or this screen) signal an update
  useEffect(() => {
    if (shouldRefresh) {
      // Refresh entire summaries cache so calendar dots stay accurate
      fetchAllSummaries();
      // Also refresh the currently visible day to guarantee latest values
      fetchDailyData(selectedDate);
      // Reset the flag so other consumers don’t re-trigger endlessly
      setShouldRefresh(false);
    }
  }, [
    shouldRefresh,
    selectedDate,
    fetchAllSummaries,
    fetchDailyData,
    setShouldRefresh,
  ]);

  const handleDelete = async (id) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this food entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const entryToDelete = entries.find((e) => e.id === id);
            if (!entryToDelete) return;

            // Animate row removal
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut
            );

            // Optimistically update local cache
            const dateKey = getLocalDateString(selectedDate);
            setDataByDate((prev) => {
              const dayData = prev[dateKey];
              if (!dayData) return prev;

              const subtract = (totals = {}) => ({
                calories:
                  Number(totals.calories || 0) -
                  Number(entryToDelete.calories || 0),
                protein:
                  Number(totals.protein || 0) -
                  Number(entryToDelete.protein || 0),
                carbs:
                  Number(totals.carbs || 0) - Number(entryToDelete.carbs || 0),
                fat: Number(totals.fat || 0) - Number(entryToDelete.fat || 0),
              });

              const updatedEntries = dayData.entries.filter((e) => e.id !== id);

              const mealType =
                entryToDelete.mealType || entryToDelete.meal_type;
              let updatedMealTotals = dayData.summary.mealTotals;
              if (
                mealType &&
                updatedMealTotals &&
                updatedMealTotals[mealType]
              ) {
                updatedMealTotals = {
                  ...updatedMealTotals,
                  [mealType]: subtract(updatedMealTotals[mealType]),
                };
              }

              const updatedSummary = {
                ...dayData.summary,
                dailyTotals: subtract(dayData.summary.dailyTotals || {}),
                mealTotals: updatedMealTotals,
              };

              return {
                ...prev,
                [dateKey]: {
                  ...dayData,
                  entries: updatedEntries,
                  summary: updatedSummary,
                },
              };
            });

            // Make API request; rollback on failure
            try {
              const token = await getToken();
              const response = await fetch(`${FOOD_ENTRIES_API_URL}/${id}`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              if (!response.ok) throw new Error("Failed to delete entry");

              // Optionally notify other screens – skipped to avoid self-reload
            } catch (error) {
              console.error(error);
              Alert.alert("Error", error.message);
              // Roll back by refetching latest data
              fetchDailyData(selectedDate);
            }
          },
        },
      ]
    );
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

  if (loading) {
    return <PageLoader />;
  }

  return (
    <View style={styles.container}>
      {/* Date navigation & summary */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.headerContainer}>
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

          {/* Week calendar row */}
          <MonthCalendar
            monthDate={selectedDate}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d)}
            dataByDate={dataByDate}
            calorieGoal={calorieGoal}
            signUpDate={signUpDate}
          />
          {entries.length > 0 && (
            <NutritionSummaryCard
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
                shouldAnimate={!suppressGroupAnim}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No entries for this date.</Text>
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
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  navButton: {
    padding: 4,
  },
  dateText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginHorizontal: 8,
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
    paddingVertical: 6,
    borderRadius: 8,
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
