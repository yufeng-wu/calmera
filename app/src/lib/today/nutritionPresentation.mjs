import { EMPTY_DAY } from "../store/nutritionStore.mjs";

// Presentation only: a missing profile must not hide successfully loaded meals.
// A failed refresh stays silent while its data is on screen; only a blank page needs a retry.
export function nutritionViewState(snapshot, dateKey, history = false) {
  const day = snapshot.days[dateKey] || (snapshot.historyLoaded ? EMPTY_DAY : undefined);
  const missing = history ? !snapshot.historyLoaded : !day;
  const error = missing ? (!history && snapshot.errors[`day:${dateKey}`]) || snapshot.errors.history || null : null;
  return {
    day, error, profileError: snapshot.profile ? null : snapshot.errors.profile || null,
    loading: !day && !error, historyLoading: !snapshot.historyLoaded && !error,
  };
}

// One number per calendar day, so the orange picks a different line each day but holds it all day.
export const daySeed = (date = new Date()) => date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate();
const pick = (pool, seed, offset = 0) => pool[(Math.abs(Math.trunc(seed)) + offset) % pool.length];

const GREETINGS = {
  firstDay: ["Hi! What's your first bite?", "Welcome! What's the first bite?"],
  late: ["Late-night bite?", "Still up? What's cooking?", "Midnight snack?"],
  morning: ["Morning! What's for breakfast?", "Good morning! Breakfast?", "Rise and dine. What's first?", "Morning! What's on the plate?"],
  midday: ["Lunchtime! What looks good?", "What's for lunch?", "Lunch o'clock. What is it?", "Midday! What are we having?"],
  afternoon: ["Snack o'clock?", "Afternoon! Anything to log?", "A little something?", "Snack time?"],
  evening: ["What's for dinner?", "Dinner plans?", "Evening! What's cooking?", "What's on the table tonight?"],
};
const HOW = ["Snap it, say it, or type it.", "A photo, a few words, or a quick note.", "Snap, speak, or type."];

// What the empty Today says, by the hour; the first day gets a hello instead. The seed varies it day to day.
export function emptyTodayGreeting(hour, firstDay = false, seed = 0) {
  const text = pick(HOW, seed);
  const slot = firstDay ? "firstDay" : hour < 5 || hour >= 22 ? "late" : hour < 11 ? "morning" : hour < 14 ? "midday" : hour < 17 ? "afternoon" : "evening";
  return { title: pick(GREETINGS[slot], seed), text };
}

// All the orange ever says when tapped: one of these, at random, never the same one twice in a row.
export const BUDDY_FACES = ["(^_^)", "(^o^)", "\\(^o^)/", "(^_^)v", "(^_~)", "(^_^)b", "(≧▽≦)", "(◕‿◕)", "ヽ(•‿•)ノ", "(*^▽^*)", "(｡^‿^｡)", ":D"];
export function buddyFace(previous, random = Math.random) {
  const choices = BUDDY_FACES.filter((face) => face !== previous);
  return choices[Math.floor(random() * choices.length)];
}

// Happy once dinner is in or the goal is (nearly) reached, and still happy when over: never scolding.
export function buddyMood({ calories = 0, goal, loggedMeals = [] }) {
  const target = Number(goal);
  const share = Number.isFinite(target) && target > 0 ? calories / target : 0;
  return share >= 0.9 || loggedMeals.includes("Dinner") ? "happy" : "awake";
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
  const eaten = Math.round(consumed).toLocaleString("en-US");
  const target = Math.round(Number(goal)).toLocaleString("en-US");
  const overBy = Math.round(consumed - Number(goal)).toLocaleString("en-US");
  return { text: `${recorded}; ${eaten} of ${target} calories, ${above ? `${overBy} over goal` : "within goal"}`, goalStatus: above ? "above" : "within" };
}

// A profile-only failure retries just that request; loaded meal data stays put.
export async function retryNutritionError({ error, profileError }, { refresh, refreshProfile }) {
  if (error) return refresh();
  if (profileError) return refreshProfile();
}
