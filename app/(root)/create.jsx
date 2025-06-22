import { View, Text, Alert, TouchableOpacity } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { useState } from "react";
import { styles } from "@/assets/styles/create.styles";
import { COLORS } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

const CATEGORIES = [
  { id: "food", name: "Food & Drinks", icon: "fast-food" },
  { id: "shopping", name: "Shopping", icon: "cart" },
  { id: "transportation", name: "Transportation", icon: "car" },
  { id: "entertainment", name: "Entertainment", icon: "film" },
  { id: "bills", name: "Bills", icon: "receipt" },
  { id: "income", name: "Income", icon: "cash" },
  { id: "other", name: "Other", icon: "ellipsis-horizontal" },
];

const CreateScreen = () => {
  const router = useRouter();
  const { user } = useUser();

  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    // form validation
    if (!foodName.trim()) return Alert.alert("Error", "Food name is required");
    if (!calories || isNaN(parseFloat(calories)) || parseFloat(calories) <= 0)
      return Alert.alert("Error", "Calories must be a positive number");
    setIsLoading(true);
    try {
      const response = await fetch(`${FOOD_ENTRIES_API_URL}`, {
        method: "POST",
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
        throw new Error(errorData.message || "Failed to create food entry");
      }

      router.push("/");
    } catch (error) {
      Alert.alert("Error", "Failed to create food entry");
      console.error("Error creating food entry:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
        <Text style={styles.headerTitle}>New Food Entry</Text>
        <TouchableOpacity
          style={[
            styles.saveButtonContainer,
            isLoading && styles.saveButtonDisabled,
          ]}
          onPress={handleCreate}
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

      {/* CARD */}
    </View>
  );
};

export default CreateScreen;
