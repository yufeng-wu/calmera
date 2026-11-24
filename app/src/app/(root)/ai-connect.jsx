import { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import { SettingsSection, settingsStyles } from "@/components/settings/SettingsSection";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { AI_PAGE, SETTINGS, TINTS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { INITIAL_CONNECTION, createConnectionController } from "@/lib/ai/connectionController.mjs";
import { KEY_PAGE, methodPrivacy, problemFor, readKeyDraft } from "@/lib/ai/connectionPresentation.mjs";
import { leaveConnectOutcome } from "@/lib/ai/connectHandoff.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { previewConnectionServices } from "@/lib/ai/previewConnection.mjs";

const KEY_PAGES = [
  { name: "OpenAI", url: "https://platform.openai.com/api-keys" },
  { name: "Anthropic", url: "https://platform.claude.com/settings/keys" },
];

// Where an API key is pasted: the field, one line under it (a hint, whose key it is, or what
// went wrong), and one button. Calmera works out whose key it is; once its company accepts it,
// this page goes back and the AI connection page shows it connected.
export default function AIConnect({ calmeraPreview = false, calmeraPreviewState = "none" }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/ai-connection");
  const { fontScale } = useWindowDimensions();
  const services = useMemo(() => (calmeraPreview ? previewConnectionServices(calmeraPreviewState, { delay: 500 }) : connectionServices(LOCAL_OWNER)),
    [calmeraPreview, calmeraPreviewState]);
  const [state, setState] = useState(INITIAL_CONNECTION);
  const controller = useMemo(() => createConnectionController(services, { onChange: setState }), [services]);
  useFocusEffect(useCallback(() => {
    controller.open();
    return () => controller.close();
  }, [controller]));
  const [draft, setDraft] = useState(calmeraPreview && calmeraPreviewState === "key-error" ? "sk-ant-FAKE-not-a-real-key-0000" : "");

  const busy = state.busy === "connect";
  const reading = readKeyDraft(draft);
  const problem = state.problem ? problemFor("key", state.problem.outcome, state.problem.provider) : null;
  const ready = state.current !== undefined && !busy && draft.trim().length > 0;
  const connect = async () => {
    if (!ready) return;
    const result = await controller.connect("key", { draft });
    if (!result?.connected) return;
    leaveConnectOutcome(result.outcome);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!calmeraPreview) leave();
  };
  const change = value => { setDraft(value); controller.clearProblem(); };

  const line = problem
    ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.problem}>
      <Text style={styles.problemTitle}>{problem.title}. </Text>{problem.message}
    </Text>
    : reading.caption ? <View style={styles.recognized} accessibilityLiveRegion="polite">
      <Ionicons name="checkmark-circle" size={16} color={TINTS.leaf.icon} accessible={false} />
      <Text numberOfLines={fontScale > 1.3 ? undefined : 1} ellipsizeMode="middle" style={styles.recognizedText}>{reading.caption}</Text>
    </View>
      : <Text style={styles.hint}>{KEY_PAGE.hint}</Text>;

  return <FormScreen style={[formStyles.screen, styles.page]}>
    <FormHeader title={KEY_PAGE.title} onBack={leave} backDisabled={busy} />
    <FormScrollView key={`ai-connect-${fontScale}`} keyboardAware contentContainerStyle={settingsStyles.content}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <SettingsSection cardStyle={styles.card}>
        <View style={styles.entry}>
          {/* A secure field makes iOS show its Passwords bar and offer to save the key as a password;
              marking it as a one-time code turns both off. */}
          <TextInput value={draft} onChangeText={change} accessibilityLabel="API key" placeholder="Paste your OpenAI or Anthropic key"
            placeholderTextColor={COLORS.textLight} autoFocus={!calmeraPreview} secureTextEntry autoCapitalize="none" autoCorrect={false}
            spellCheck={false} autoComplete="off" textContentType="oneTimeCode" editable={!busy} returnKeyType="done" onSubmitEditing={connect}
            style={[styles.input, problem && styles.inputProblem]} maxLength={512} />
          {/* One line that is always here, so the button never moves. */}
          <View style={styles.line}>{line}</View>
          <GlassButton title={busy ? "Checking…" : "Connect"} role="accent" onPress={connect} disabled={!ready} />
        </View>
      </SettingsSection>
      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={SETTINGS.inkSoft} accessible={false} />
        <Text style={styles.privacyText}>{methodPrivacy("key", reading.provider)}</Text>
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
  page: { backgroundColor: AI_PAGE.page },
  card: { backgroundColor: AI_PAGE.card },
  entry: { padding: 16, gap: 10 },
  // No lineHeight: on iOS it pushes a one-line field's text off its centre.
  input: { height: 48, borderRadius: 14, backgroundColor: COLORS.track, borderWidth: 1, borderColor: "transparent",
    fontSize: TYPOGRAPHY.input.fontSize, fontWeight: TYPOGRAPHY.input.fontWeight, color: COLORS.text, paddingHorizontal: 14 },
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
