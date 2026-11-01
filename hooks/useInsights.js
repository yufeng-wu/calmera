import { useMemo } from "react";
import { useNutritionData } from "@/hooks/useNutritionData";
import { hasAnyLog, periodStats } from "@/lib/insights/stats.mjs";

const SPANS = { week: 7, month: 30, year: 365 };

// Turns logged history into the numbers for the week, month and year views. Only the
// view on screen is worked out, since a year of meals isn't free on every change.
export function useInsights(period) {
  const { dataByDate, goals, dateKey, snapshot, historyPending, error, refreshFailed, retryError, refresh } = useNutritionData(new Date(), true);
  const stats = useMemo(() => periodStats(dataByDate, { span: SPANS[period], today: new Date(`${dateKey}T12:00:00`), goals }),
    [dataByDate, dateKey, goals, period]);
  const empty = useMemo(() => !hasAnyLog(dataByDate), [dataByDate]);
  return { stats, goals, empty, loaded: Boolean(snapshot.historyLoaded), historyPending, error, refreshFailed, retryError, refresh };
}
