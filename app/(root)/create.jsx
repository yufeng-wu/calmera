import { View, Text, Alert, TouchableOpacity, Platform } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { useState } from "react";
import { styles } from "@/assets/styles/create.styles";
import { COLORS } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FoodEntryFormCard } from "@/components/FoodEntryFormCard";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { getLocalTimeWithOffset } from "@/lib/utils";

const CreateScreen = () => {
  const router = useRouter();
  const { user } = useUser();
  const { setShouldRefresh } = useRefreshSignal();

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
          created_at: getLocalTimeWithOffset(),
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
          "Failed to create food entry";
        throw new Error(errorMessage);
      }

      // Signal home screen to refresh entries, then navigate back home
      setShouldRefresh(true);
      router.back();
    } catch (error) {
      Alert.alert("Error", error.message);
      console.error("Error creating food entry:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
};

export default CreateScreen;
