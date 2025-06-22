import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";

/**
 * React hook for fetching and managing a user's food entries and nutrition summary
 * for a specific date (defaults to today).
 *
 * Returns the entries list, daily summary, loading state, and helpers for
 * refreshing data & deleting an entry.
 */
export const useDailyNutrition = (userId, date = new Date()) => {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({
    dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    mealTotals: {},
  });
  const [isLoading, setIsLoading] = useState(true);

  // Format in local timezone
  // React-Native (Hermes/JSC) may default to UTC when calling toLocaleDateString without an explicit
  // timeZone, which can cause an off-by-one-day error when the device is **behind** UTC.
  // We therefore build the YYYY-MM-DD string ourselves based on the *local* clock.
  const getLocalDateString = (d) => {
    // Clone the date and convert to local YYYY-MM-DD (zero-pad month & day)
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
  };

  const formattedDate = getLocalDateString(date);

  const fetchSummaryForDate = useCallback(async () => {
    try {
      const response = await fetch(
        `${FOOD_ENTRIES_API_URL}/summary-by-date/${formattedDate}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch nutrition summary of the day");
      }
      const data = await response.json();
      console.log("data", data);
      setSummary(data);
      setEntries(data.foodEntries || []);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message);
    }
  }, [formattedDate]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      await fetchSummaryForDate();
    } finally {
      setIsLoading(false);
    }
  }, [userId, fetchSummaryForDate]);

  const deleteEntry = async (id) => {
    try {
      const response = await fetch(`${FOOD_ENTRIES_API_URL}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete entry");

      // Refresh data after successful deletion
      loadData();
    } catch (error) {
      console.error("Error deleting entry:", error);
      Alert.alert("Error", error.message);
    }
  };

  return {
    entries,
    summary,
    isLoading,
    loadData,
    deleteEntry,
  };
};
