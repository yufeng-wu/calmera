import { useEffect, useState } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "@/assets/styles/create.styles";
import { COLORS } from "@/constants/colors";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";

export default function EditFoodEntry() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

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
        throw new Error(errorData.message || "Failed to update food entry");
      }

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
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          >
            {isLoading ? "Saving..." : "Save"}
          </Text>
          {!isLoading && (
            <Ionicons name="checkmark" size={18} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* SIMPLE FORM CARD */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Food Details</Text>
        <View style={styles.inputContainer}>
          <Ionicons
            name="restaurant"
            size={20}
            color={COLORS.textLight}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Food name"
            placeholderTextColor={COLORS.textLight}
            value={foodName}
            onChangeText={setFoodName}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons
            name="flame"
            size={20}
            color={COLORS.textLight}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Calories (kcal)"
            placeholderTextColor={COLORS.textLight}
            keyboardType="numeric"
            value={calories}
            onChangeText={setCalories}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons
            name="barbell"
            size={20}
            color={COLORS.textLight}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Protein (g)"
            placeholderTextColor={COLORS.textLight}
            keyboardType="numeric"
            value={protein}
            onChangeText={setProtein}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons
            name="nutrition"
            size={20}
            color={COLORS.textLight}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Carbs (g)"
            placeholderTextColor={COLORS.textLight}
            keyboardType="numeric"
            value={carbs}
            onChangeText={setCarbs}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons
            name="egg"
            size={20}
            color={COLORS.textLight}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Fat (g)"
            placeholderTextColor={COLORS.textLight}
            keyboardType="numeric"
            value={fat}
            onChangeText={setFat}
          />
        </View>
      </View>
    </View>
  );
}
