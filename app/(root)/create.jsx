import { estimateMacros, inferenceError } from "@/lib/chatgpt/nutrition";
import { Text, Alert, Platform, StyleSheet, Keyboard, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import { mealRequest } from "@/lib/mealRequest.mjs";
import { validateMealNutrition } from "@/lib/mealNutritionValidation.mjs";
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
  const { fontScale } = useWindowDimensions();
  const navigation = useNavigation();
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
  const { store, setShouldRefresh } = useRefreshSignal();
  const ownerRef = useRef(userId);
  ownerRef.current = userId;

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
  const scope = useFormTaskScope(userId, () => {
    savingRef.current = false; estimatingRef.current = false;
    setIsLoading(false); setIsEstimating(false);
    navigation.setOptions({ gestureEnabled: true });
  });

  const handleCreate = async () => {
    if (ownerRef.current !== userId || !scope.isActive() || savingRef.current || estimatingRef.current) return;
    // form validation
    if (!foodName.trim()) return Alert.alert("Add a food", "Enter what you ate before saving.");
    if (!showMacros) {
      return Alert.alert(
        "Add nutrition",
        "Estimate with ChatGPT or enter the nutrition values before saving."
      );
    }
    const nutrition = validateMealNutrition({ calories, protein, carbs, fat });
    if (nutrition.error) return Alert.alert(nutrition.error.title, nutrition.error.message);
    if (uiTestFixture) {
      return Alert.alert("Preview only", "The form is valid. Nothing was sent or saved.");
    }
    const task = scope.start();
    if (!task) return;
    const currentOwner = () => ownerRef.current === userId && store.belongsTo(userId);
    const current = () => task.isCurrent() && currentOwner();
    savingRef.current = task;
    navigation.setOptions({ gestureEnabled: false });
    Keyboard.dismiss();
    setIsLoading(true);
    let leavingAfterSave = false;
    try {
      await mealRequest({ getToken, url: FOOD_ENTRIES_API_URL, signal: task.signal, isActive: current,
        body: { foodName, quantity, ...nutrition.values, mealType, createdAt: getLocalTimeWithOffset() } });

      // Signal home screen to refresh entries, then navigate back home
      if (currentOwner()) setShouldRefresh(true);
      if (current()) { exit(); leavingAfterSave = true; }
    } catch (error) {
      if (error.uncertain && currentOwner()) setShouldRefresh(true);
      if (!current()) return;
      Alert.alert(error.uncertain ? "Couldn’t confirm save" : "Couldn’t save meal",
        error.uncertain ? "Your meal may already be saved. Your draft is still here; check History before trying again to avoid a duplicate."
          : error.timedOut ? "Saving took too long. Your draft is still here. Please try again." : error.message,
        error.uncertain ? [{ text: "Keep editing", style: "cancel" }, { text: "View History", onPress: () => { if (current()) router.push("/history"); } }] : undefined);
    } finally {
      task.finish();
      if (savingRef.current === task && !leavingAfterSave) {
        savingRef.current = false;
        if (current()) { setIsLoading(false); navigation.setOptions({ gestureEnabled: true }); }
      }
    }
  };

  const handleEstimateMacros = async () => {
    if (ownerRef.current !== userId || !scope.isActive() || estimatingRef.current || savingRef.current) return;
    if (!foodName.trim() || !quantity.trim()) {
      return Alert.alert(
        "Add food and amount",
        "Enter what you ate and how much before estimating."
      );
    }
    if (uiTestFixture) {
      return Alert.alert("Preview only", "Estimation is disabled for this visual test. You can enter macros manually.");
    }
    const task = scope.start();
    if (!task) return;
    const current = () => task.isCurrent() && ownerRef.current === userId && store.belongsTo(userId);
    estimatingRef.current = task;
    navigation.setOptions({ gestureEnabled: false });
    setIsEstimating(true);
    try {
      const data = await estimateMacros(userId, foodName, quantity, { signal: task.signal });
      if (!current()) return;

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
      if (current()) inferenceError(err, router);
    } finally {
      task.finish();
      if (estimatingRef.current === task) {
        estimatingRef.current = false;
        if (current()) { setIsEstimating(false); navigation.setOptions({ gestureEnabled: true }); }
      }
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
      <FormScrollView key={`manual-text-${fontScale}`} keyboardAware
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
