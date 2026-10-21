import { TYPOGRAPHY } from "@/constants/typography";
import { useCallback, useRef, useState } from "react";
import { Alert, Image, Linking, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect, useNavigation, usePreventRemove } from "@react-navigation/native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import usePhotoLogConnection from "@/hooks/usePhotoLogConnection";
import { canEstimatePhoto, photoConnectionPresentation, PHOTO_ESTIMATION_PROGRESS, NO_FOOD_DETECTED } from "@/lib/photoLogPresentation.mjs";
import usePageExit from "@/hooks/usePageExit";
import { FormScreen, FormScrollView, FormHeader, FormCard, GlassButton } from "@/components/GlassForm";
import { phoneTestNutritionLabel } from "@/lib/chatgpt/phoneTestFixtures.mjs";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { pickMealPhoto } from "@/lib/chatgpt/planClient";
import { nutritionClient, inferenceError, estimateMacros } from "@/lib/chatgpt/nutrition";
import PhotoMealReview from "@/components/PhotoMealReview";
import { createPhotoMealReview, savePhotoMealReview, PHOTO_MEAL_TYPES } from "@/lib/photoMealReview.mjs";
import { createConfirmedMealSave } from "@/lib/confirmedMealSave.mjs";
import { getLocalTimeWithOffset } from "@/lib/utils";

export default function PhotoLogScreen(props) {
  const { userId } = useAuth();
  return <PhotoLogForm key={userId || "signed-out"} {...props} />;
}

