import { useUser } from "@clerk/clerk-expo";
import {
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useDailyNutrition } from "../../../hooks/useDailyNutrition";
import PageLoader from "@/components/PageLoader";
import { styles } from "@/assets/styles/home.styles";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem } from "@/components/FoodEntryItem";
import NoRecordYet from "@/components/NoRecordYet";
import { USERS_API_URL } from "@/constants/api";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { COLORS } from "@/constants/colors";

const MealGroup = ({ title, entries, onDelete }) => {
  if (entries.length === 0) return null;

  return (
    <View style={styles.mealGroupContainer}>
      <Text style={styles.mealGroupTitle}> {title}</Text>
      {entries.map((item) => (
        <FoodEntryItem key={item.id} item={item} onDelete={onDelete} />
      ))}
    </View>
  );
};

export default function SummaryScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { shouldRefresh, setShouldRefresh } = useRefreshSignal();
  const [goals, setGoals] = useState({});
  const [fabExpanded, setFabExpanded] = useState(false);

  const FAB_BOTTOM = 40;
  const FAB_HEIGHT = 56;
  const OPTION_HEIGHT = 56;
  const OPTION_SPACING = 12;

  // Derived bottom positions
  const manualBottom = FAB_BOTTOM + FAB_HEIGHT + OPTION_SPACING;
  const cameraBottom = manualBottom + OPTION_HEIGHT + OPTION_SPACING;

  // user.id comes from Clerk
  const { entries, summary, isLoading, loadData, deleteEntry } =
    useDailyNutrition(user.id);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDelete = (id) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this food entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteEntry(id),
        },
      ]
    );
  };

  // Fetch latest macro goals
  const fetchUserGoals = useCallback(async () => {
    try {
      const response = await fetch(`${USERS_API_URL}/get-user`);
      if (!response.ok) throw new Error("Failed to fetch user goals");

      const data = await response.json();

      setGoals({
        calorie_goal: data.calorie_goal,
        protein_goal: data.protein_goal,
        carbs_goal: data.carbs_goal,
        fat_goal: data.fat_goal,
      });
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchUserGoals();
  }, [fetchUserGoals]);

  // Refetch goals when screen regains focus
  useFocusEffect(
    useCallback(() => {
      fetchUserGoals();
    }, [fetchUserGoals])
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh list when edit screen signals update
  useEffect(() => {
    if (shouldRefresh) {
      loadData();
      setShouldRefresh(false);
    }
  }, [shouldRefresh, loadData, setShouldRefresh]);

  useEffect(() => {
    // Enable LayoutAnimation on Android
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const handleFabToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFabExpanded((prev) => !prev);
  };

  const handleManualAdd = () => {
    setFabExpanded(false);
    router.push("/create");
  };

  const handleCameraAdd = () => {
    setFabExpanded(false);
    router.push("/camera"); // TODO: implement camera screen
  };

  if (isLoading && !refreshing) {
    return <PageLoader />;
  }

  const groupedEntries = entries.reduce((acc, entry) => {
    const meal = entry.meal_type;
    if (!acc[meal]) {
      acc[meal] = [];
    }
    acc[meal].push(entry);
    return acc;
  }, {});

  const mealOrder = ["Breakfast", "Lunch", "Dinner", "Snack"];

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image
                source={require("../../../assets/images/logo.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.usernameText}>
                  {user?.emailAddresses[0].emailAddress}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.dateText}> {formattedDate}</Text>
          <NutritionSummaryCard summary={summary} goals={goals} />
        </View>

        <View style={styles.transactionsContainer}>
          {entries.length > 0 ? (
            mealOrder.map((meal) => (
              <MealGroup
                key={meal}
                title={meal}
                entries={groupedEntries[meal] || []}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <NoRecordYet />
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button Options */}
      {fabExpanded && (
        <>
          <TouchableOpacity
            style={[
              styles.fabOption,
              styles.fabOptionWide,
              { bottom: cameraBottom },
            ]}
            onPress={handleCameraAdd}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={16} color={COLORS.white} />
            <Text style={styles.fabText}>Calmera AI</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fabOption, { bottom: manualBottom }]}
            onPress={handleManualAdd}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.white} />
            <Text style={styles.fabText}>Manual</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Main Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, fabExpanded && styles.fabExpanded]}
        onPress={handleFabToggle}
        activeOpacity={1}
      >
        {fabExpanded ? (
          <Ionicons name="close" size={16} color={COLORS.white} />
        ) : (
          <>
            <Ionicons name="add" size={16} color={COLORS.white} />
            <Text style={styles.fabText}>Add</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
