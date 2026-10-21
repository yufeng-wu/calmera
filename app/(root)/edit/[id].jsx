import { estimateMacros, inferenceError } from "@/lib/chatgpt/nutrition";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import { mealRequest } from "@/lib/mealRequest.mjs";
import { mealEditorValues, storedMealForEditor } from "@/lib/mealEditorDraft.mjs";
import { validateMealNutrition } from "@/lib/mealNutritionValidation.mjs";
import { createConfirmedMealSave } from "@/lib/confirmedMealSave.mjs";
import { readNutrition } from "@/lib/nutritionRequest.mjs";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FoodEntryFormCard } from "@/components/FoodEntryFormCard";
import { FormScreen, FormScrollView, FormCard, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import usePageExit from "@/hooks/usePageExit";

const previewEntry = {
  food_name: "Banana — UI preview", quantity: "118 g", calories: 105,
  protein: 1, carbs: 27, fat: 0, meal_type: "Breakfast",
};

export default function EditFoodEntry({ calmeraPreview = false, calmeraPreviewState = "ready" }) {
  const { id } = useLocalSearchParams();
  const { getToken, userId } = useAuth();
  const entryId = Array.isArray(id) ? id[0] : id;
  // A new route/account gets its own draft; an old draft can never flash while
  // the next meal's request starts or become editable under another account.
  return <EditFoodEntryForm key={`${userId}:${entryId}:${calmeraPreview}:${calmeraPreviewState}`}
    entryId={entryId} getToken={getToken} userId={userId}
    calmeraPreview={calmeraPreview} calmeraPreviewState={calmeraPreviewState} />;
}

function EditFoodEntryForm({ entryId, getToken, userId, calmeraPreview, calmeraPreviewState }) {
  const router = useRouter();
  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const { store, setShouldRefresh } = useRefreshSignal();
  const loadFixture = calmeraPreview && ["load-token-timeout", "load-json-timeout"].includes(calmeraPreviewState);
  const [initialEntry] = useState(() => calmeraPreview
    ? loadFixture ? null : previewEntry : storedMealForEditor(store, userId, entryId));
  const initialValues = mealEditorValues(initialEntry || {});
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const confirmedSave = useRef(null);
  if (!confirmedSave.current) confirmedSave.current = createConfirmedMealSave();
  const [confirmedKey, setConfirmedKey] = useState(null);
  const fixtureSaves = useRef(0);
  const fixtureExitFailed = useRef(false);
  const [simulatedSaves, setSimulatedSaves] = useState(0);
  const savingRef = useRef(false);
  const estimatingRef = useRef(false);
  const [foodName, setFoodName] = useState(initialValues.foodName);
  const [quantity, setQuantity] = useState(initialValues.quantity);
  const [calories, setCalories] = useState(initialValues.calories);
  const [protein, setProtein] = useState(initialValues.protein);
  const [carbs, setCarbs] = useState(initialValues.carbs);
  const [fat, setFat] = useState(initialValues.fat);
  const [mealType, setMealType] = useState(initialValues.mealType);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [isEstimating, setIsEstimating] = useState(false);
  const [lastEstimated, setLastEstimated] = useState({ foodName: initialValues.foodName, quantity: initialValues.quantity });
  const [showMacros, setShowMacros] = useState(true);
  const entryRef = useRef(entryId);
  entryRef.current = entryId;
  const sameEntry = () => ownerRef.current === userId && entryRef.current === entryId;
  const navigationFixture = calmeraPreview && calmeraPreviewState === "saved-navigation-error";
  const saveKey = calmeraPreview ? "calmera-editor-preview" : `${userId}:${entryId}`;
  const loadCalls = useRef({ attempts: 0, requests: 0 });
  const [loadTrace, setLoadTrace] = useState({ attempts: 0, requests: 0 });
  const goBack = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");
  const scope = useFormTaskScope(`${userId}:${entryId || "preview"}`, () => {
    savingRef.current = false; estimatingRef.current = false;
    setIsLoading(false); setIsEstimating(false);
    setConfirmedKey(confirmedSave.current.hasConfirmed(saveKey) ? saveKey : null);
    navigation.setOptions({ gestureEnabled: true });
  });
  const hasConfirmed = confirmedSave.current.hasConfirmed(saveKey);
  const back = () => {
    if (!confirmedSave.current.hasConfirmed(saveKey)) return goBack();
    try { goBack(); }
    catch { if (sameEntry() && scope.isActive()) setConfirmedKey(saveKey); }
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const current = () => active && ownerRef.current === userId && entryRef.current === entryId;
    const fetchEntry = async () => {
      setIsFetching(true);
      setLoadError("");
      try {
        let data = previewEntry;
        if (!calmeraPreview || loadFixture) {
          if (!calmeraPreview && !entryId) throw new Error("invalid_meal_id");
          const options = { getToken: () => tokenRef.current(), url: `${FOOD_ENTRIES_API_URL}/${entryId}`,
            signal: controller.signal, timeoutMs: 15000, isActive: current };
          if (loadFixture) {
            // Same bounded reader; the private review never accesses auth/network.
            const attempt = ++loadCalls.current.attempts;
            setLoadTrace({ ...loadCalls.current });
            options.url = "https://calmera.invalid/meals/synthetic-ui-entry";
            options.timeoutMs = 4000;
            options.getToken = () => calmeraPreviewState === "load-token-timeout" && attempt === 1
              ? new Promise(() => {}) : Promise.resolve("synthetic-token");
            options.fetchImpl = async () => {
              loadCalls.current.requests += 1;
              if (current()) setLoadTrace({ ...loadCalls.current });
              return { ok: true, json: () => calmeraPreviewState === "load-json-timeout" && attempt === 1
                ? new Promise(() => {}) : Promise.resolve({ ...previewEntry }) };
            };
          }
          data = await readNutrition(options);
        }
        if (!current()) return;
        const values = mealEditorValues(data);
        setFoodName(values.foodName);
        setCalories(values.calories);
        setProtein(values.protein);
        setCarbs(values.carbs);
        setFat(values.fat);
        setMealType(values.mealType);
        setQuantity(values.quantity);
        setLastEstimated({ foodName: values.foodName, quantity: values.quantity });
        setShowMacros(true);
      } catch (error) {
        if (current()) setLoadError(error.message === "nutrition_request_timeout"
          ? "Loading took too long. Please try again."
          : error.message === "invalid_meal_id" ? "Go back and choose a meal again."
            : error.message === "nutrition_http_404" ? "This meal is no longer available. Go back and choose another meal."
              : error.message === "calmera_sign_in_required" ? "Sign in again to load this meal."
                : "Unable to load this food entry. Please try again.");
      } finally {
        if (current()) setIsFetching(false);
      }
    };
    fetchEntry();
    return () => { active = false; controller.abort(); };
  }, [entryId, userId, calmeraPreview, loadFixture, calmeraPreviewState, retry]);

  const taskCurrent = task => task.isCurrent() && sameEntry();
  const refreshWrittenMeal = () => {
    if (!calmeraPreview && ownerRef.current === userId && store.belongsTo(userId)) setShouldRefresh(true);
  };

  const handleUpdate = async () => {
    if (!scope.isActive() || !sameEntry() || savingRef.current || estimatingRef.current || isFetching || isEstimating || loadError || confirmedSave.current.hasConfirmed(saveKey)) return;
    if (!foodName.trim()) return Alert.alert("Add a food", "Enter what you ate before saving.");
    const nutrition = validateMealNutrition({ calories, protein, carbs, fat });
    if (nutrition.error) return Alert.alert(nutrition.error.title, nutrition.error.message);
    if (calmeraPreview && !navigationFixture) return Alert.alert("Preview only", "Changes validated. No meal was updated.");
    const task = scope.start();
    if (!task) return;
    savingRef.current = task;
    navigation.setOptions({ gestureEnabled: false });
    setIsLoading(true);
    let leavingAfterSave = false;
    try {
      const outcome = await confirmedSave.current.run({ key: saveKey, isCurrent: () => taskCurrent(task),
        persist: navigationFixture ? async () => {
          fixtureSaves.current += 1;
          if (taskCurrent(task)) setSimulatedSaves(fixtureSaves.current);
        } : () => mealRequest({ getToken: () => tokenRef.current(), url: `${FOOD_ENTRIES_API_URL}/${entryId}`,
          method: "PUT", signal: task.signal, isActive: () => taskCurrent(task),
          body: { foodName, quantity, ...nutrition.values, mealType } }),
        onConfirmed: refreshWrittenMeal,
        exit: () => {
          if (navigationFixture && !fixtureExitFailed.current) {
            fixtureExitFailed.current = true; throw new Error("synthetic_navigation_unavailable");
          }
          goBack();
        },
      });
      if (outcome.kind === "left") leavingAfterSave = true;
      else if (confirmedSave.current.hasConfirmed(saveKey) && sameEntry() && scope.isActive()) setConfirmedKey(saveKey);
    } catch (error) {
      if (error.mayHaveSaved) refreshWrittenMeal();
      if (taskCurrent(task)) Alert.alert("Couldn’t save changes", error.timedOut
        ? error.mayHaveSaved ? "Saving took too long. Your changes are still here. Check History before trying again."
          : "Saving took too long. Your changes are still here. Please try again." : error.message);
    } finally {
      task.finish();
      if (savingRef.current === task && !leavingAfterSave) {
        savingRef.current = false;
        if (taskCurrent(task)) { setIsLoading(false); navigation.setOptions({ gestureEnabled: true }); }
      }
    }
  };

  const handleEstimateMacros = async () => {
    if (!scope.isActive() || !sameEntry() || estimatingRef.current || savingRef.current || isLoading || isFetching || loadError || confirmedSave.current.hasConfirmed(saveKey)) return;
    if (!foodName.trim() || !quantity.trim())
      return Alert.alert("Add food and amount", "Enter what you ate and how much before estimating.");
    const task = scope.start();
    if (!task) return;
    estimatingRef.current = task;
    navigation.setOptions({ gestureEnabled: false });
    setIsEstimating(true);
    try {
      const data = calmeraPreview
        ? { ...previewEntry, normalizedQuantity: quantity }
        : await estimateMacros(userId, foodName, quantity, { signal: task.signal });
      if (!taskCurrent(task)) return;
      if (data.normalizedQuantity) setQuantity(data.normalizedQuantity);
      setCalories(String(data.calories ?? ""));
      setProtein(String(data.protein ?? ""));
      setCarbs(String(data.carbs ?? ""));
      setFat(String(data.fat ?? ""));
      setLastEstimated({ foodName, quantity: data.normalizedQuantity || quantity });
      setShowMacros(true);
    } catch (err) { if (taskCurrent(task)) inferenceError(err, router); }
    finally {
      task.finish();
      if (estimatingRef.current === task) {
        estimatingRef.current = false;
        if (taskCurrent(task)) { setIsEstimating(false); navigation.setOptions({ gestureEnabled: true }); }
      }
    }
  };
  const estimateDisabled = isLoading || isFetching || !!loadError || hasConfirmed || !foodName.trim() || !quantity.trim()
    || (foodName.trim() === lastEstimated.foodName && quantity.trim() === lastEstimated.quantity);

  const showLoadingCard = isFetching && !initialEntry;

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Edit Meal" onBack={back} onSave={handleUpdate} saving={isLoading} backDisabled={isLoading}
      saveDisabled={isFetching || isEstimating || !!loadError || hasConfirmed} />
    <FormScrollView keyboardAware key={`editor-text-${fontScale}`} style={formStyles.screen} contentContainerStyle={{ paddingTop: showLoadingCard || loadError ? 12 : 0, paddingBottom: 40, gap: 18 }}
      enableOnAndroid enableAutomaticScroll extraScrollHeight={Platform.OS === "ios" ? 20 : 0}
      keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" enableResetScrollToCoords={false}>
      {calmeraPreview && <Text style={[formStyles.caption, { marginHorizontal: 20 }]}>Synthetic preview · nothing is saved</Text>}
      {navigationFixture && <Text accessibilityLiveRegion="polite" style={[formStyles.caption, { marginHorizontal: 20 }]}>Simulated saves: {simulatedSaves}</Text>}
      {hasConfirmed && confirmedKey === saveKey && <FormCard style={{ marginHorizontal: 20 }}>
        <Text style={formStyles.sectionTitle}>Meal saved</Text>
        <Text style={formStyles.caption}>Go back to continue.</Text>
        <GlassButton title="Go back" onPress={back} />
      </FormCard>}
      {loadFixture && <Text accessibilityLiveRegion="polite" style={[formStyles.caption, { marginHorizontal: 20 }]}>
        Synthetic meal loads: {loadTrace.attempts} · GET requests: {loadTrace.requests}
      </Text>}
      {showLoadingCard ? <FormCard style={localStyles.statusCard}>
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
        isEstimating={isEstimating} busy={isFetching || isLoading || isEstimating || hasConfirmed} estimateDisabled={estimateDisabled} showMacros={showMacros} />}
    </FormScrollView>
  </FormScreen>;
}
const localStyles = StyleSheet.create({ statusCard: { marginHorizontal: 20, minHeight: 160, alignItems: "center", justifyContent: "center" } });
