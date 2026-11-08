import { useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useAuth, useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FormHeader, FormScreen, FormScrollView, GlassButton } from "@/components/GlassForm";
import OpenAILogo from "@/components/OpenAILogo";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import { SETTINGS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import usePageExit from "@/hooks/usePageExit";
import { AccountDeletionError, deletionErrorMessage } from "@/lib/accountDeletion.mjs";
import { startAccountDeletion } from "@/lib/accountDeletionDevice";

// Review stages show each state with synthetic outcomes; nothing is sent or deleted.
const PREVIEW_FAILURES = {
  "delete-account-partial": "account_close_failed", "delete-account-unknown": "unknown",
  "delete-account-offline": "offline", "delete-account-unavailable": "unavailable",
};
const previewPhase = (stage) => stage === "delete-account-deleting" ? "deleting"
  : stage === "delete-account-done" ? "done" : PREVIEW_FAILURES[stage] ? "failed" : "idle";

// What will be deleted, a way to keep a copy first, and one confirmed button. The backend
// removes the data and closes the account; this phone then forgets the person. Any failure
// says whether anything was deleted, and trying again is always safe.
export default function DeleteAccount({ calmeraPreview = false, calmeraPreviewStage }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/account");
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const email = calmeraPreview ? "you@example.com" : user?.primaryEmailAddress?.emailAddress;
  const [phase, setPhase] = useState(() => calmeraPreview ? previewPhase(calmeraPreviewStage) : "idle");
  const [error, setError] = useState(() => {
    const code = calmeraPreview && PREVIEW_FAILURES[calmeraPreviewStage];
    return code ? new AccountDeletionError(code, { dataDeleted: code === "account_close_failed" }) : null;
  });
  const deletion = useRef(null);
  const busy = phase === "deleting";

  const run = async () => {
    setPhase("deleting");
    setError(null);
    try {
      if (calmeraPreview) await new Promise((resolve) => setTimeout(resolve, 1200));
      else {
        deletion.current ??= startAccountDeletion({ userId, getToken, signOut });
        await deletion.current();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPhase("done");
    } catch (failure) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(failure);
      setPhase("failed");
    }
  };
  const confirm = () => Alert.alert("Delete your account?",
    "Your account, meals, goals and profile will be deleted for good. This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete Account", style: "destructive", onPress: run },
    ]);
  // Signing out normally sends the app to Sign In by itself; this covers the moment before.
  const done = () => {
    if (calmeraPreview) return leave();
    signOut().catch(() => {}).finally(() => router.replace("/sign-in"));
  };

  if (phase === "done") return <FormScreen>
    <FormHeader title="Delete account" />
    <FormScrollView contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      {calmeraPreview && <Text style={settingsStyles.footnote}>Synthetic preview · nothing was deleted</Text>}
      <View accessible accessibilityLiveRegion="polite" style={styles.done}>
        <Ionicons name="checkmark-circle" size={44} color={SETTINGS.ink} />
        <Text accessibilityRole="header" style={styles.doneTitle}>Your account has been deleted</Text>
        <Text style={styles.doneBody}>Your meals, goals and profile are gone, and ChatGPT is disconnected from this phone.</Text>
      </View>
      <GlassButton title="Done" role="accent" onPress={done} />
    </FormScrollView>
  </FormScreen>;

  return <FormScreen>
    <FormHeader title="Delete account" onBack={leave} backDisabled={busy} />
    <FormScrollView contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false} pointerEvents={busy ? "none" : "auto"}>
      {calmeraPreview && <Text style={settingsStyles.footnote}>Synthetic preview · nothing is deleted</Text>}
      <Text style={settingsStyles.lead}>This permanently deletes your calmera account and everything in it. It can’t be undone.</Text>
      <SettingsSection label="What’s deleted">
        <SettingsRow title="Your account" subtitle={email || undefined} icon="person" tint="tangerine" />
        <SettingsRow title="Meals you’ve logged" icon="restaurant" tint="leaf" divider />
        <SettingsRow title="Goals and profile" icon="flag" tint="sky" divider />
        <SettingsRow title="ChatGPT on this phone" subtitle="Disconnected and forgotten" iconElement={<OpenAILogo />} tint="cocoa" divider />
      </SettingsSection>
      <SettingsSection label="Before you go" footnote="Keep a copy of your meals and goals first, if you’d like one.">
        <SettingsRow title="Export your data" icon="share" tint="tangerine" disabled={busy}
          onPress={() => calmeraPreview ? Alert.alert("Preview only", "Export opens from Settings in the app.") : router.push("/export-data")} />
      </SettingsSection>
      <View style={styles.action}>
        <GlassButton title={phase === "failed" ? "Try again" : "Delete account"} role="destructive"
          onPress={phase === "failed" ? run : confirm} loading={busy} disabled={busy || (!calmeraPreview && !userId)} />
        {phase === "failed" && <Text accessibilityLiveRegion="assertive" style={settingsStyles.problem}>{deletionErrorMessage(error)}</Text>}
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
