import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { styles } from "@/assets/styles/home.styles";
import DayDrop from "@/components/DayDrop";
import { FoodEntryItem } from "@/components/FoodEntryItem";
import FoodwrapWordmark from "@/components/FoodwrapWordmark";
import NoRecordYet from "@/components/NoRecordYet";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { localDateKey, normalizeDay } from "@/lib/nutritionStore.mjs";

const previewNote = () => Alert.alert("UI preview", "This example stays local. No meal records are read or changed.");
const MEALS = [
  ["Breakfast", "Banana and oats", 340, 9, 62, 6, "08:30:00"],
  ["Lunch", "Chicken rice bowl", 690, 42, 74, 18, "12:30:00"],
  ["Dinner", "Salmon and greens", 780, 48, 30, 42, "19:00:00"],
  ["Snack", "Trail mix", 240, 7, 20, 16, "16:00:00"],
];
const CURRENT_GOALS = { calorieGoal: 1800, proteinGoal: 140, carbsGoal: 180, fatGoal: 60 };
const EARLIER_GOALS = { calorieGoal: 2200, proteinGoal: 150, carbsGoal: 240, fatGoal: 70 };

// Synthetic meals only. The goal changes 30 days ago, so past days keep their own goal.
function syntheticDays(today) {
  const days = {};
  for (let ago = 0; ago < 70; ago++) {
    if (ago > 0 && ago % 9 === 4) continue;
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ago);
    const meals = MEALS.slice(0, ago === 0 ? 2 : ago % 3 === 0 ? 4 : 3);
    const foodEntries = meals.map(([mealType, foodName, calories, protein, carbs, fat, localTime], index) => ({
      id: `ui-today-${ago}-${index}`, mealType, foodName, calories, protein, carbs, fat, localTime }));
    const dailyTotals = Object.fromEntries(["calories", "protein", "carbs", "fat"].map((key) =>
      [key, foodEntries.reduce((sum, entry) => sum + entry[key], 0)]));
    days[localDateKey(date)] = normalizeDay({ foodEntries, dailyTotals, ...dailyTotals,
      goals: ago < 30 ? CURRENT_GOALS : EARLIER_GOALS });
  }
  return days;
}

export default function TodayCalendarPreview({ calmeraPreviewState = "ready" }) {
  const [pickedDate, setPickedDate] = useState(null);
  const [failed, setFailed] = useState(calmeraPreviewState === "history-error");
  const [pending, setPending] = useState(false);
  const today = useMemo(() => new Date(), []);
  const signUpDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() - 2, 1), [today]);
  const loading = calmeraPreviewState === "cold-loading";
  const dataByDate = useMemo(() => loading || failed ? {} : syntheticDays(today), [loading, failed, today]);
  const selectedDate = pickedDate ?? today;
  const isToday = localDateKey(selectedDate) === localDateKey(today);
  const day = dataByDate[localDateKey(selectedDate)];
  const groups = ["Breakfast", "Lunch", "Dinner", "Snack"].map((title) =>
    [title, (day?.entries || []).filter((entry) => entry.mealType === title)]);
  const retry = () => {
    setPending(true);
    setTimeout(() => { setPending(false); setFailed(false); }, 1000);
  };
  return <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
    <View style={[styles.headerContainer, { paddingTop: 12 }]}>
      <FoodwrapWordmark style={{ marginBottom: 16 }} />
      <DayDrop selectedDate={selectedDate} isToday={isToday} onSelectDate={setPickedDate} onToday={() => setPickedDate(null)}
        dataByDate={dataByDate} calorieGoal={CURRENT_GOALS.calorieGoal} signUpDate={signUpDate} historyLoading={loading}
        historyError={failed ? "Synthetic failure" : null} historyPending={pending} onRetryHistory={retry} />
    </View>
    <View style={styles.headerContainer}>
      {day && <NutritionSummaryCard summary={day.summary} goals={day.summary.goals} onEditGoals={previewNote} />}
    </View>
    <View key={localDateKey(selectedDate)} style={styles.transactionsContainer}>
      {day?.entries.length ? groups.map(([title, entries]) => entries.length > 0 && <View key={title} style={styles.mealGroupContainer}>
        <Text style={styles.mealGroupTitle}>{title}</Text>
        {entries.map((item) => <FoodEntryItem key={item.id} item={item} onDelete={previewNote} onEdit={previewNote} />)}
      </View>) : <NoRecordYet title="No meals logged" text="Nothing was logged on this day." />}
    </View>
  </ScrollView>;
}
