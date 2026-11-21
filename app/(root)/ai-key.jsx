import { useCallback, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { SETTINGS, TINTS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { providerFor } from "@/lib/ai/models.mjs";
import { apiKeyIssue } from "@/lib/ai/apiKeyPresentation.mjs";
import { connectTitle, keepsKey, keyDraftIssue, readKeyDraft } from "@/lib/ai/connectionPresentation.mjs";
import { leaveKeyOutcome } from "@/lib/ai/connectHandoff.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { previewConnectionServices } from "@/lib/ai/previewConnection.mjs";

const KEY_PAGES = [
  { name: "OpenAI", url: "https://platform.openai.com/api-keys" },
  { name: "Claude", url: "https://console.anthropic.com/settings/keys" },
];

// One job: paste a key. calmera tells from the key whose it is, asks that provider whether it
// works, and only then makes it the connection and goes back. Whatever goes wrong is said right
// under the field, above the keyboard, and the key stays where it was typed.
export default function AIKey({ calmeraPreview = false, calmeraPreviewState = "none" }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/ai-connection");
  const { fontScale } = useWindowDimensions();
  const errorPreview = calmeraPreview && calmeraPreviewState === "key-error";
  const services = useMemo(() => (calmeraPreview ? previewConnectionServices(calmeraPreviewState, { delay: 500 }) : connectionServices(LOCAL_OWNER)),
    [calmeraPreview, calmeraPreviewState]);
  const [current, setCurrent] = useState(undefined);
  const [draft, setDraft] = useState(errorPreview ? "sk-ant-FAKE-not-a-real-key-0000" : "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(errorPreview ? apiKeyIssue("rejected", "anthropic") : null);
  const shown = useRef(false);
  const working = useRef(false);

  useFocusEffect(useCallback(() => {
    shown.current = true;
    services.read().then(value => { if (shown.current) setCurrent(value); }, () => { if (shown.current) setCurrent(null); });
    return () => { shown.current = false; };
  }, [services]));
  const reading = readKeyDraft(draft);
  const connect = async () => {
    if (working.current || !draft.trim()) return;
    if (!reading.key) { setProblem(keyDraftIssue(reading)); return; }
    working.current = true; setBusy(true); setProblem(null);
    try {
      const outcome = await services.testKey(reading.provider, reading.key).catch(() => "failed");
      if (!shown.current) return;
      if (!keepsKey(outcome)) { setProblem(apiKeyIssue(outcome, reading.provider)); return; }
      try { await services.saveKey(reading.provider, reading.key); } catch {
        if (shown.current) setProblem({ title: "Couldn’t save your key", message: "Your connection hasn’t changed. Try again." });
        return;
      }
      leaveKeyOutcome(outcome);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (shown.current && !calmeraPreview) leave();
      else if (shown.current) setProblem(null);
    } finally {
      working.current = false;
      if (shown.current) setBusy(false);
    }
  };

  const company = reading.provider ? providerFor(reading.provider).company : null;
  return <FormScreen style={formStyles.screen}>
    <FormHeader title="API key" onBack={leave} backDisabled={busy} />
    <FormScrollView key={`ai-key-${fontScale}`} keyboardAware contentContainerStyle={settingsStyles.content}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <SettingsSection>
        <View style={styles.entry}>
          {/* A secure field makes iOS show its Passwords bar and offer to save the key as a password;
              marking it as a one-time code turns both off. */}
          <TextInput value={draft} onChangeText={value => { setDraft(value); if (problem) setProblem(null); }}
            accessibilityLabel="API key" placeholder="Paste your OpenAI or Claude key" placeholderTextColor={COLORS.textLight}
            autoFocus={!calmeraPreview} secureTextEntry autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off"
            textContentType="oneTimeCode" editable={!busy} returnKeyType="done" onSubmitEditing={connect}
            style={[styles.input, problem && styles.inputProblem]} maxLength={512} />
          {/* One line that is always here, so the button never moves: the problem, or whose key it is. */}
          <View style={styles.line}>
            {problem ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.problem}>
              <Text style={styles.problemTitle}>{problem.title}. </Text>{problem.message}
            </Text> : reading.caption ? <View style={styles.recognized} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={16} color={TINTS.leaf.icon} accessible={false} />
              <Text numberOfLines={fontScale > 1.3 ? undefined : 1} ellipsizeMode="middle" style={styles.recognizedText}>{reading.caption}</Text>
            </View> : <Text style={styles.hint}>calmera can tell which one it is.</Text>}
          </View>
          <GlassButton title={busy ? "Checking…" : connectTitle(current)} role="accent" onPress={connect}
            disabled={busy || !draft.trim() || current === undefined} loading={busy} />
        </View>
      </SettingsSection>
      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={SETTINGS.inkSoft} accessible={false} />
        <Text style={styles.privacyText}>Your key stays in this iPhone’s Keychain and goes only to {company || "the company it’s from"}.</Text>
      </View>
      <View style={styles.links}>
        <Text style={styles.linksLabel}>Need a key?</Text>
        {KEY_PAGES.map(page => <Pressable key={page.name} accessibilityRole="link" accessibilityLabel={`Get a key from ${page.name}`} hitSlop={8}
          onPress={() => { if (!calmeraPreview) Linking.openURL(page.url).catch(() => {}); }}
          style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
          <Text style={styles.linkText}>{page.name}</Text><Ionicons name="open-outline" size={13} color={COLORS.primary} />
        </Pressable>)}
      </View>
    </FormScrollView>
  </FormScreen>;
}

const styles = StyleSheet.create({
  entry: { padding: 16, gap: 10 },
  // No lineHeight: on iOS it pushes a one-line field's text off its centre.
  input: { fontSize: TYPOGRAPHY.input.fontSize, fontWeight: TYPOGRAPHY.input.fontWeight, color: COLORS.text, height: 48,
    paddingHorizontal: 14, borderRadius: 14, backgroundColor: COLORS.track, borderWidth: 1, borderColor: "transparent" },
  inputProblem: { borderColor: SETTINGS.danger },
  // Room for a two-line problem at the default text size.
  line: { minHeight: 2 * TYPOGRAPHY.caption.lineHeight, justifyContent: "center" },
  hint: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, marginHorizontal: 2 },
  recognized: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 2 },
  recognizedText: { ...TYPOGRAPHY.captionMedium, color: TINTS.leaf.icon, flex: 1, fontVariant: ["tabular-nums"] },
  problem: { ...TYPOGRAPHY.caption, color: SETTINGS.danger, marginHorizontal: 2 },
  problemTitle: { ...TYPOGRAPHY.captionMedium },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  privacyText: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, flex: 1 },
  links: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 16, paddingHorizontal: 4, marginTop: -8 },
  linksLabel: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft },
  link: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  linkText: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  linkPressed: { opacity: 0.45 },
});