function PhotoLogForm({ calmeraPreview = false, calmeraPreviewState = "empty" } = {}) {
  const router = useRouter();
  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();
  const { calmeraFixture } = useLocalSearchParams();
  const testBuild = Constants.expoConfig?.extra?.calmeraFullAppTest === true;
  const photoTestFixture = testBuild && calmeraFixture === "label-phone";
  const uiFixture = testBuild && (calmeraPreview || ["ui-photo-empty", "ui-photo-preview"].includes(calmeraFixture));
  const savedNavigationFixture = testBuild && calmeraPreview && calmeraPreviewState === "saved-navigation-error";
  const previewFixture = uiFixture && (savedNavigationFixture || calmeraFixture === "ui-photo-preview" || (calmeraPreview && calmeraPreviewState === "selected"));
  const exit = usePageExit(uiFixture ? "/ui-gallery" : "/dashboard");
  const { userId, getToken } = useAuth();
  const { store, setShouldRefresh } = useRefreshSignal();
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const [photo, setPhoto] = useState(photoTestFixture || previewFixture
    ? { dataURL: phoneTestNutritionLabel, syntheticFixture: true }
    : null);
  const { connection, refresh: refreshConnection } = usePhotoLogConnection(userId, uiFixture);
  const [progress, setProgress] = useState("preparing");
  const [review, setReview] = useState(null);
  const [editor, setEditor] = useState(null);
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
  const leavePhoto = () => {
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
      if (selected) { setPhoto(selected); setReview(null); setEditor(null); setUncertain(false); }
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

  usePreventRemove(Boolean(review && !mealSaved && !uncertain) || busy || selecting, ({ data }) => {
    if (confirmedSave.current.hasConfirmed(userId) || operation.current?.leaving) {
      navigation.dispatch(data.action);
      return;
    }
    if (operation.current) return;
    if (editor) { setEditor(null); return; }
    Alert.alert("Discard meal review?", "Your foods haven’t been saved.", [
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

  async function estimatePhoto() {
    if (!canEstimatePhoto({ photo, connection, busy, selecting, uncertain, mealSaved }) || confirmedSave.current.hasConfirmed(userId)) return;
    const ticket = beginOperation("estimate");
    if (!ticket) return;
    setProgress("preparing");
    const selectedPhoto = photo;
    const createdAt = getLocalTimeWithOffset();
    try {
      let result;
      if (uiFixture) {
        result = [{ foodName: "Oat bar", quantity: "1 bar", mealType: "Snack", calories: 180, protein: 4, carbs: 28, fat: 6 }];
      } else {
        const { client, model } = await nutritionClient(userId);
        if (!isCurrent(ticket)) return;
        result = await client.estimate({ text: "", image: selectedPhoto.dataURL, model, signal: ticket.controller.signal,
          onProgress: stage => { if (isCurrent(ticket)) setProgress(stage); } });
      }
      if (!isCurrent(ticket)) return;
      if (!result.length) throw new Error("no_food_detected");
      const entries = photoTestFixture ? result.map(entry => ({ ...entry, foodName: `${entry.foodName} - FOODWRAP PHOTO TEST` })) : result;
      // Estimation ends at an editable local draft. It cannot submit a meal.
      setReview(createPhotoMealReview(entries, ticket.owner, createdAt));
    } catch (error) {
      if (isCurrent(ticket)) {
        if (/no_food/.test(error?.message || "")) Alert.alert(NO_FOOD_DETECTED.title, NO_FOOD_DETECTED.message);
        else { inferenceError(error, router); refreshConnection(); }
      }
    } finally { finishOperation(ticket); }
  }

  async function reestimateFood() {
    if (!editor || !editor.values.foodName.trim() || !editor.values.quantity.trim()) return;
    const ticket = beginOperation("estimate-item");
    if (!ticket) return;
    const values = editor.values;
    try {
      const result = uiFixture ? { calories: 180, protein: 4, carbs: 28, fat: 6 }
        : await estimateMacros(ticket.owner, values.foodName.trim(), values.quantity.trim(), { signal: ticket.controller.signal });
      if (!isCurrent(ticket)) return;
      const quantity = result.normalizedQuantity || values.quantity;
      setEditor(current => current ? { ...current, values: { ...current.values, quantity,
        ...Object.fromEntries(["calories", "protein", "carbs", "fat"].map(key => [key, String(result[key])])) },
        estimated: { foodName: values.foodName, quantity } } : current);
    } catch (error) { if (isCurrent(ticket)) inferenceError(error, router); }
    finally { finishOperation(ticket); }
  }

  async function saveReview(mealType, reviewedDraft = review) {
    if (!PHOTO_MEAL_TYPES.includes(mealType) || !reviewedDraft?.entries.length || uncertain || confirmedSave.current.hasConfirmed(userId)) return;
    if (uiFixture && !savedNavigationFixture) return Alert.alert("Preview only", "Your review is ready. No meal was saved.");
    const ticket = beginOperation("save");
    if (!ticket) return;
    const draft = { ...reviewedDraft, mealType };
    try {
      const outcome = await confirmedSave.current.run({
        key: ticket.owner,
        persist: async () => {
          if (savedNavigationFixture) {
            previewSaves.current += 1;
            if (isCurrent(ticket)) setPreviewSaveCount(previewSaves.current);
            return draft.entries;
          }
          return savePhotoMealReview(draft, ticket.owner, { url: FOOD_ENTRIES_API_URL,
            signal: ticket.controller.signal, isActive: () => isCurrent(ticket),
            getToken: async () => {
              if (!isCurrent(ticket)) throw new Error("photo_operation_cancelled");
              const token = await getToken();
              if (!isCurrent(ticket)) throw new Error("photo_operation_cancelled");
              return token;
            },
          });
        },
        // Confirmed writes invalidate only their current owner's cache, even
        // after blur. A failed refresh or exit cannot undo the confirmed save.
        onConfirmed: () => {
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
        const reason = error?.reason || message;
        if (/sign_in|refresh|401|development_build/.test(reason)) inferenceError({ message: reason }, router);
        else Alert.alert("Couldn’t save meal", error?.timedOut
          ? "Saving took too long. Your review is still here. Please try again."
          : "Your meal was not saved. Your review is still here. Please try again.");
      } else inferenceError(error, router);
    } finally { finishOperation(ticket); }
  }

  const canChangeDraft = () => focused.current && !operation.current && !uncertain
    && !confirmedSave.current.hasConfirmed(userId) && ownerRef.current === userId;
  if (review) return <PhotoMealReview photo={photo} review={review} setReview={value => { if (canChangeDraft()) setReview(value); }}
    estimating={operation.current?.kind === "estimate-item"} editor={editor} setEditor={value => { if (canChangeDraft()) setEditor(value); }} busy={busy} selecting={selecting} uncertain={uncertain} mealSaved={mealSaved}
    onBack={leavePhoto} onSave={saveReview} onChangePhoto={changePhoto} onReestimate={reestimateFood}
    onViewHistory={() => { if (!operation.current) router.replace("/history"); }} />;

  const connectionCopy = photoConnectionPresentation(connection);
  const progressCopy = PHOTO_ESTIMATION_PROGRESS[progress] || PHOTO_ESTIMATION_PROGRESS.preparing;
  return (
    <FormScreen style={styles.container}>
      <FormHeader title="Photo Log" onBack={leavePhoto} backDisabled={busy || selecting} />
      <FormScrollView key={`photo-text-${fontScale}`} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {uiFixture && (
          <Text style={styles.fixtureNote}>
            {savedNavigationFixture ? "Synthetic navigation check · nothing is sent or saved." : "UI preview · Photo access and saving are disabled."}
          </Text>
        )}
        <FormCard style={styles.previewCard}>
          <View style={[styles.preview, photo && styles.previewWithPhoto]}>
            {photo ? (
              <Image source={{ uri: photo.dataURL }} style={styles.photo} accessibilityLabel="Selected meal photo" />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderTitle}>Take a photo or upload one</Text>
                <Text style={styles.placeholderNote}>Include the whole plate for a clearer estimate.</Text>
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
        </FormCard>

        <View style={styles.footer}>
          {mealSaved && (
            <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle-outline" size={23} color={COLORS.primary} accessible={false} />
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>Meal saved</Text>
                <Text style={styles.statusDetail}>Go back to continue.</Text>
              </View>
            </View>
          )}
          {savedNavigationFixture && <Text style={styles.statusDetail}>Synthetic saves: {previewSaveCount}</Text>}
          {uncertain && (
            <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
              <Ionicons name="information-circle-outline" size={23} color={COLORS.primary} />
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>Check History</Text>
                <Text style={styles.statusDetail}>Your meal may already be saved. Check History before trying again.</Text>
              </View>
            </View>
          )}
          {!mealSaved && !uncertain && <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
            <Ionicons name={busy ? "sync-outline" : connectionCopy.icon} size={23} color={COLORS.primary} accessible={false} />
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>{busy ? progressCopy.title : connectionCopy.title}</Text>
              <Text style={styles.statusDetail}>{busy ? progressCopy.detail : connection.state === "ready" && photo
                ? "Connected to OpenAI. Your photo is ready to estimate." : connectionCopy.detail}</Text>
            </View>
          </View>}
          {!busy && connectionCopy.action && <GlassButton
            title={connectionCopy.action === "sign-in" ? "Connect ChatGPT" : connectionCopy.action === "usage" ? "Manage usage" : "Check connection again"}
            onPress={() => connectionCopy.action === "sign-in" ? router.push("/chatgpt") : connectionCopy.action === "usage"
              ? Linking.openURL("https://chatgpt.com/settings/usage").catch(() => {}) : refreshConnection()}
            disabled={selecting || mealSaved || uncertain} />}
          <GlassButton
            title={busy ? "Estimating…" : "Estimate Nutrition"}
            symbol="sparkles"
            role="accent"
            onPress={estimatePhoto}
            loading={busy}
            disabled={!canEstimatePhoto({ photo, connection, busy, selecting, uncertain, mealSaved })}
            style={styles.logButton}
            accessibilityLabel={busy ? "Estimating nutrition" : "Estimate nutrition from photo"}
          />
          {mealSaved && <GlassButton title="Go back" symbol="chevron.left" onPress={leavePhoto} disabled={busy || selecting} style={styles.logButton} />}
          {uncertain && (
            <GlassButton title="View History" symbol="clock" onPress={() => { if (!operation.current) router.replace("/history"); }} disabled={busy || selecting} style={styles.logButton} />
          )}
          {uiFixture && !savedNavigationFixture && busy && (
            <GlassButton title="Reset preview" symbol="arrow.counterclockwise" onPress={resetPreview} style={styles.logButton} />
          )}
          <Text style={styles.note}>
            Using your ChatGPT plan. Only this selected photo goes to OpenAI. Food estimates are approximate.
          </Text>
        </View>
      </FormScrollView>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 16 },
  previewCard: { padding: 12, gap: 14 },
  preview: { borderRadius: 22, overflow: "hidden", backgroundColor: "#F6F1EC" },
  previewWithPhoto: { aspectRatio: 1.15 },
  photo: { width: "100%", height: "100%", resizeMode: "contain" },
  placeholder: { minHeight: 216, alignItems: "center", justifyContent: "center", padding: 20, gap: 10 },
  placeholderTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text, textAlign: "center"},
  placeholderNote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center", maxWidth: 230},
  actions: { flexDirection: "row", gap: 12, paddingBottom: 2 },
  actionsStacked: { flexDirection: "column" },
  option: { flex: 1, minHeight: 50 },
  footer: { gap: 12 },
  logButton: { minHeight: 52 },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center", paddingHorizontal: 8, marginTop: 2},
  status: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, paddingVertical: 5 },
  statusCopy: { flex: 1, gap: 3 },
  statusTitle: { ...TYPOGRAPHY.button, color: COLORS.text,},
  statusDetail: { ...TYPOGRAPHY.caption, color: COLORS.textLight,},
  fixtureNote: { ...TYPOGRAPHY.caption, color: COLORS.primary, textAlign: "center"},
});
