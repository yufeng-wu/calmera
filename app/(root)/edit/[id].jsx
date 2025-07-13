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
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "@/assets/styles/create.styles";
import { COLORS } from "@/constants/colors";
import { FOOD_ENTRIES_API_URL, ESTIMATE_MACROS_API_URL } from "@/constants/api";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FoodEntryFormCard } from "@/components/FoodEntryFormCard";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function EditFoodEntry() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { getToken } = useAuth();
  const { setShouldRefresh } = useRefreshSignal();

  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [quantity, setQuantity] = useState("");
  const [isEstimating, setIsEstimating] = useState(false);
  const [lastEstimated, setLastEstimated] = useState({
    foodName: "",
    quantity: "",
  });
  const [showMacros, setShowMacros] = useState(true);

  // Fetch existing entry data
  useEffect(() => {
    const fetchEntry = async () => {
      console.log("fetching entry", id);
      if (!id) return;
      try {
        const token = await getToken();
        const resp = await fetch(`${FOOD_ENTRIES_API_URL}/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!resp.ok) throw new Error("Failed to fetch food entry");
        const data = await resp.json();
        setFoodName(data.food_name ?? "");
        setCalories(String(data.calories ?? ""));
        setProtein(String(data.protein ?? ""));
        setCarbs(String(data.carbs ?? ""));
        setFat(String(data.fat ?? ""));
        setMealType(data.meal_type ?? "Breakfast");
        setQuantity(data.quantity ?? "");
        setLastEstimated({
          foodName: data.food_name ?? "",
          quantity: data.quantity ?? "",
        });
        setShowMacros(true);
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
    if (!calories || isNaN(parseFloat(calories)) || Number(calories) < 0)
      return Alert.alert("Error", "Calories must be a non-negative number");

    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${FOOD_ENTRIES_API_URL}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          foodName: foodName,
          quantity: quantity,
          calories: Number(calories),
          protein: protein ? Number(protein) : 0,
          carbs: carbs ? Number(carbs) : 0,
          fat: fat ? Number(fat) : 0,
          mealType: mealType,
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
}
