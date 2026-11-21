import { TYPOGRAPHY } from "@/constants/typography";
import { useCallback, useId, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, InputAccessoryView, Keyboard, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect, useNavigation, usePreventRemove } from "@react-navigation/native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import useMealLogConnection from "@/hooks/useMealLogConnection";
import { canAnalyzeMeal, connectionPresentation, estimationTitle, NO_FOOD_DETECTED, noFoodMessage, providerName } from "@/lib/mealLogPresentation.mjs";
import usePageExit from "@/hooks/usePageExit";
import { FormScreen, FormScrollView, FormHeader, FormCard, GlassButton } from "@/components/GlassForm";
import { phoneTestNutritionLabel } from "@/lib/chatgpt/phoneTestFixtures.mjs";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { useDataStore } from "@/lib/store";
import { pickMealPhoto } from "@/lib/chatgpt/planClient";
import { inferenceError, estimateMacros } from "@/lib/chatgpt/nutrition";
import { mealAI } from "@/lib/ai/mealAI";
import MealReview from "@/components/MealReview";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { createMealReview, saveMealReview, updateReviewFood, MEAL_TYPES } from "@/lib/mealReview.mjs";
import { createConfirmedMealSave } from "@/lib/confirmedMealSave.mjs";
import { getLocalTimeWithOffset } from "@/lib/utils";

export default function MealLogScreen(props) {
  return <MealLogForm key={props.inputMode} {...props} />;
}

