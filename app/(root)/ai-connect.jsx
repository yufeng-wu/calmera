import { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import { SettingsSection, SettingsTile, settingsStyles } from "@/components/SettingsSection";
import OpenAILogo from "@/components/OpenAILogo";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { SETTINGS, TINTS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { INITIAL_CONNECTION, createConnectionController } from "@/lib/ai/connectionController.mjs";
import { METHODS, connectTitle, keepsUntil, methodPrivacy, problemFor, readKeyDraft } from "@/lib/ai/connectionPresentation.mjs";
import { leaveConnectOutcome } from "@/lib/ai/connectHandoff.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { previewConnectionServices } from "@/lib/ai/previewConnection.mjs";

const KEY_PAGES = [
  { name: "OpenAI", url: "https://platform.openai.com/api-keys" },
  { name: "Claude", url: "https://platform.claude.com/settings/keys" },
];

// Connecting, the same page for both ways: what you connect with, one line under it (a hint,
// whose key it is, or what went wrong), and one button. ChatGPT's box opens OpenAI's sign-in;
// a key's box is where it is pasted. The old connection stays until the new one works; then
// this page goes back and the connection page shows it checked.
export default function AIConnect({ calmeraPreview = false, calmeraPreviewState = "none", calmeraPreviewStage = "key" }) {
  const params = useLocalSearchParams();
  const method = METHODS[calmeraPreview ? calmeraPreviewStage : params.method] ? (calmeraPreview ? calmeraPreviewStage : params.method) : "key";
  const mode = params.mode === "change" ? "change" : undefined;
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
  const keyMethod = method === "key";
  const reading = keyMethod ? readKeyDraft(draft) : null;
  const problem = state.problem ? problemFor(state.problem.method, state.problem.outcome, state.problem.provider) : null;
  const ready = state.current !== undefined && !busy && (!keyMethod || draft.trim().length > 0);
  const connect = async () => {
    if (!ready) return;
    const result = await controller.connect(method, keyMethod ? { draft } : { newAccount: mode === "change" });
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
    : reading?.caption ? <View style={styles.recognized} accessibilityLiveRegion="polite">
      <Ionicons name="checkmark-circle" size={16} color={TINTS.leaf.icon} accessible={false} />
      <Text numberOfLines={fontScale > 1.3 ? undefined : 1} ellipsizeMode="middle" style={styles.recognizedText}>{reading.caption}</Text>
    </View>
      : <Text style={styles.hint}>{keyMethod ? METHODS.key.hint : mode === "change" ? "Sign in with a different account." : METHODS.chatgpt.hint}</Text>;
  const footnote = keepsUntil(method, state.current, { mode });

  return <FormScreen style={formStyles.screen}>
    <FormHeader title={METHODS[method].title} onBack={leave} backDisabled={busy} />
    <FormScrollView key={`ai-connect-${method}-${fontScale}`} keyboardAware contentContainerStyle={settingsStyles.content}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <SettingsSection footnote={footnote || undefined}>
        <View style={styles.entry}>
          {keyMethod
            // A secure field makes iOS show its Passwords bar and offer to save the key as a password;
            // marking it as a one-time code turns both off.
            ? <TextInput value={draft} onChangeText={change} accessibilityLabel="API key" placeholder="Paste your OpenAI or Claude key"
              placeholderTextColor={COLORS.textLight} autoFocus={!calmeraPreview} secureTextEntry autoCapitalize="none" autoCorrect={false}
              spellCheck={false} autoComplete="off" textContentType="oneTimeCode" editable={!busy} returnKeyType="done" onSubmitEditing={connect}
              style={[styles.box, styles.input, problem && styles.boxProblem]} maxLength={512} />
            : <View style={[styles.box, styles.account, problem && styles.boxProblem]} accessible accessibilityLabel={METHODS.chatgpt.account}>
              <SettingsTile tint="cocoa" size={30}><OpenAILogo /></SettingsTile>
              <Text style={styles.accountText}>{METHODS.chatgpt.account}</Text>
            </View>}
          {/* One line that is always here, so the button never moves. */}
          <View style={styles.line}>{line}</View>
          <GlassButton title={busy ? (keyMethod ? "Checking…" : "Signing in…") : connectTitle(method, state.current, { mode })}
            role="accent" onPress={connect} disabled={!ready} loading={busy} />
        </View>
      </SettingsSection>
      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={SETTINGS.inkSoft} accessible={false} />
        <Text style={styles.privacyText}>{methodPrivacy(method, reading?.provider)}</Text>
      </View>
      {keyMethod && <View style={styles.links}>
        <Text style={styles.linksLabel}>Need a key?</Text>
        {KEY_PAGES.map(page => <Pressable key={page.name} accessibilityRole="link" accessibilityLabel={`Get a key from ${page.name}`} hitSlop={8}
          onPress={() => { if (!calmeraPreview) Linking.openURL(page.url).catch(() => {}); }}
          style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
          <Text style={styles.linkText}>{page.name}</Text><Ionicons name="open-outline" size={13} color={COLORS.primary} />
        </Pressable>)}
      </View>}
    </FormScrollView>
  </FormScreen>;
}

const styles = StyleSheet.create({
  entry: { padding: 16, gap: 10 },
  // The thing you connect with, the same size for a sign-in and a key.
  box: { height: 48, borderRadius: 14, backgroundColor: COLORS.track, borderWidth: 1, borderColor: "transparent" },
  // No lineHeight: on iOS it pushes a one-line field's text off its centre.
  input: { fontSize: TYPOGRAPHY.input.fontSize, fontWeight: TYPOGRAPHY.input.fontWeight, color: COLORS.text, paddingHorizontal: 14 },
  account: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 9 },
  accountText: { ...TYPOGRAPHY.input, color: COLORS.text, flex: 1 },
  boxProblem: { borderColor: SETTINGS.danger },
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
