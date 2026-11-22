import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FormHeader, FormScreen, FormScrollView, GlassButton } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import { SETTINGS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { useAppReset } from "@/context/AppResetContext";
import usePageExit from "@/hooks/usePageExit";
import { eraseAllData } from "@/lib/eraseDevice";
import { useDataStore } from "@/lib/store";

// Review stages show each state with synthetic outcomes; nothing is erased.
const previewPhase = (stage) => ({ "erase-data-erasing": "erasing", "erase-data-failed": "failed", "erase-data-done": "done" })[stage] || "idle";

// What will be erased, a way to keep a copy first, and one confirmed button. Afterwards
// calmera starts over on this iPhone, from the privacy agreement on.
export default function EraseData({ calmeraPreview = false, calmeraPreviewStage }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/settings");
  const router = useRouter();
  const data = useDataStore();
  const { resetApp } = useAppReset();
  const [phase, setPhase] = useState(() => calmeraPreview ? previewPhase(calmeraPreviewStage) : "idle");
  const busy = phase === "erasing";

  const run = async () => {
    setPhase("erasing");
    try {
      const failures = calmeraPreview ? await new Promise((resolve) => setTimeout(() => resolve([]), 1200)) : await eraseAllData(data);
      if (failures.length) throw new Error("erase_incomplete");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPhase("done");
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPhase("failed");
    }
  };
  const confirm = () => Alert.alert("Erase all data?",
    "Your meals, goals and settings will be removed from this iPhone for good. This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Erase", style: "destructive", onPress: run },
    ]);
  const startOver = () => calmeraPreview ? leave() : resetApp();

  if (phase === "done") return <FormScreen>
    <FormHeader title="Erase all data" />
    <FormScrollView contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      {calmeraPreview && <Text style={settingsStyles.footnote}>Synthetic preview · nothing was erased</Text>}
      <View accessible accessibilityLiveRegion="polite" style={styles.done}>
        <Ionicons name="checkmark-circle" size={44} color={SETTINGS.ink} />
        <Text accessibilityRole="header" style={styles.doneTitle}>Everything is erased</Text>
        <Text style={styles.doneBody}>Your meals, goals and settings are gone from this iPhone, and your AI connection with them.</Text>
      </View>
      <GlassButton title="Start Over" role="accent" onPress={startOver} />
    </FormScrollView>
  </FormScreen>;

  return <FormScreen>
    <FormHeader title="Erase all data" onBack={leave} backDisabled={busy} />
    <FormScrollView contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false} pointerEvents={busy ? "none" : "auto"}>
      {calmeraPreview && <Text style={settingsStyles.footnote}>Synthetic preview · nothing is erased</Text>}
      <Text style={settingsStyles.lead}>This erases everything calmera keeps on this iPhone. It can’t be undone.</Text>
      <SettingsSection label="What’s erased" footnote="Copies in iCloud backups follow your backup settings.">
        <SettingsRow title="Meals you’ve logged" icon="restaurant" tint="leaf" />
        <SettingsRow title="Goals" icon="flag" tint="sky" divider />
        <SettingsRow title="Settings" subtitle="Theme, voice language, food icons and AI usage" icon="options" tint="plum" divider />
        <SettingsRow title="AI connection" subtitle="Your ChatGPT sign-in or API key" icon="link" tint="plum" divider />
      </SettingsSection>
      <SettingsSection label="Before you go" footnote="Keep a copy of your meals and goals first, if you’d like one.">
        <SettingsRow title="Export your data" icon="share" tint="tangerine" disabled={busy}
          onPress={() => calmeraPreview ? Alert.alert("Preview only", "Export opens from Settings in the app.") : router.push("/export-data")} />
      </SettingsSection>
      <View style={styles.action}>
        <GlassButton title={phase === "failed" ? "Try again" : "Erase all data"} role="destructive"
          onPress={phase === "failed" ? run : confirm} loading={busy} disabled={busy} />
        {phase === "failed" && <Text accessibilityLiveRegion="assertive" style={settingsStyles.problem}>
          Some of your data couldn’t be erased. Try again; it’s safe to repeat.
        </Text>}
      </View>
    </FormScrollView>
  </FormScreen>;
}

const styles = StyleSheet.create({
  action: { gap: 10 },
  done: { alignItems: "center", gap: 8, paddingVertical: 24, paddingHorizontal: 12 },
  doneTitle: { ...TYPOGRAPHY.sectionTitle, color: SETTINGS.ink, textAlign: "center" },
  doneBody: { ...TYPOGRAPHY.body, color: SETTINGS.inkSoft, textAlign: "center" },
});