function MealLogForm({ inputMode = "photo", calmeraPreview = false, calmeraPreviewState = "empty" } = {}) {
  const textMode = inputMode === "text";
  const textAccessoryId = useId();
  const { rememberIcons } = useFoodIcons();
  const router = useRouter();
  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();
  const { calmeraFixture } = useLocalSearchParams();
  const testBuild = Constants.expoConfig?.extra?.calmeraFullAppTest === true;
  const photoTestFixture = testBuild && calmeraFixture === "label-phone";
  const uiFixture = testBuild && (calmeraPreview || ["ui-photo-empty", "ui-photo-preview", "ui-text", "ui-manual"].includes(calmeraFixture));
  const savedNavigationFixture = testBuild && calmeraPreview && calmeraPreviewState === "saved-navigation-error";
  const previewFixture = uiFixture && (savedNavigationFixture || calmeraFixture === "ui-photo-preview" || (calmeraPreview && ["selected", "review"].includes(calmeraPreviewState)));
  const exit = usePageExit(uiFixture ? "/ui-gallery" : "/dashboard");
  const userId = LOCAL_OWNER;
  const data = useDataStore();
  const { store, setShouldRefresh } = useRefreshSignal();
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const [photo, setPhoto] = useState(photoTestFixture || previewFixture
    ? { dataURL: phoneTestNutritionLabel, syntheticFixture: true }
    : null);
  const { connection, refresh: refreshConnection } = useMealLogConnection(userId, uiFixture);
  const [progress, setProgress] = useState("sending");
  const [text, setText] = useState(uiFixture ? "Had an apple and scrambled eggs for breakfast" : "");
  const [review, setReview] = useState(() => uiFixture && ["review", "saved-navigation-error"].includes(calmeraPreviewState)
    ? createMealReview([
      { foodName: "Eel Dragon Roll", quantity: "1 roll (8 pieces)", mealType: "Lunch", calories: 550, protein: 22, carbs: 68, fat: 22 },
      { foodName: "Miso Soup", quantity: "1 cup", mealType: "Lunch", calories: 40, protein: 3, carbs: 4, fat: 1 },
    ], userId, getLocalTimeWithOffset()) : null);
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const confirmedSave = useRef(null);
  if (!confirmedSave.current) confirmedSave.current = createConfirmedMealSave();
  const [savedStatus, setSavedStatus] = useState({ owner: null, saved: false });
  const mealSaved = savedStatus.owner === userId && savedStatus.saved;
  const previewSaves = useRef(0);
  const [previewSaveCount, setPreviewSaveCount] = useState(0);
  const operation = useRef(null);
  const routeGeneration = useRef(0);
  const focused = useRef(false);
  const focusedOwner = useRef(null);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    focusedOwner.current = userId;
    routeGeneration.current += 1;
    setBusy(false);
    setSelecting(false);
    setSavedStatus({ owner: userId, saved: confirmedSave.current.hasConfirmed(userId) });
    navigation.setOptions({ gestureEnabled: true });
    return () => {
      // A native picker does not change React Navigation focus. An actual route
      // exit cancels this operation and must never later dismiss another page.
      focused.current = false;
      focusedOwner.current = null;
      routeGeneration.current += 1;
      operation.current?.controller.abort();
      operation.current = null;
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [navigation, userId]));

  const isCurrent = ticket => focused.current && operation.current === ticket
    && ownerRef.current === ticket.owner && focusedOwner.current === ticket.owner
    && routeGeneration.current === ticket.generation && !ticket.controller.signal.aborted;
  const currentOwner = ticket => ownerRef.current === ticket.owner && store.belongsTo(ticket.owner);
  const hydrateConfirmed = ticket => {
    if (!focused.current || ownerRef.current !== ticket.owner || focusedOwner.current !== ticket.owner) return;
    setSavedStatus({ owner: ticket.owner, saved: true });
    const replacement = operation.current;
    if (replacement && replacement !== ticket && replacement.owner === ticket.owner && !replacement.leaving) {
      replacement.controller.abort();
      operation.current = null;
      setBusy(false); setSelecting(false);
      navigation.setOptions({ gestureEnabled: true });
    }
  };
  const beginOperation = kind => {
    if (uncertain || !focused.current || operation.current || ownerRef.current !== userId
      || focusedOwner.current !== userId || confirmedSave.current.hasConfirmed(userId)) return null;
    const ticket = { kind, owner: focusedOwner.current, generation: routeGeneration.current, controller: new AbortController() };
    operation.current = ticket;
    // Lock the native edge gesture in the same event as the JS operation lock,
    // rather than leaving a gap until disabled React props render.
    navigation.setOptions({ gestureEnabled: false });
    if (kind === "select") setSelecting(true);
    else setBusy(true);
    return ticket;
  };
  const finishOperation = ticket => {
    // Keep a confirmed-save ticket locked until navigation actually blurs the
    // page; a second native press can otherwise arrive in the pop transition.
    if (operation.current !== ticket || ticket.leaving) return;
    operation.current = null;
    if (!focused.current || ownerRef.current !== ticket.owner || focusedOwner.current !== ticket.owner
      || routeGeneration.current !== ticket.generation) return;
    setSelecting(false);
    setBusy(false);
    navigation.setOptions({ gestureEnabled: true });
  };
  const leaveLog = () => {
    if (operation.current || !focused.current || ownerRef.current !== userId || focusedOwner.current !== userId) return;
    try { exit(); }
    catch {
      if (focused.current && ownerRef.current === userId && focusedOwner.current === userId) {
        Alert.alert(confirmedSave.current.hasConfirmed(userId) ? "Meal saved" : "Couldn’t go back", "Please try going back again.");
      }
    }
  };
  const resetPreview = () => {
    if (!uiFixture || confirmedSave.current.hasConfirmed(userId)) return;
    operation.current?.controller.abort();
    operation.current = null;
    setSelecting(false);
    setBusy(false);
    navigation.setOptions({ gestureEnabled: true });
  };

  async function selectPhoto(source) {
    if (uiFixture) return;
    const ticket = beginOperation("select");
    if (!ticket) return;
    try {
      const selected = await pickMealPhoto(source);
      if (!isCurrent(ticket)) return;
      if (selected) { setPhoto(selected); setReview(null); setUncertain(false); }
    } catch (error) {
      if (!isCurrent(ticket)) return;
      // Normal picker cancellation returns null. Do not describe camera access
      // or picker failures as a ChatGPT connection problem or image-size issue.
      if (error?.code === "ERR_CANCELED" || error?.message === "photo_cancelled") return;
      Alert.alert(source === "camera" ? "Camera unavailable" : "Photo unavailable", source === "camera"
        ? "The camera isn’t available. Choose a meal photo from Photos instead."
        : "This photo could not be opened. Please choose another meal photo and try again.");
    } finally { finishOperation(ticket); }
  }

  usePreventRemove(Boolean((review || (textMode && text.trim())) && !mealSaved && !uncertain) || busy || selecting, ({ data }) => {
    if (confirmedSave.current.hasConfirmed(userId) || operation.current?.leaving) {
      navigation.dispatch(data.action);
      return;
    }
    if (operation.current) return;
    Alert.alert(review ? "Discard meal review?" : "Discard meal text?", "Your meal hasn’t been saved.", [
      { text: "Keep reviewing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const changePhoto = () => {
    if (operation.current || uncertain || mealSaved) return;
    Alert.alert("Change photo", "Choosing a new photo will replace this unsaved review.", [
      { text: "Camera", onPress: () => selectPhoto("camera") },
      { text: "Photos", onPress: () => selectPhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const changeInput = () => {
    if (!textMode) return changePhoto();
    if (operation.current || uncertain || mealSaved) return;
    Alert.alert("Edit meal text?", "This will replace your unsaved review when you analyze again.", [
      { text: "Keep reviewing", style: "cancel" },
      { text: "Edit text", onPress: () => setReview(null) },
    ]);
  };

  async function analyzeMeal() {
    if (!canAnalyzeMeal({ inputMode, photo, text, connection, busy, selecting, uncertain, mealSaved }) || confirmedSave.current.hasConfirmed(userId)) return;
    const ticket = beginOperation("estimate");
    if (!ticket) return;
    Keyboard.dismiss();
    setProgress("sending");
    const selectedPhoto = photo;
    const selectedText = text.trim();
    const createdAt = getLocalTimeWithOffset();
    try {
      let result;
      if (uiFixture) {
        result = [{ foodName: "Oat bar", quantity: "1 bar", mealType: "Snack", calories: 180, protein: 4, carbs: 28, fat: 6 }];
      } else {
        const ai = await mealAI(userId);
        if (!isCurrent(ticket)) return;
        result = await ai.estimate({ text: textMode ? selectedText : "", image: textMode ? undefined : selectedPhoto.dataURL,
          signal: ticket.controller.signal,
          onProgress: stage => { if (isCurrent(ticket)) setProgress(stage); } });
      }
      if (!isCurrent(ticket)) return;
      if (!result.length) throw new Error("no_food_detected");
      const entries = photoTestFixture ? result.map(entry => ({ ...entry, foodName: `${entry.foodName} - FOODWRAP PHOTO TEST` })) : result;
      // Estimation ends at an editable local draft. It cannot submit a meal.
      setReview(createMealReview(entries, ticket.owner, createdAt));
    } catch (error) {
      if (isCurrent(ticket)) {
        if (/no_food/.test(error?.message || "")) Alert.alert(NO_FOOD_DETECTED.title, noFoodMessage(inputMode));
        else { inferenceError(error, router); refreshConnection(); }
      }
    } finally { finishOperation(ticket); }
  }

  async function reestimateFood(id) {
    const values = review?.entries.find(entry => entry.id === id);
    if (!values?.foodName.trim() || !values.quantity.trim()) return;
    const ticket = beginOperation("estimate-item");
    if (!ticket) return;
    ticket.foodId = id;
    try {
      // The preview waits briefly and alternates its synthetic numbers, so the update is visible.
      const result = uiFixture ? await new Promise(resolve => setTimeout(() => resolve(Number(values.calories) === 180
        ? { calories: 150, protein: 3.5, carbs: 24, fat: 5 } : { calories: 180, protein: 4, carbs: 28, fat: 6 }), 700))
        : await estimateMacros(ticket.owner, values.foodName.trim(), values.quantity.trim(), { signal: ticket.controller.signal });
      if (!isCurrent(ticket)) return;
      const updated = { ...values, ...result, quantity: result.normalizedQuantity || values.quantity };
      setReview(current => updateReviewFood(current, id, updated));
    } catch (error) { if (isCurrent(ticket)) inferenceError(error, router); }
    finally { finishOperation(ticket); }
  }

  async function saveReview(mealType, reviewedDraft = review) {
    if (!MEAL_TYPES.includes(mealType) || !reviewedDraft?.entries.length || uncertain || confirmedSave.current.hasConfirmed(userId)) return;
    if (uiFixture && !savedNavigationFixture) return Alert.alert("Preview only", "Your review is ready. No meal was saved.");
    const ticket = beginOperation("save");
    if (!ticket) return;
    const draft = { ...reviewedDraft, mealType };
    let savedEntries = [];
    try {
      const outcome = await confirmedSave.current.run({
        key: ticket.owner,
        persist: async () => {
          if (savedNavigationFixture) {
            previewSaves.current += 1;
            if (isCurrent(ticket)) setPreviewSaveCount(previewSaves.current);
            return draft.entries;
          }
          // The save checks the ticket again right before it writes, so a stale review never saves.
          savedEntries = await saveMealReview(draft, ticket.owner, data,
            { signal: ticket.controller.signal, isActive: () => isCurrent(ticket) });
        },
        // Confirmed writes invalidate only their current owner's cache, even
        // after blur. A failed refresh or exit cannot undo the confirmed save.
        onConfirmed: () => {
          if (!uiFixture && savedEntries.length) rememberIcons(savedEntries, draft.entries).catch(() => {
            if (focused.current && ownerRef.current === ticket.owner) Alert.alert("Meal saved", "Your emoji choice could not be saved on this device.");
          });
          if (!savedNavigationFixture && currentOwner(ticket)) setShouldRefresh(true);
          // A late confirmation may belong to this owner’s refocused form,
          // while the old ticket must never navigate or alert that new focus.
          if (!isCurrent(ticket)) hydrateConfirmed(ticket);
          else setSavedStatus({ owner: ticket.owner, saved: true });
        },
        isCurrent: () => isCurrent(ticket),
        exit: () => {
          ticket.leaving = true;
          if (savedNavigationFixture) throw new Error("synthetic_navigation_failure");
          exit();
        },
      });
      if (outcome.kind !== "left" && operation.current === ticket) ticket.leaving = false;
      if (outcome.kind !== "left" && confirmedSave.current.hasConfirmed(ticket.owner)) hydrateConfirmed(ticket);
    } catch (error) {
      // Only inference/persistence failures reach this recovery path.
      if (operation.current === ticket) ticket.leaving = false;
      const message = error?.message || "";
      const mayHaveSaved = error?.mayHaveSaved === true || message === "meal_save_uncertain"
        || Boolean(error?.savedEntries?.length);
      if (mayHaveSaved && !savedNavigationFixture && currentOwner(ticket)) setShouldRefresh(true);
      if (!isCurrent(ticket)) return;
      if (mayHaveSaved) {
        setUncertain(true);
        inferenceError(error, router);
      } else if (/meal_save/.test(message)) {
        Alert.alert("Couldn’t save meal", "Your meal was not saved. Your review is still here. Please try again.");
      } else inferenceError(error, router);
    } finally { finishOperation(ticket); }
  }

  const canChangeDraft = () => focused.current && !operation.current && !uncertain
    && !confirmedSave.current.hasConfirmed(userId) && ownerRef.current === userId;
  if (review) return <MealReview photo={textMode ? null : photo} text={text} review={review}
    setReview={value => { if (canChangeDraft()) setReview(value); }}
    estimating={operation.current?.kind === "estimate-item" ? operation.current.foodId : null}
    busy={busy} selecting={selecting} uncertain={uncertain} mealSaved={mealSaved}
    onBack={leaveLog} onSave={saveReview} onChangeInput={changeInput} onReestimate={reestimateFood}
    onViewMeals={() => { if (!operation.current) router.replace("/dashboard"); }} />;

  const connectionCopy = connectionPresentation(connection);
  return (
    <FormScreen compactControls style={styles.container}>
      <FormHeader title={textMode ? "Text Log" : "Photo Log"} onBack={leaveLog} backDisabled={busy || selecting} />
      <FormScrollView keyboardAware key={`meal-text-${fontScale}`} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" extraScrollHeight={20} enableResetScrollToCoords={false}>
        <View style={styles.sections}>
        {uiFixture && (
          <Text style={styles.fixtureNote}>
            {savedNavigationFixture ? "Synthetic navigation check · nothing is sent or saved." : "UI preview · Photo access and saving are disabled."}
          </Text>
        )}
        {textMode ? <FormCard>
          <Text style={styles.placeholderTitle}>What did you eat?</Text>
          <TextInput inputAccessoryViewID={Platform.OS === "ios" ? textAccessoryId : undefined} accessibilityLabel="Meal description" multiline value={text} onChangeText={setText} maxLength={3000}
            editable={!busy && !mealSaved && !uncertain} placeholder="e.g. 1 apple, or 2 eggs on toast for breakfast"
            placeholderTextColor={COLORS.textLight} style={styles.mealText} textAlignVertical="top" />
        </FormCard> : <FormCard style={styles.previewCard}>
          <View style={[styles.preview, photo && styles.previewWithPhoto]}>
            {photo ? (
              <Image source={{ uri: photo.dataURL }} style={styles.photo} accessibilityLabel="Selected meal photo" />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="image-outline" size={34} color={COLORS.textLight} accessible={false} />
                <Text style={styles.placeholderTitle}>Add a meal photo</Text>
              </View>
            )}
          </View>
          <View style={[styles.actions, fontScale >= 1.3 && styles.actionsStacked]}>
            <GlassButton
              title="Camera"
              symbol="camera"
              accessibilityLabel="Take photo"
              style={styles.option}
              onPress={() => selectPhoto("camera")}
              disabled={busy || selecting || uiFixture || mealSaved || uncertain}
            />
            <GlassButton
              title="Photos"
              symbol="photo.on.rectangle"
              accessibilityLabel="Choose photo"
              style={styles.option}
              onPress={() => selectPhoto("library")}
              disabled={busy || selecting || uiFixture || mealSaved || uncertain}
            />
          </View>
        </FormCard>}

        <View style={styles.footer}>
          {mealSaved && (
            <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle-outline" size={23} color={COLORS.primary} accessible={false} />
              <Text style={styles.statusTitle}>Meal saved</Text>
            </View>
          )}
          {savedNavigationFixture && <Text style={styles.statusDetail}>Synthetic saves: {previewSaveCount}</Text>}
          {uncertain && (
            <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
              <Ionicons name="information-circle-outline" size={23} color={COLORS.primary} />
              <Text style={styles.statusTitle}>Check your meals before trying again</Text>
            </View>
          )}
          {!mealSaved && !uncertain && <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
            {(busy || connection.state === "checking")
              ? <ActivityIndicator size="small" color={COLORS.textLight} accessible={false} />
              : <View style={[styles.connectionIndicator, { backgroundColor: connection.state === "ready" ? "#2E7D32" : "#C12D26" }]} accessible={false} />}
            <Text style={[styles.statusTitle, { flex: 1 }]}>{busy ? estimationTitle(progress, inputMode) : connectionCopy.title}</Text>
          </View>}
          {!busy && connectionCopy.action && <GlassButton
            title={connectionCopy.actionLabel}
            onPress={() => connectionCopy.action === "choose" ? router.push("/ai-connection") : ["sign-in", "settings"].includes(connectionCopy.action) ? router.push("/chatgpt") : connectionCopy.action === "usage"
              ? Linking.openURL("https://chatgpt.com/settings/usage").catch(() => {}) : refreshConnection()}
            disabled={selecting || mealSaved || uncertain} />}
          <GlassButton
            title={busy ? "Analyzing…" : "Analyze Meal"}
            symbol="sparkles"
            role="accent"
            onPress={analyzeMeal}
            loading={busy}
            disabled={!canAnalyzeMeal({ inputMode, photo, text, connection, busy, selecting, uncertain, mealSaved })}
            style={styles.logButton}
            accessibilityLabel={busy ? "Analyzing meal" : "Analyze Meal"}
          />
          {mealSaved && <GlassButton title="Go back" symbol="chevron.left" onPress={leaveLog} disabled={busy || selecting} style={styles.logButton} />}
          {uncertain && (
            <GlassButton title="View meals" symbol="clock" onPress={() => { if (!operation.current) router.replace("/dashboard"); }} disabled={busy || selecting} style={styles.logButton} />
          )}
          {uiFixture && !savedNavigationFixture && busy && (
            <GlassButton title="Reset preview" symbol="arrow.counterclockwise" onPress={resetPreview} style={styles.logButton} />
          )}
          <View style={styles.privacy}>
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.textLight} accessible={false} />
            <Text style={styles.note}>{`Only your ${textMode ? "meal description" : "selected photo"} is analyzed by ${providerName(connection.type)}. Nutrition estimates are approximate.`}</Text>
          </View>
        </View>
        </View>
      </FormScrollView>
      {textMode && Platform.OS === "ios" && <InputAccessoryView nativeID={textAccessoryId} backgroundColor={COLORS.card}>
        <View style={styles.keyboardBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => Keyboard.dismiss()} style={styles.keyboardDone}>
            <Text style={styles.keyboardDoneText}>Done</Text>
          </Pressable>
        </View>
      </InputAccessoryView>}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  keyboardBar: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EAE2DB", alignItems: "flex-end" },
  keyboardDone: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  keyboardDoneText: { ...TYPOGRAPHY.button, color: COLORS.primary },
  mealText: { ...TYPOGRAPHY.input, minHeight: 120, color: COLORS.text, padding: 0 },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingHorizontal: 8 },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  sections: { gap: 16 },
  previewCard: { padding: 12, gap: 14 },
  preview: { borderRadius: 22, overflow: "hidden", backgroundColor: "#F6F1EC" },
  previewWithPhoto: { aspectRatio: 1.15 },
  photo: { width: "100%", height: "100%", resizeMode: "contain" },
  placeholder: { minHeight: 216, alignItems: "center", justifyContent: "center", padding: 20, gap: 12 },
  placeholderTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text, textAlign: "center"},
  actions: { flexDirection: "row", gap: 12, paddingBottom: 2 },
  actionsStacked: { flexDirection: "column" },
  option: { flex: 1, minHeight: 50 },
  footer: { gap: 12 },
  logButton: { minHeight: 52 },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textLight, flex: 1},
  status: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, paddingVertical: 5 },
  connectionIndicator: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 5 },
  statusTitle: { ...TYPOGRAPHY.button, color: COLORS.text,},
  statusDetail: { ...TYPOGRAPHY.caption, color: COLORS.textLight,},
  fixtureNote: { ...TYPOGRAPHY.caption, color: COLORS.primary, textAlign: "center"},
});
