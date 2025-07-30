import { useEffect, useState } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "@/assets/styles/create.styles";
import { COLORS } from "@/constants/colors";
import { ESTIMATE_MACROS_API_URL } from "@/constants/api";
import {
  getLogEntryById,
  updateLogEntryById,
} from "@/lib/scale/sessionManager";
import { FoodEntryFormCard } from "@/components/FoodEntryFormCard";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function EditSessionLogEntry() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { getToken } = useAuth();

  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Local editable state
  const [foodName, setFoodName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [direction, setDirection] = useState("add");

  // AI estimation helpers
  const [isEstimating, setIsEstimating] = useState(false);
  const [lastEstimated, setLastEstimated] = useState({
    foodName: "",
    quantity: "",
  });
  const [showMacros, setShowMacros] = useState(true);

  // Fetch entry from the in-memory session log
  useEffect(() => {
    if (!id) {
      Alert.alert("Error", "Invalid log entry id");
      router.back();
      return;
    }

    const entry = getLogEntryById(String(id));
    if (!entry) {
      Alert.alert("Error", "Log entry not found in current session");
      router.back();
      return;
    }

    // Populate UI state
    setFoodName(entry.foodName ?? "");
    setCalories(String(entry.nutritionInfo?.calories ?? ""));
    setProtein(String(entry.nutritionInfo?.protein ?? ""));
    setCarbs(String(entry.nutritionInfo?.carbs ?? ""));
    setFat(String(entry.nutritionInfo?.fat ?? ""));
    setQuantity(String(entry.absDeltaWeight ?? ""));
    setDirection(entry.direction ?? "add");
    setLastEstimated({
      foodName: entry.foodName ?? "",
      quantity: String(entry.absDeltaWeight ?? ""),
    });

    setIsFetching(false);
  }, [id]);

  const handleSave = () => {
    if (!foodName.trim()) return Alert.alert("Error", "Food name is required");
    if (!calories || isNaN(parseFloat(calories)) || Number(calories) < 0) {
      return Alert.alert("Error", "Calories must be a non-negative number");
    }

    setIsSaving(true);
    const success = updateLogEntryById(String(id), {
      foodName: foodName.trim(),
      absDeltaWeight: quantity ? Number(quantity) : undefined,
      direction,
      nutritionInfo: {
        calories: calories ? Number(calories) : undefined,
        protein: protein ? Number(protein) : undefined,
        carbs: carbs ? Number(carbs) : undefined,
        fat: fat ? Number(fat) : undefined,
      },
    });

    setIsSaving(false);
    if (!success) {
      Alert.alert("Error", "Failed to update entry – session may have ended");
      return;
    }

    router.back();
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
        body: JSON.stringify({ foodName, quantity: `${quantity} g` }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || "Estimation failed");
      }
      const data = await resp.json();
      setCalories(String(data.calories ?? ""));
      setProtein(String(data.protein ?? ""));
      setCarbs(String(data.carbs ?? ""));
      setFat(String(data.fat ?? ""));
      setLastEstimated({ foodName, quantity });
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
          <Text style={styles.headerTitle}>Edit Item</Text>
          <TouchableOpacity
            style={[
              styles.saveButtonContainer,
              isSaving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            >
              {isSaving ? "Saving..." : "Save"}
            </Text>
            {!isSaving && (
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
          gramsOnly={true}
          calories={calories}
          setCalories={setCalories}
          protein={protein}
          setProtein={setProtein}
          carbs={carbs}
          setCarbs={setCarbs}
          fat={fat}
          setFat={setFat}
          showMealType={false}
          showEstimateButton={true}
          onEstimateMacros={handleEstimateMacros}
          isEstimating={isEstimating}
          estimateDisabled={estimateDisabled}
          showMacros={showMacros}
        />
      </View>
    </KeyboardAwareScrollView>
  );
}
