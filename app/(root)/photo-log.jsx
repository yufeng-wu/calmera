import { TYPOGRAPHY } from "@/constants/typography";
import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  const [processingStep, setProcessingStep] = useState("Analyzing your meal photo…");
  const [uncertain, setUncertain] = useState(false);

  async function selectPhoto(source) {
    if (busy || uiFixture) return;
    try {
      const selected = await pickMealPhoto(source);
      if (selected) { setPhoto(selected); setUncertain(false); }
    } catch (error) { inferenceError(error, router); }
  }

  async function logPhoto() {
    if (!photo || busy || uncertain) return;
    if (uiFixture) {
      setProcessingStep("Preview only. No photo is sent or saved.");
      setBusy(true);
      return;
    }
    setProcessingStep("Analyzing your meal photo…");
    setBusy(true);
    const createdAt = getLocalTimeWithOffset();
    try {
      const { client, model } = await nutritionClient(userId);
      const result = await client.estimate({ text: "", image: photo.dataURL, model });
      const entries = photo.syntheticFixture ? result.map(entry => ({
        ...entry, foodName: `${entry.foodName} - CALMERA PHONE PHOTO TEST 2026-10-18`,
      })) : result;
      if (!entries.length) throw new Error("no_food_detected");
      setProcessingStep("Saving your meal…");
      await saveEstimatedEntries(entries, { createdAt, getToken, url: FOOD_ENTRIES_API_URL });
      setShouldRefresh(true);
      if (router.canGoBack()) router.back();
      else router.replace("/dashboard");
    } catch (error) {
      if (/meal_save/.test(error.message)) { setUncertain(true); setShouldRefresh(true); }
      inferenceError(error, router);
    } finally { setBusy(false); }
  }

  return (
    <FormScreen style={styles.container}>
      <FormHeader title="Photo" onBack={exit} backDisabled={busy} />
      <FormScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {uiFixture && (
          <Text style={styles.fixtureNote}>
            UI preview · Photo access and saving are disabled.
          </Text>
        )}
        <View style={styles.intro}>
          <Text style={styles.title}>A photo of your meal</Text>
          <Text style={styles.subtitle}>Take a photo or choose one to get started.</Text>
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
              disabled={busy || uiFixture}
            />
            <GlassButton
              title="Photos"
              symbol="photo.on.rectangle"
              accessibilityLabel="Choose photo"
              style={styles.option}
              onPress={() => selectPhoto("library")}
              disabled={busy || uiFixture}
            />
          </View>
        </FormCard>

        <View style={styles.footer}>
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
                <Text style={styles.statusTitle}>Check History before retrying</Text>
                <Text style={styles.statusDetail}>Your meal may already be saved. Check it first to avoid a duplicate.</Text>
              </View>
            </View>
          )}
          <GlassButton
            title={uncertain ? "Check History before retrying" : uiFixture ? "Preview processing" : "Log photo"}
            symbol="sparkles"
            role="accent"
            onPress={logPhoto}
            loading={busy}
            disabled={!photo || busy || uncertain}
            style={styles.logButton}
            accessibilityLabel={uiFixture ? "Preview processing without sending or saving" : "Estimate and log photo with ChatGPT"}
          />
          {uncertain && (
            <GlassButton title="View History" symbol="clock" onPress={() => router.replace("/history")} style={styles.logButton} />
          )}
          {uiFixture && busy && (
            <GlassButton title="Reset preview" symbol="arrow.counterclockwise" onPress={() => setBusy(false)} style={styles.logButton} />
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
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 20 },
  intro: { gap: 7, paddingHorizontal: 4 },
  title: { ...TYPOGRAPHY.pageTitle, color: COLORS.text,},
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textLight,},
  previewCard: { padding: 12, gap: 14 },
  preview: { borderRadius: 22, overflow: "hidden", backgroundColor: "#F6F1EC" },
  previewWithPhoto: { aspectRatio: 1.15 },
  photo: { width: "100%", height: "100%", resizeMode: "contain" },
  placeholder: { minHeight: 280, alignItems: "center", justifyContent: "center", padding: 20, gap: 10 },
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
