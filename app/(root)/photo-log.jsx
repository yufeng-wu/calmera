import { TYPOGRAPHY } from "@/constants/typography";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import usePageExit from "@/hooks/usePageExit";
import { FormScreen, FormScrollView, FormHeader, FormCard, GlassButton } from "@/components/GlassForm";
import { phoneTestNutritionLabel } from "@/lib/chatgpt/phoneTestFixtures.mjs";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { pickMealPhoto } from "@/lib/chatgpt/planClient";
import { nutritionClient, inferenceError } from "@/lib/chatgpt/nutrition";
import { saveEstimatedEntries } from "@/lib/chatgpt/entryPersistence.mjs";
import { getLocalTimeWithOffset } from "@/lib/utils";

export default function PhotoLogScreen({ calmeraPreview = false, calmeraPreviewState = "empty" } = {}) {
  const router = useRouter();
  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();
  const { calmeraFixture } = useLocalSearchParams();
  const testBuild = Constants.expoConfig?.extra?.calmeraFullAppTest === true;
  const photoTestFixture = testBuild && calmeraFixture === "label-phone";
  const uiFixture = testBuild && (calmeraPreview || ["ui-photo-empty", "ui-photo-preview"].includes(calmeraFixture));
  const previewFixture = uiFixture && (calmeraFixture === "ui-photo-preview" || (calmeraPreview && calmeraPreviewState === "selected"));
  const exit = usePageExit(uiFixture ? "/ui-gallery" : "/dashboard");
  const { userId, getToken } = useAuth();
  const { setShouldRefresh } = useRefreshSignal();
  const [photo, setPhoto] = useState(photoTestFixture || previewFixture
    ? { dataURL: phoneTestNutritionLabel, syntheticFixture: true }
    : null);
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [processingStep, setProcessingStep] = useState("Estimating nutrition…");
  const [uncertain, setUncertain] = useState(false);
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
    && focusedOwner.current === ticket.owner && routeGeneration.current === ticket.generation && !ticket.controller.signal.aborted;
  const beginOperation = kind => {
    if (!focused.current || operation.current) return null;
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
    if (!focused.current || routeGeneration.current !== ticket.generation) return;
    setSelecting(false);
    setBusy(false);
    navigation.setOptions({ gestureEnabled: true });
  };
  const leavePhoto = () => { if (!operation.current) exit(); };
  const resetPreview = () => {
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
      if (selected) { setPhoto(selected); setUncertain(false); }
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

  async function logPhoto() {
    if (!photo || uncertain) return;
    const ticket = beginOperation("log");
    if (!ticket) return;
    if (uiFixture) {
      setProcessingStep("Preview only. No photo is sent or saved.");
      return;
    }
    const selectedPhoto = photo;
    setProcessingStep("Estimating nutrition…");
    try {
      const createdAt = getLocalTimeWithOffset();
      const { client, model } = await nutritionClient(userId);
      if (!isCurrent(ticket)) return;
      const result = await client.estimate({ text: "", image: selectedPhoto.dataURL, model,
        signal: ticket.controller.signal });
      if (!isCurrent(ticket)) return;
      const entries = selectedPhoto.syntheticFixture ? result.map(entry => ({
        ...entry, foodName: `${entry.foodName} - CALMERA PHONE PHOTO TEST 2026-10-18`,
      })) : result;
      if (!entries.length) throw new Error("no_food_detected");
      setProcessingStep("Saving your meal…");
      await saveEstimatedEntries(entries, { createdAt, url: FOOD_ENTRIES_API_URL,
        signal: ticket.controller.signal,
        getToken: async () => {
          const token = await getToken();
          if (!isCurrent(ticket)) throw new Error("photo_operation_cancelled");
          return token;
        },
      });
      // Confirmed/potential writes still invalidate the cache if the route was
      // externally removed; stale work cannot show alerts or navigate afterward.
      setShouldRefresh(true);
      if (isCurrent(ticket)) {
        ticket.leaving = true;
        exit();
      }
    } catch (error) {
      // A failed navigation dispatch must still release the operation lock.
      if (operation.current === ticket) ticket.leaving = false;
      const message = error?.message || "";
      const mayHaveSaved = error?.mayHaveSaved === true || message === "meal_save_uncertain"
        || Boolean(error?.savedEntries?.length);
      if (mayHaveSaved) setShouldRefresh(true);
      if (!isCurrent(ticket)) return;
      if (mayHaveSaved) {
        setUncertain(true);
        inferenceError(error, router);
      } else if (/meal_save/.test(message)) {
        const reason = error?.reason || message;
        if (/sign_in|refresh|401|development_build/.test(reason)) inferenceError({ message: reason }, router);
        else Alert.alert("Couldn’t save meal", error?.timedOut
          ? "Saving took too long. Your photo is still here. Please try again."
          : "Your meal was not saved. Your photo is still here. Please try again.");
      } else inferenceError(error, router);
    } finally { finishOperation(ticket); }
  }

  return (
    <FormScreen style={styles.container}>
      <FormHeader title="Photo" onBack={leavePhoto} backDisabled={busy || selecting} />
      <FormScrollView key={`photo-text-${fontScale}`} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {uiFixture && (
          <Text style={styles.fixtureNote}>
            UI preview · Photo access and saving are disabled.
          </Text>
        )}
        <View style={styles.intro}>
          <Text style={styles.title}>A photo of your meal</Text>
          <Text style={styles.subtitle}>Take a photo or choose one from Photos.</Text>
        </View>

        <FormCard style={styles.previewCard}>
          <View style={[styles.preview, photo && styles.previewWithPhoto]}>
            {photo ? (
              <Image source={{ uri: photo.dataURL }} style={styles.photo} accessibilityLabel="Selected meal photo" />
            ) : (
              <View style={styles.placeholder}>
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera-outline" size={38} color={COLORS.primary} />
                </View>
                <Text style={styles.placeholderTitle}>Your meal goes here</Text>
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
              disabled={busy || selecting || uiFixture}
            />
            <GlassButton
              title="Photos"
              symbol="photo.on.rectangle"
              accessibilityLabel="Choose photo"
              style={styles.option}
              onPress={() => selectPhoto("library")}
              disabled={busy || selecting || uiFixture}
            />
          </View>
        </FormCard>

        <View style={styles.footer}>
          {selecting && <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.statusDetail}>Preparing your photo…</Text>
          </View>}
          {busy && (
            <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
              <ActivityIndicator color={COLORS.primary} />
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>Processing…</Text>
                <Text style={styles.statusDetail}>{processingStep}</Text>
              </View>
            </View>
          )}
          {uncertain && (
            <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
              <Ionicons name="information-circle-outline" size={23} color={COLORS.primary} />
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>Check History</Text>
                <Text style={styles.statusDetail}>Your meal may already be saved. Check History before trying again.</Text>
              </View>
            </View>
          )}
          <GlassButton
            title={uiFixture ? "Preview processing" : "Log photo"}
            symbol="sparkles"
            role="accent"
            onPress={logPhoto}
            loading={busy}
            disabled={!photo || busy || selecting || uncertain}
            style={styles.logButton}
            accessibilityLabel={uiFixture ? "Preview processing without sending or saving" : "Estimate and log photo with ChatGPT"}
          />
          {uncertain && (
            <GlassButton title="View History" symbol="clock" onPress={() => { if (!operation.current) router.replace("/history"); }} disabled={busy || selecting} style={styles.logButton} />
          )}
          {uiFixture && busy && (
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
  intro: { gap: 8, paddingHorizontal: 4 },
  title: { ...TYPOGRAPHY.pageTitle, color: COLORS.text,},
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textLight,},
  previewCard: { padding: 12, gap: 14 },
  preview: { borderRadius: 22, overflow: "hidden", backgroundColor: "#F6F1EC" },
  previewWithPhoto: { aspectRatio: 1.15 },
  photo: { width: "100%", height: "100%", resizeMode: "contain" },
  placeholder: { minHeight: 216, alignItems: "center", justifyContent: "center", padding: 20, gap: 10 },
  cameraBadge: { width: 78, height: 78, borderRadius: 39, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", marginBottom: 3 },
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
