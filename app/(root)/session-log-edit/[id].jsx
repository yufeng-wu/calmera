import { estimateMacros, inferenceError } from "@/lib/chatgpt/nutrition";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { getLogEntryById, updateLogEntryById } from "@/lib/scale/sessionManager";
import { FoodEntryFormCard } from "@/components/FoodEntryFormCard";
import { FormScreen, FormScrollView, FormCard, FormHeader, formStyles } from "@/components/GlassForm";
import usePageExit from "@/hooks/usePageExit";

const previewEntry = { foodName: "Banana — UI preview", absDeltaWeight: 118, direction: "add",
  nutritionInfo: { calories: 105, protein: 1, carbs: 27, fat: 0 } };

export default function EditSessionLogEntry({ calmeraPreview = false }) {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const { id } = useLocalSearchParams();
  const { userId } = useAuth();
  const savingRef = useRef(false);
  const estimatingRef = useRef(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [foodName, setFoodName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [direction, setDirection] = useState("add");
  const [isEstimating, setIsEstimating] = useState(false);
  const [lastEstimated, setLastEstimated] = useState({ foodName: "", quantity: "" });
  const [showMacros, setShowMacros] = useState(true);
  const entryId = Array.isArray(id) ? id[0] : id;
  const goBack = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");

  useEffect(() => {
    setIsFetching(true);
    setLoadError("");
    // Preview never reads the user's active scale session.
    const entry = calmeraPreview ? previewEntry : entryId ? getLogEntryById(String(entryId)) : null;
    if (!entry) {
      setLoadError(entryId ? "This item is no longer in the current session." : "Invalid log entry. Go back and choose an item again.");
      setIsFetching(false);
      return;
    }
    setFoodName(entry.foodName ?? "");
    setCalories(String(entry.nutritionInfo?.calories ?? ""));
    setProtein(String(entry.nutritionInfo?.protein ?? ""));
    setCarbs(String(entry.nutritionInfo?.carbs ?? ""));
    setFat(String(entry.nutritionInfo?.fat ?? ""));
    setQuantity(String(entry.absDeltaWeight ?? ""));
    setDirection(entry.direction ?? "add");
    setLastEstimated({ foodName: entry.foodName ?? "", quantity: String(entry.absDeltaWeight ?? "") });
    setIsFetching(false);
  }, [entryId, calmeraPreview]);

  const handleSave = () => {
    if (savingRef.current || estimatingRef.current || isFetching || isEstimating || loadError) return;
    if (!foodName.trim()) return Alert.alert("Error", "Food name is required");
    if (!calories || isNaN(parseFloat(calories)) || Number(calories) < 0)
      return Alert.alert("Error", "Calories must be a non-negative number");
    if (calmeraPreview) return Alert.alert("Preview only", "Changes validated. No scale-session item was updated.");
    savingRef.current = true;
    setIsSaving(true);
    const success = updateLogEntryById(String(entryId), {
      foodName: foodName.trim(), absDeltaWeight: quantity ? Number(quantity) : undefined, direction,
      nutritionInfo: { calories: calories ? Number(calories) : undefined,
        protein: protein ? Number(protein) : undefined, carbs: carbs ? Number(carbs) : undefined,
        fat: fat ? Number(fat) : undefined },
    });
    savingRef.current = false;
    setIsSaving(false);
    if (!success) return Alert.alert("Error", "Failed to update entry – session may have ended");
    goBack();
  };

  const handleEstimateMacros = async () => {
    if (estimatingRef.current || savingRef.current || isSaving) return;
    if (!foodName.trim() || !quantity.trim())
      return Alert.alert("Error", "Food name and quantity are required for estimation");
    estimatingRef.current = true;
    setIsEstimating(true);
    try {
      const data = calmeraPreview ? previewEntry.nutritionInfo : await estimateMacros(userId, foodName, `${quantity} g`);
      setCalories(String(data.calories ?? ""));
      setProtein(String(data.protein ?? ""));
      setCarbs(String(data.carbs ?? ""));
      setFat(String(data.fat ?? ""));
      setLastEstimated({ foodName, quantity });
      setShowMacros(true);
    } catch (err) { inferenceError(err, router); }
    finally { estimatingRef.current = false; setIsEstimating(false); }
  };
  const estimateDisabled = isSaving || !foodName.trim() || !quantity.trim()
    || (foodName.trim() === lastEstimated.foodName && quantity.trim() === lastEstimated.quantity);

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Edit Item" onBack={goBack} onSave={handleSave} saving={isSaving} backDisabled={isSaving}
      saveDisabled={isFetching || isEstimating || !!loadError} />
    <FormScrollView keyboardAware key={`editor-text-${fontScale}`} style={formStyles.screen} contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 18 }}
      enableOnAndroid enableAutomaticScroll extraScrollHeight={Platform.OS === "ios" ? 20 : 0}
      keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" enableResetScrollToCoords={false}>
      {calmeraPreview && <Text style={[formStyles.caption, { marginHorizontal: 20 }]}>Synthetic preview · nothing is saved</Text>}
      {isFetching ? <FormCard style={localStyles.statusCard}>
        <ActivityIndicator color={COLORS.primary} accessibilityLabel="Loading session item" />
        <Text style={formStyles.caption}>Loading your item…</Text>
      </FormCard> : loadError ? <FormCard style={{ marginHorizontal: 20 }}>
        <Text style={formStyles.sectionTitle}>Item unavailable</Text>
        <Text style={formStyles.caption}>{loadError}</Text>
      </FormCard> : <FoodEntryFormCard
        foodName={foodName} setFoodName={setFoodName} quantity={quantity} setQuantity={setQuantity}
        gramsOnly calories={calories} setCalories={setCalories} protein={protein} setProtein={setProtein}
        carbs={carbs} setCarbs={setCarbs} fat={fat} setFat={setFat} showMealType={false}
        showEstimateButton onEstimateMacros={handleEstimateMacros} isEstimating={isEstimating} busy={isSaving || isEstimating}
        estimateDisabled={estimateDisabled} showMacros={showMacros} />}
    </FormScrollView>
  </FormScreen>;
}
const localStyles = StyleSheet.create({ statusCard: { marginHorizontal: 20, minHeight: 160, alignItems: "center", justifyContent: "center" } });
