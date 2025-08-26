import { View, Text, Alert, TouchableOpacity, Platform } from "react-native";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { FOOD_ENTRIES_API_URL, ESTIMATE_MACROS_API_URL } from "@/constants/api";
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
  const { getToken } = useAuth();
  const { setShouldRefresh } = useRefreshSignal();

  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [isLoading, setIsLoading] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [isEstimating, setIsEstimating] = useState(false);
  const [lastEstimated, setLastEstimated] = useState({
    foodName: "",
    quantity: "",
  });
  const [showMacros, setShowMacros] = useState(false);

  const handleCreate = async () => {
    // form validation
    if (!foodName.trim()) return Alert.alert("Error", "Food name is required");
    if (!showMacros) {
      return Alert.alert(
        "Need Macros",
        "Please estimate the macros with AI or enter them manually before saving."
      );
    }
    if (!calories || isNaN(parseFloat(calories)) || parseFloat(calories) < 0)
      return Alert.alert("Error", "Calories must be a non-negative number");
    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${FOOD_ENTRIES_API_URL}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          foodName,
          quantity,
          calories: Number(calories),
          protein: protein ? Number(protein) : 0,
          carbs: carbs ? Number(carbs) : 0,
          fat: fat ? Number(fat) : 0,
          mealType,
          createdAt: getLocalTimeWithOffset(),
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

  const handleEstimateMacros = async () => {
    if (!foodName.trim() || !quantity.trim()) {
      return Alert.alert(
        "Error",
        "Food name and quantity are required for estimation"
      );
    }
    setIsEstimating(true);
    try {
      const token = await getToken();
      const resp = await fetch(ESTIMATE_MACROS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ foodName, quantity }),
      });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(
          errData.error || errData.message || "Estimation failed"
        );
      }
      const data = await resp.json();

      // If backend normalized the quantity (e.g., added "count(s)") reflect that in the UI
      if (data.normalizedQuantity) {
        setQuantity(data.normalizedQuantity);
      }

      setCalories(String(data.calories ?? ""));
      setProtein(String(data.protein ?? ""));
      setCarbs(String(data.carbs ?? ""));
      setFat(String(data.fat ?? ""));

      // Store the values that were actually estimated (post-normalization for quantity)
      setLastEstimated({
        foodName,
        quantity: data.normalizedQuantity || quantity,
      });
      setShowMacros(true);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setIsEstimating(false);
    }
  };

  const estimateDisabled =
    !foodName.trim() ||
    !quantity.trim() ||
    (foodName.trim() === lastEstimated.foodName &&
      quantity.trim() === lastEstimated.quantity);

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 10 }}
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
          quantity={quantity}
          setQuantity={setQuantity}
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
          onEstimateMacros={handleEstimateMacros}
          isEstimating={isEstimating}
          estimateDisabled={estimateDisabled}
          showMacros={showMacros}
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

export default CreateScreen;
