import { SignedIn, SignedOut, useUser } from "@clerk/clerk-expo";
import { Text, TouchableOpacity, View } from "react-native";
import { SignOutButton } from "@/components/SignOutButton";
import { useEffect, useState } from "react";
import { useDailyNutrition } from "../../hooks/useDailyNutrition";
import PageLoader from "@/components/PageLoader";
import { styles } from "@/assets/styles/home.styles";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { ScrollView, RefreshControl } from "react-native";
import { FoodEntryItem } from "@/components/FoodEntryItem";
import { Alert } from "react-native";
import NoRecordYet from "@/components/NoRecordYet";
import { USERS_API_URL } from "@/constants/api";

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

export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [goals, setGoals] = useState({});

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

  // Fetch user's nutrition goals once when component mounts
  useEffect(() => {
    const fetchUserGoals = async () => {
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
    };

    fetchUserGoals();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={require("../../assets/images/logo.png")}
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
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/create")}
            >
              <Ionicons name="add" size={16} color="white" />
            </TouchableOpacity>
            <SignOutButton />
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
  );
}
