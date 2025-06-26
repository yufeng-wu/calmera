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
import { Ionicons } from "@expo/vector-icons";
import { styles } from "@/assets/styles/create.styles";
import { COLORS } from "@/constants/colors";
import { SESSIONS_API_URL } from "@/constants/api";
import { FoodEntryFormCard } from "@/components/FoodEntryFormCard";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function EditSessionLogEntry() {
  const router = useRouter();
  const { id, sessionId } = useLocalSearchParams();

  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [weight, setWeight] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Fetch the specific log entry
  useEffect(() => {
    const fetchEntry = async () => {
      if (!sessionId || !id) return;
      try {
        const resp = await fetch(`${SESSIONS_API_URL}/${sessionId}`);
        if (!resp.ok) throw new Error("Failed to fetch session info");
        const data = await resp.json();
        const entry = data.log ? data.log[id] : null;
        if (!entry) throw new Error("Log entry not found");

        setFoodName(entry.foodName ?? "");
        const ni = entry.nutritionInfo || {};
        setCalories(String(ni.calories ?? ""));
        setProtein(String(ni.protein ?? ""));
        setCarbs(String(ni.carbs ?? ""));
        setFat(String(ni.fat ?? ""));
        setWeight(String(entry.weight ?? ""));
      } catch (err) {
        Alert.alert("Error", err.message);
        router.back();
      } finally {
        setIsFetching(false);
      }
    };
    fetchEntry();
  }, [sessionId, id]);

  const handleUpdate = async () => {
    if (!foodName.trim()) return Alert.alert("Error", "Food name is required");
    if (!calories || isNaN(parseFloat(calories)) || Number(calories) < 0)
      return Alert.alert("Error", "Calories must be a non-negative number");

    setIsLoading(true);
    try {
      const response = await fetch(
        `${SESSIONS_API_URL}/${sessionId}/log/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            foodName: foodName,
            weight: weight ? Number(weight) : undefined,
            nutritionInfo: {
              calories: calories ? Number(calories) : undefined,
              protein: protein ? Number(protein) : undefined,
              carbs: carbs ? Number(carbs) : undefined,
              fat: fat ? Number(fat) : undefined,
            },
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || errData.message || "Update failed");
      }

      // go back to camera screen
      router.back();
    } catch (err) {
      Alert.alert("Error", err.message);
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
          <Text style={styles.headerTitle}>Edit Session Entry</Text>
          <TouchableOpacity
            style={styles.saveButtonContainer}
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
          weight={weight}
          setWeight={setWeight}
          calories={calories}
          setCalories={setCalories}
          protein={protein}
          setProtein={setProtein}
          carbs={carbs}
          setCarbs={setCarbs}
          fat={fat}
          setFat={setFat}
          showMealType={false}
          showWeight={true}
        />
      </View>
    </KeyboardAwareScrollView>
  );
}
