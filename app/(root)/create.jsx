import { estimateMacros, inferenceError } from "@/lib/chatgpt/nutrition";
import { Text, Alert, Platform, StyleSheet, Keyboard } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import Constants from "expo-constants";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { useRef, useState } from "react";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FoodEntryFormCard } from "@/components/FoodEntryFormCard";
import { getLocalTimeWithOffset } from "@/lib/utils";
import usePageExit from "@/hooks/usePageExit";
import { FormScreen, FormScrollView, FormHeader } from "@/components/GlassForm";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CreateScreen = ({ calmeraPreview = false } = {}) => {
  const router = useRouter();
  const { calmeraFixture } = useLocalSearchParams();
  // A fixed synthetic fixture is available only in the separate full-test build.
  // It never submits, estimates, signs in or supplies credentials automatically.
  const phoneTestFixture = Constants.expoConfig?.extra?.calmeraFullAppTest === true &&
    calmeraFixture === "banana-phone";
  // The visual fixture uses this same form, with all network operations blocked.
  const uiTestFixture = Constants.expoConfig?.extra?.calmeraFullAppTest === true &&
    (calmeraPreview || calmeraFixture === "ui-manual");
  const exit = usePageExit(uiTestFixture ? "/ui-gallery" : "/dashboard");
  const insets = useSafeAreaInsets();
  const { getToken, userId } = useAuth();
  const { setShouldRefresh } = useRefreshSignal();

  const savingRef = useRef(false);
  const estimatingRef = useRef(false);
  const [foodName, setFoodName] = useState(phoneTestFixture ? "Banana - CALMERA PHONE TEST 2026-10-18" : uiTestFixture ? "Banana" : "");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [isLoading, setIsLoading] = useState(false);
  const [quantity, setQuantity] = useState(phoneTestFixture || uiTestFixture ? "118 g" : "");
  const [isEstimating, setIsEstimating] = useState(false);
  const [lastEstimated, setLastEstimated] = useState({
    foodName: "",
    quantity: "",
  });
  const [showMacros, setShowMacros] = useState(false);

  const handleCreate = async () => {
    if (savingRef.current || estimatingRef.current) return;
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
    if (uiTestFixture) {
      return Alert.alert("Preview only", "The form is valid. Nothing was sent or saved.");
    }
    savingRef.current = true;
    Keyboard.dismiss();
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
      if (router.canGoBack()) router.back();
      else router.replace("/dashboard");
    } catch (error) {
      Alert.alert("Error", error.message);
      console.error("Error creating food entry:", error);
    } finally {
      savingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleEstimateMacros = async () => {
    if (estimatingRef.current || savingRef.current) return;
    if (!foodName.trim() || !quantity.trim()) {
      return Alert.alert(
        "Error",
        "Food name and quantity are required for estimation"
      );
    }
    if (uiTestFixture) {
      return Alert.alert("Preview only", "Estimation is disabled for this visual test. You can enter macros manually.");
    }
    estimatingRef.current = true;
    setIsEstimating(true);
    try {
      const data = await estimateMacros(userId, foodName, quantity);

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
      inferenceError(err, router);
    } finally {
      estimatingRef.current = false;
      setIsEstimating(false);
    }
  };

  const estimateDisabled =
    isLoading ||
    !foodName.trim() ||
    !quantity.trim() ||
    (foodName.trim() === lastEstimated.foodName &&
      quantity.trim() === lastEstimated.quantity);

  return (
    <FormScreen style={screen.container}>
      <FormHeader
        title="Manual"
        onBack={exit}
        onSave={handleCreate}
        saving={isLoading}
        saveDisabled={isLoading || isEstimating}
        backDisabled={isLoading}
      />
      <FormScrollView keyboardAware
        style={screen.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={Platform.OS === "ios" ? 20 : 0}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        enableResetScrollToCoords={false}
      >
        {uiTestFixture && (
          <Text style={screen.fixtureNote}>Visual test · nothing is sent or saved</Text>
        )}
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
          busy={isLoading || isEstimating}
          estimateDisabled={estimateDisabled}
          showMacros={showMacros}
          onEnterMacros={() => setShowMacros(true)}
        />
      </FormScrollView>
    </FormScreen>
  );
};

const screen = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  fixtureNote: { color: COLORS.textLight, textAlign: "center", fontSize: 13, paddingHorizontal: 20, paddingTop: 8 },
});

export default CreateScreen;
