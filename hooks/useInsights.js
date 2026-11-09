import { useCallback, useMemo } from "react";
import { useNutritionData } from "@/hooks/useNutritionData";
import { hasAnyLog, periodStats } from "@/lib/insights/stats.mjs";

const SPANS = { week: 7, month: 30, year: 365 };

const NONE = {};
// Worked-out periods, kept for each copy of the data and goals. The page and a card's
// detail page share them, and swiping back to a period doesn't redo it.
const computed = new WeakMap();
function statsFor(dataByDate, goals, dateKey, period, joined) {
  const data = dataByDate ?? NONE, goalSet = goals ?? NONE;
  if (!computed.has(data)) computed.set(data, new WeakMap());
  const byGoals = computed.get(data);
  if (!byGoals.has(goalSet)) byGoals.set(goalSet, new Map());
  const byPeriod = byGoals.get(goalSet);
  const key = `${period}:${dateKey}:${joined ?? ""}`;
  if (!byPeriod.has(key)) byPeriod.set(key, periodStats(data, { span: SPANS[period], today: new Date(`${dateKey}T12:00:00`), goals: goalSet, joined }));
  return byPeriod.get(key);
}

// Turns logged history into the numbers for the week, month and year views. Only the
// view on screen is worked out, since a year of meals isn't free on every change.
export function useInsights(period) {
  const { dataByDate, goals, profile, dateKey, snapshot, historyPending, error, retryError } = useNutritionData(new Date(), true);
  const joined = profile?.createdAtLocalDate ?? null;
  const stats = useMemo(() => statsFor(dataByDate, goals, dateKey, period, joined), [dataByDate, dateKey, goals, period, joined]);
  // The page shows the neighbouring period beside this one while a swipe is in progress.
  const statsOf = useCallback((other) => statsFor(dataByDate, goals, dateKey, other, joined), [dataByDate, dateKey, goals, joined]);
  const empty = useMemo(() => !hasAnyLog(dataByDate), [dataByDate]);
  return { stats, statsOf, goals, empty, loaded: Boolean(snapshot.historyLoaded), historyPending, error, retryError };
}
