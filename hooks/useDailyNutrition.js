import { useCallback, useState } from "react";
import { Alert, LayoutAnimation, UIManager, Platform } from "react-native";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { useAuth } from "@clerk/clerk-expo";

/**
 * React hook for fetching and managing a user's food entries and nutrition summary
 * for a specific date (defaults to today).
 *
 * Returns the entries list, daily summary, loading state, and helpers for
 * refreshing data & deleting an entry.
 */
export const useDailyNutrition = (userId, date = new Date()) => {
  const { getToken } = useAuth();
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
      const token = await getToken();
      // build URL without tz
      const response = await fetch(
        `${FOOD_ENTRIES_API_URL}/summary-by-date/${formattedDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch nutrition summary of the day");
      }
      const data = await response.json();

      // Sort entries to ensure a deterministic order.
      // We sort by localTime (string HH:MM:SS) ASC then by id ASC.
      // Using string comparison works because the time strings are zero-padded.
      if (data.foodEntries && data.foodEntries.length > 0) {
        data.foodEntries.sort((a, b) => {
          const tA = (a.localTime || a.local_time || "").toString();
          const tB = (b.localTime || b.local_time || "").toString();

          if (tA !== tB) {
            return tA.localeCompare(tB); // earlier time first
          }

          // Tie-breaker: lower id (older entry) first for stability
          return a.id - b.id;
        });
      }

      // Smoothly animate any list changes (insertion/deletion) & summary resize
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setSummary(data);
      setEntries(data.foodEntries || []);
      return data; // Return data for loadData to use
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message);
      throw error; // Re-throw to be caught by loadData
    }
  }, [formattedDate]);

  const loadData = useCallback(
    async (silent = false) => {
      if (!userId) return;
      if (!silent) setIsLoading(true);
      try {
        const data = await fetchSummaryForDate(); // modify fetchSummaryForDate to return data
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [userId, fetchSummaryForDate]
  );

  const { setShouldRefresh } = useRefreshSignal();

  // Enable LayoutAnimation on Android once during module load
  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const deleteEntry = async (id) => {
    // Locate the entry to delete so we can adjust state optimistically
    const entryToDelete = entries.find((e) => e.id === id);
    if (!entryToDelete) return;

    // 1) Optimistic UI update with smooth animation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEntries((prev) => prev.filter((e) => e.id !== id));

    // Update summary totals locally
    setSummary((prev) => {
      const updated = { ...prev };

      const subtractTotals = (totals = {}) => ({
        calories:
          Number(totals.calories || 0) - Number(entryToDelete.calories || 0),
        protein:
          Number(totals.protein || 0) - Number(entryToDelete.protein || 0),
        carbs: Number(totals.carbs || 0) - Number(entryToDelete.carbs || 0),
        fat: Number(totals.fat || 0) - Number(entryToDelete.fat || 0),
      });

      // Daily totals
      if (updated.dailyTotals) {
        updated.dailyTotals = subtractTotals(updated.dailyTotals);
      }

      // Meal-level totals
      const mealType = entryToDelete.mealType || entryToDelete.meal_type;
      if (mealType && updated.mealTotals && updated.mealTotals[mealType]) {
        updated.mealTotals = {
          ...updated.mealTotals,
          [mealType]: subtractTotals(updated.mealTotals[mealType]),
        };
      }

      return updated;
    });

    // 2) Call API in background; rollback on failure
    try {
      const token = await getToken();
      const response = await fetch(`${FOOD_ENTRIES_API_URL}/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete entry");

      // Notify other screens (e.g., History) to refresh silently
      setShouldRefresh(true);
    } catch (error) {
      console.error("Error deleting entry:", error);
      Alert.alert("Error", error.message);
      // Re-sync by refetching data if optimistic update failed (showing loader)
      loadData();
    }
  };

  const addEntries = useCallback((newEntries) => {
    if (!newEntries || newEntries.length === 0) return;

    // 1) UI update with smooth animation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEntries((prev) => [...prev, ...newEntries]);

    // 2) Update summary totals locally
    setSummary((prev) => {
      const updated = JSON.parse(JSON.stringify(prev)); // deep copy

      // Ensure totals objects exist before updating
      if (!updated.dailyTotals) {
        updated.dailyTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
      if (!updated.mealTotals) {
        updated.mealTotals = {};
      }

      newEntries.forEach((entry) => {
        const { calories, protein, carbs, fat, mealType } = entry;
        const numCalories = Number(calories) || 0;
        const numProtein = Number(protein) || 0;
        const numCarbs = Number(carbs) || 0;
        const numFat = Number(fat) || 0;

        // Add to daily totals
        updated.dailyTotals.calories += numCalories;
        updated.dailyTotals.protein += numProtein;
        updated.dailyTotals.carbs += numCarbs;
        updated.dailyTotals.fat += numFat;

        // Add to per-meal totals, initializing if mealType is new
        if (mealType) {
          if (!updated.mealTotals[mealType]) {
            updated.mealTotals[mealType] = {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
            };
          }
          updated.mealTotals[mealType].calories += numCalories;
          updated.mealTotals[mealType].protein += numProtein;
          updated.mealTotals[mealType].carbs += numCarbs;
          updated.mealTotals[mealType].fat += numFat;
        }
      });

      return updated;
    });
  }, []);

  return {
    entries,
    summary,
    isLoading,
    loadData,
    deleteEntry,
    addEntries,
  };
};
