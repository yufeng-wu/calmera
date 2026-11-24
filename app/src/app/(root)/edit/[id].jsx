import { estimateMacros, inferenceError } from "@/lib/chatgpt/nutrition";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Platform, StyleSheet, Text, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import { editorNumber, mealEditorChanged, mealEditorValues, storedMealDateKey, storedMealForEditor } from "@/lib/mealEditorDraft.mjs";
import { removeStoredNutritionEntry } from "@/lib/nutritionDelete.mjs";
import { validateMealNutrition } from "@/lib/mealNutritionValidation.mjs";
import { createConfirmedMealSave } from "@/lib/confirmedMealSave.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { useDataStore } from "@/lib/store";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import MealEditorCard from "@/components/MealEditorCard";
import FoodEmojiPicker from "@/components/FoodEmojiPicker";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { FormScreen, FormScrollView, FormCard, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import usePageExit from "@/hooks/usePageExit";
import * as Haptics from "expo-haptics";

const previewEntry = {
  food_name: "Banana — UI preview", quantity: "118 g", calories: 105,
  protein: 1, carbs: 27, fat: 0, meal_type: "Breakfast",
};

const previewEstimate = calories => {
  const next = calories === 105 ? 128 : 105;
  return next === 105 ? { calories: 105, protein: 1, carbs: 27, fat: 0 } : { calories: 128, protein: 1.6, carbs: 33, fat: 0.4 };
};

export default function EditFoodEntry({ calmeraPreview = false, calmeraPreviewState = "ready" }) {
  const { id } = useLocalSearchParams();
  const userId = LOCAL_OWNER;
  const entryId = Array.isArray(id) ? id[0] : id;
  // A new route gets its own draft; an old draft can never flash while the next meal loads.
  return <EditFoodEntryForm key={`${userId}:${entryId}:${calmeraPreview}:${calmeraPreviewState}`}
    entryId={entryId} userId={userId}
    calmeraPreview={calmeraPreview} calmeraPreviewState={calmeraPreviewState} />;
}

function EditFoodEntryForm({ entryId, userId, calmeraPreview, calmeraPreviewState }) {
  const router = useRouter();
  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();
  const data = useDataStore();
  const { store, setShouldRefresh } = useRefreshSignal();
  const [initialEntry] = useState(() => calmeraPreview ? previewEntry : storedMealForEditor(store, userId, entryId));
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
  const [isDeleting, setIsDeleting] = useState(false);
  // Each landed estimate gets a new id plus the numbers it replaced, so the tiles can animate.
  const [estimatePulse, setEstimatePulse] = useState(null);
  // Once the person edits or estimates, the background refresh must not overwrite their draft.
  const edited = useRef(false);
  const [iconId, setIconId] = useState(null);
  const [pickingIcon, setPickingIcon] = useState(false);
  const { iconFor, rememberIcons } = useFoodIcons();
  const icon = iconFor({ id: entryId, foodName, iconId });
  // What the page opened with; Update stays off and Back leaves quietly until the draft differs.
  const [baseline, setBaseline] = useState(() => initialEntry ? initialValues : null);
  const leaving = useRef(false);
  const changed = mealEditorChanged(baseline, { foodName, quantity, calories, protein, carbs, fat, mealType })
    || (baseline != null && icon.id !== iconFor({ id: entryId, foodName: baseline.foodName }).id);
  const entryRef = useRef(entryId);
  entryRef.current = entryId;
  const sameEntry = () => ownerRef.current === userId && entryRef.current === entryId;
  const navigationFixture = calmeraPreview && calmeraPreviewState === "saved-navigation-error";
  const saveKey = calmeraPreview ? "calmera-editor-preview" : `${userId}:${entryId}`;
  const goBack = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");
  const scope = useFormTaskScope(`${userId}:${entryId || "preview"}`, () => {
    savingRef.current = false; estimatingRef.current = false;
    setIsLoading(false); setIsEstimating(false); setIsDeleting(false);
    setConfirmedKey(confirmedSave.current.hasConfirmed(saveKey) ? saveKey : null);
    navigation.setOptions({ gestureEnabled: true });
  });
  const hasConfirmed = confirmedSave.current.hasConfirmed(saveKey);
  const back = () => {
    if (!confirmedSave.current.hasConfirmed(saveKey)) return goBack();
    try { goBack(); }
    catch { if (sameEntry() && scope.isActive()) setConfirmedKey(saveKey); }
  };

  // Back, the swipe gesture and any other exit ask first while the draft has unsaved changes.
  const guard = useRef(null);
  guard.current = { changed: changed && !hasConfirmed && !isLoading, update: () => handleUpdate() };
  useEffect(() => navigation.addListener("beforeRemove", event => {
    if (leaving.current || !guard.current.changed) return;
    event.preventDefault();
    Keyboard.dismiss();
    Alert.alert("Update this meal?", "You’ve made changes that haven’t been saved.", [
      { text: "Update", onPress: () => guard.current.update() },
      { text: "Discard Changes", style: "destructive", onPress: () => { leaving.current = true; navigation.dispatch(event.data.action); } },
      { text: "Keep Editing", style: "cancel" },
    ]);
  }), [navigation]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const current = () => active && ownerRef.current === userId && entryRef.current === entryId;
    const fetchEntry = async () => {
      setIsFetching(true);
      setLoadError("");
      try {
        let meal = previewEntry;
        if (!calmeraPreview) {
          if (!entryId) throw new Error("invalid_meal_id");
          meal = await data.readMeal(entryId, { signal: controller.signal, isActive: current });
        }
        if (!current() || (initialEntry && edited.current)) return;
        const values = mealEditorValues(meal);
        setFoodName(values.foodName);
        setCalories(values.calories);
        setProtein(values.protein);
        setCarbs(values.carbs);
        setFat(values.fat);
        setMealType(values.mealType);
        setQuantity(values.quantity);
        setBaseline(values);
      } catch (error) {
        if (current()) setLoadError(error.message === "invalid_meal_id" ? "Go back and choose a meal again."
          : error.message === "meal_not_found" ? "This meal is no longer available. Go back and choose another meal."
            : "Unable to load this food entry. Please try again.");
      } finally {
        if (current()) setIsFetching(false);
      }
    };
    fetchEntry();
    return () => { active = false; controller.abort(); };
  }, [data, entryId, userId, calmeraPreview, retry]);

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
        } : () => data.updateMeal(entryId, { foodName, quantity, ...nutrition.values, mealType },
          { signal: task.signal, isActive: () => taskCurrent(task) })
          // The icon is a device preference keyed by the saved meal's id.
          .then(async result => { if (iconId) await rememberIcons([{ id: entryId }], [{ iconId }]).catch(() => {}); return result; }),
        onConfirmed: refreshWrittenMeal,
        exit: () => {
          if (navigationFixture && !fixtureExitFailed.current) {
            fixtureExitFailed.current = true; throw new Error("synthetic_navigation_unavailable");
          }
          leaving.current = true;
          goBack();
        },
      });
      if (outcome.kind === "left") leavingAfterSave = true;
      else if (confirmedSave.current.hasConfirmed(saveKey) && sameEntry() && scope.isActive()) setConfirmedKey(saveKey);
    } catch (error) {
      if (taskCurrent(task)) Alert.alert("Couldn’t save changes", error.message);
    } finally {
      task.finish();
      if (savingRef.current === task && !leavingAfterSave) {
        savingRef.current = false;
        if (taskCurrent(task)) { setIsLoading(false); navigation.setOptions({ gestureEnabled: true }); }
      }
    }
  };

  const handleEstimateMacros = async () => {
    // A meal already shown from the list can be re-estimated while its fresh copy loads.
    if (!scope.isActive() || !sameEntry() || estimatingRef.current || savingRef.current || isLoading || (isFetching && !initialEntry) || loadError || confirmedSave.current.hasConfirmed(saveKey)) return;
    if (!foodName.trim() || !quantity.trim())
      return Alert.alert("Add food and amount", "Enter what you ate and how much before estimating.");
    const task = scope.start();
    if (!task) return;
    estimatingRef.current = task;
    edited.current = true;
    navigation.setOptions({ gestureEnabled: false });
    setIsEstimating(true);
    try {
      // The preview varies its synthetic estimate so the update animation is visible.
      const data = calmeraPreview
        ? { ...previewEntry, normalizedQuantity: quantity, ...previewEstimate(Number(calories) || previewEntry.calories) }
        : await estimateMacros(userId, foodName, quantity, { signal: task.signal });
      if (!taskCurrent(task)) return;
      if (data.normalizedQuantity) setQuantity(data.normalizedQuantity);
      setEstimatePulse({ id: Date.now(), from: { calories, protein, carbs, fat } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCalories(editorNumber(data.calories));
      setProtein(editorNumber(data.protein));
      setCarbs(editorNumber(data.carbs));
      setFat(editorNumber(data.fat));
    } catch (err) { if (taskCurrent(task)) inferenceError(err, router); }
    finally {
      task.finish();
      if (estimatingRef.current === task) {
        estimatingRef.current = false;
        if (taskCurrent(task)) { setIsEstimating(false); navigation.setOptions({ gestureEnabled: true }); }
      }
    }
  };
  const removeMeal = async () => {
    if (!scope.isActive() || !sameEntry() || savingRef.current || estimatingRef.current || isFetching || loadError || confirmedSave.current.hasConfirmed(saveKey)) return;
    if (calmeraPreview) return Alert.alert("Preview only", "No meal was deleted.");
    const task = scope.start();
    if (!task) return;
    savingRef.current = task;
    navigation.setOptions({ gestureEnabled: false });
    setIsDeleting(true);
    let left = false;
    try {
      const request = { signal: task.signal, isActive: () => taskCurrent(task) };
      const deleteMeal = (options) => data.deleteMeal(entryId, options);
      // Delete through the shared store, as Today does, so the row leaves at once.
      const dateKey = storedMealDateKey(store, userId, entryId);
      const removed = dateKey && await removeStoredNutritionEntry({ ...request, store, ownerKey: userId, dateKey, id: entryId,
        deleteMeal, onSettled: refreshWrittenMeal });
      if (!removed) { await deleteMeal(request); refreshWrittenMeal(); }
      if (!taskCurrent(task)) return;
      left = true;
      leaving.current = true;
      goBack();
    } catch {
      if (taskCurrent(task)) Alert.alert("Couldn’t delete meal", "Please try again.");
    } finally {
      task.finish();
      if (savingRef.current === task) {
        savingRef.current = false;
        if (!left && taskCurrent(task)) { setIsDeleting(false); navigation.setOptions({ gestureEnabled: true }); }
      }
    }
  };
  const confirmDelete = () => {
    Keyboard.dismiss();
    Alert.alert("Delete this meal?", `${foodName.trim() || "This meal"} will be removed from your log. This can’t be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: removeMeal },
    ]);
  };
  const estimateDisabled = isLoading || (isFetching && !initialEntry) || !!loadError || hasConfirmed || !foodName.trim() || !quantity.trim();

  const showLoadingCard = isFetching && !initialEntry;

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Edit Meal" onBack={back} onSave={handleUpdate} saveTitle="Update" saving={isLoading} backDisabled={isLoading || isDeleting}
      saveDisabled={!changed || isFetching || isEstimating || isDeleting || !!loadError || hasConfirmed} />
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
      {showLoadingCard ? <FormCard style={localStyles.statusCard}>
        <ActivityIndicator color={COLORS.primary} accessibilityLabel="Loading meal" />
        <Text style={formStyles.caption}>Loading your meal…</Text>
      </FormCard> : loadError ? <FormCard style={{ marginHorizontal: 20 }}>
        <Text style={formStyles.sectionTitle}>Unable to load meal</Text>
        <Text style={formStyles.caption}>{loadError}</Text>
        <GlassButton title="Try again" symbol="arrow.clockwise" onPress={() => setRetry(value => value + 1)} />
      </FormCard> : <MealEditorCard values={{ foodName, quantity, calories, protein, carbs, fat }}
        onChange={(key, text) => { edited.current = true; ({ foodName: setFoodName, quantity: setQuantity, calories: setCalories,
          protein: setProtein, carbs: setCarbs, fat: setFat })[key](text); }}
        icon={icon} onChangeIcon={() => setPickingIcon(true)} mealType={mealType} setMealType={value => { edited.current = true; setMealType(value); }}
        onEstimate={handleEstimateMacros} estimating={isEstimating} estimateDisabled={estimateDisabled}
        estimatePulse={estimatePulse} onDelete={confirmDelete} deleting={isDeleting} busy={(isFetching && !initialEntry) || isLoading || isDeleting || hasConfirmed} />}
    </FormScrollView>
    {pickingIcon && <FoodEmojiPicker selectedIconId={icon.id} disabled={isLoading || hasConfirmed}
      onSelect={setIconId} onClose={() => setPickingIcon(false)} />}
  </FormScreen>;
}
const localStyles = StyleSheet.create({ statusCard: { marginHorizontal: 20, minHeight: 160, alignItems: "center", justifyContent: "center" } });
