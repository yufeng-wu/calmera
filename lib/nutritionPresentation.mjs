import { EMPTY_DAY } from "./nutritionStore.mjs";

// Presentation only: a missing profile must not hide successfully loaded meals.
export function nutritionViewState(snapshot, dateKey, history = false) {
  const day = snapshot.days[dateKey] || (snapshot.historyLoaded ? EMPTY_DAY : undefined);
  const error = snapshot.errors[history ? "history" : `day:${dateKey}`] || (!day ? snapshot.errors.history : null);
  return {
    day, error, profileError: snapshot.errors.profile || null,
    loading: !day && !error, historyLoading: !snapshot.historyLoaded && !error,
  };
}

// Share the meaning of the calendar dot with VoiceOver without changing layout.
export function calendarDayStatus(day, currentGoal, { historyAvailable = true } = {}) {
  if (!day && !historyAvailable) return { text: "Meal status unavailable", goalStatus: null };
  const count = day?.entries?.length || 0;
  if (!count) return { text: "No food entries recorded", goalStatus: null };
  const recorded = `${count} food ${count === 1 ? "entry" : "entries"} recorded`;
  const goal = day.summary?.goals?.calorieGoal ?? currentGoal;
  const consumed = Number(day.summary?.calories ?? day.summary?.dailyTotals?.calories ?? 0);
  if (goal == null || !Number.isFinite(Number(goal)) || !Number.isFinite(consumed)) {
    return { text: recorded, goalStatus: null };
  }
  const above = consumed > Number(goal);
  return { text: `${recorded}; ${above ? "above" : "within"} calorie goal`, goalStatus: above ? "above" : "within" };
}

// A profile-only failure retries just that request; loaded meal data stays put.
export async function retryNutritionError({ error, profileError }, { refresh, refreshProfile }) {
  if (error) return refresh();
  if (profileError) return refreshProfile();
}
