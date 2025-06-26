import { useEffect, useState } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "@/assets/styles/create.styles";
import { COLORS } from "@/constants/colors";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FoodEntryFormCard } from "@/components/FoodEntryFormCard";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function EditFoodEntry() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { setShouldRefresh } = useRefreshSignal();

  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Fetch existing entry data
  useEffect(() => {
    const fetchEntry = async () => {
      console.log("fetching entry", id);
      if (!id) return;
      try {
        const resp = await fetch(`${FOOD_ENTRIES_API_URL}/${id}`);
        if (!resp.ok) throw new Error("Failed to fetch food entry");
        const data = await resp.json();
        setFoodName(data.food_name ?? "");
        setCalories(String(data.calories ?? ""));
        setProtein(String(data.protein ?? ""));
        setCarbs(String(data.carbs ?? ""));
        setFat(String(data.fat ?? ""));
        setMealType(data.meal_type ?? "Breakfast");
      } catch (error) {
        Alert.alert("Error", error.message);
      } finally {
        setIsFetching(false);
      }
    };
    fetchEntry();
  }, [id]);

  const handleUpdate = async () => {
    if (!foodName.trim()) return Alert.alert("Error", "Food name is required");
    if (!calories || isNaN(parseFloat(calories)) || Number(calories) <= 0)
      return Alert.alert("Error", "Calories must be a positive number");

    setIsLoading(true);
    try {
      const response = await fetch(`${FOOD_ENTRIES_API_URL}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          food_name: foodName,
          calories: Number(calories),
          protein: protein ? Number(protein) : 0,
          carbs: carbs ? Number(carbs) : 0,
          fat: fat ? Number(fat) : 0,
          meal_type: mealType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage =
          (errorData.details && Array.isArray(errorData.details)
            ? errorData.details.join("\n")
            : null) ||
          errorData.error ||
          errorData.message ||
          "Failed to update food entry";
        throw new Error(errorMessage);
      }

      // Flag the homepage to refresh, then navigate back
      setShouldRefresh(true);
      router.back();
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
      enableOnAndroid={true}
      enableAutomaticScroll={true}
      extraScrollHeight={Platform.OS === "ios" ? 20 : 0}
      keyboardShouldPersistTaps="handled"
      enableResetScrollToCoords={false}
    >
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Food Entry</Text>
          <TouchableOpacity
            style={[
              styles.saveButtonContainer,
              isLoading && styles.saveButtonDisabled,
            ]}
            onPress={handleUpdate}
            disabled={isLoading}
          >
            <Text
              style={[
                styles.saveButton,
                isLoading && styles.saveButtonDisabled,
              ]}
            >
              {isLoading ? "Saving..." : "Save"}
            </Text>
            {!isLoading && (
              <Ionicons name="checkmark" size={18} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* FORM */}
        <FoodEntryFormCard
          foodName={foodName}
          setFoodName={setFoodName}
          calories={calories}
          setCalories={setCalories}
          protein={protein}
          setProtein={setProtein}
          carbs={carbs}
          setCarbs={setCarbs}
          fat={fat}
          setFat={setFat}
          mealType={mealType}
          setMealType={setMealType}
        />
      </View>
    </KeyboardAwareScrollView>
  );
}
