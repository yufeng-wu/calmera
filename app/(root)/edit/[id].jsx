import { estimateMacros, inferenceError } from "@/lib/chatgpt/nutrition";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FoodEntryFormCard } from "@/components/FoodEntryFormCard";
import { FormCard, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import usePageExit from "@/hooks/usePageExit";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

const previewEntry = {
  food_name: "Banana — UI preview", quantity: "118 g", calories: 105,
  protein: 1, carbs: 27, fat: 0, meal_type: "Breakfast",
};

export default function EditFoodEntry({ calmeraPreview = false }) {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const { id } = useLocalSearchParams();
  const { getToken, userId } = useAuth();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const { setShouldRefresh } = useRefreshSignal();
  const savingRef = useRef(false);
  const estimatingRef = useRef(false);
  const [foodName, setFoodName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [isEstimating, setIsEstimating] = useState(false);
  const [lastEstimated, setLastEstimated] = useState({ foodName: "", quantity: "" });
  const [showMacros, setShowMacros] = useState(true);
  const entryId = Array.isArray(id) ? id[0] : id;
  const goBack = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const fetchEntry = async () => {
      setIsFetching(true);
      setLoadError("");
      try {
        let data = previewEntry;
        if (!calmeraPreview) {
          if (!entryId) throw new Error("Invalid food entry. Go back and choose a meal again.");
          const token = await tokenRef.current();
          if (!active) return;
          const resp = await fetch(`${FOOD_ENTRIES_API_URL}/${entryId}`, {
            signal: controller.signal, headers: { Authorization: `Bearer ${token}` },
          });
          if (!resp.ok) throw new Error("Unable to load this food entry. Please try again.");
          data = await resp.json();
        }
        if (!active) return;
        setFoodName(data.food_name ?? "");
        setCalories(String(data.calories ?? ""));
        setProtein(String(data.protein ?? ""));
        setCarbs(String(data.carbs ?? ""));
        setFat(String(data.fat ?? ""));
        setMealType(data.meal_type ?? "Breakfast");
        setQuantity(String(data.quantity ?? ""));
        setLastEstimated({ foodName: data.food_name ?? "", quantity: String(data.quantity ?? "") });
        setShowMacros(true);
      } catch (error) {
        if (active) setLoadError(error.name === "AbortError" ? "Loading took too long. Please try again." : error.message);
      } finally {
        clearTimeout(timeout);
        if (active) setIsFetching(false);
      }
    };
    fetchEntry();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [entryId, userId, calmeraPreview, retry]);

  const handleUpdate = async () => {
    if (savingRef.current || isFetching || isEstimating || loadError) return;
    if (!foodName.trim()) return Alert.alert("Error", "Food name is required");
    if (!calories || isNaN(parseFloat(calories)) || Number(calories) < 0)
      return Alert.alert("Error", "Calories must be a non-negative number");
    if (calmeraPreview) return Alert.alert("Preview only", "Changes validated. No meal was updated.");
    savingRef.current = true;
    setIsLoading(true);
    try {
      const token = await tokenRef.current();
      const response = await fetch(`${FOOD_ENTRIES_API_URL}/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          foodName, quantity, calories: Number(calories),
          protein: protein ? Number(protein) : 0, carbs: carbs ? Number(carbs) : 0,
          fat: fat ? Number(fat) : 0, mealType,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error((Array.isArray(errorData.details) ? errorData.details.join("\n") : null)
          || errorData.error || errorData.message || "Failed to update food entry");
      }
      setShouldRefresh(true);
      goBack();
    } catch (error) { Alert.alert("Error", error.message); }
    finally { savingRef.current = false; setIsLoading(false); }
  };

  const handleEstimateMacros = async () => {
    if (estimatingRef.current || isLoading) return;
    if (!foodName.trim() || !quantity.trim())
      return Alert.alert("Error", "Food name and quantity are required for estimation");
    estimatingRef.current = true;
    setIsEstimating(true);
    try {
      const data = calmeraPreview
        ? { ...previewEntry, normalizedQuantity: quantity }
        : await estimateMacros(userId, foodName, quantity);
      if (data.normalizedQuantity) setQuantity(data.normalizedQuantity);
      setCalories(String(data.calories ?? ""));
      setProtein(String(data.protein ?? ""));
      setCarbs(String(data.carbs ?? ""));
      setFat(String(data.fat ?? ""));
      setLastEstimated({ foodName, quantity: data.normalizedQuantity || quantity });
      setShowMacros(true);
    } catch (err) { inferenceError(err, router); }
    finally { estimatingRef.current = false; setIsEstimating(false); }
  };
  const estimateDisabled = isLoading || !foodName.trim() || !quantity.trim()
    || (foodName.trim() === lastEstimated.foodName && quantity.trim() === lastEstimated.quantity);

  return <View style={formStyles.screen}>
    <FormHeader title="Edit Meal" onBack={goBack} onSave={handleUpdate} saving={isLoading} backDisabled={isLoading}
      saveDisabled={isFetching || isEstimating || !!loadError} />
    <KeyboardAwareScrollView key={`editor-text-${fontScale}`} style={formStyles.screen} contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 18 }}
      enableOnAndroid enableAutomaticScroll extraScrollHeight={Platform.OS === "ios" ? 20 : 0}
      keyboardShouldPersistTaps="handled" enableResetScrollToCoords={false}>
      {calmeraPreview && <Text style={[formStyles.caption, { marginHorizontal: 20 }]}>Synthetic preview · nothing is saved</Text>}
      {isFetching ? <FormCard style={localStyles.statusCard}>
        <ActivityIndicator color={COLORS.primary} accessibilityLabel="Loading meal" />
        <Text style={formStyles.caption}>Loading your meal…</Text>
      </FormCard> : loadError ? <FormCard style={{ marginHorizontal: 20 }}>
        <Text style={formStyles.sectionTitle}>Unable to load meal</Text>
        <Text style={formStyles.caption}>{loadError}</Text>
        <GlassButton title="Try again" symbol="arrow.clockwise" onPress={() => setRetry(value => value + 1)} />
      </FormCard> : <FoodEntryFormCard
        foodName={foodName} setFoodName={setFoodName} quantity={quantity} setQuantity={setQuantity}
        calories={calories} setCalories={setCalories} protein={protein} setProtein={setProtein}
        carbs={carbs} setCarbs={setCarbs} fat={fat} setFat={setFat}
        mealType={mealType} setMealType={setMealType} onEstimateMacros={handleEstimateMacros}
        isEstimating={isEstimating} estimateDisabled={estimateDisabled} showMacros={showMacros} />}
    </KeyboardAwareScrollView>
  </View>;
}
const localStyles = StyleSheet.create({ statusCard: { marginHorizontal: 20, minHeight: 160, alignItems: "center", justifyContent: "center" } });
