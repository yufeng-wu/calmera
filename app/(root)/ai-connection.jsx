import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, LayoutAnimationConfig } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { AI_PAGE, SETTINGS, SETTINGS_MOTION, TINTS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { INITIAL_CONNECTION, createConnectionController } from "@/lib/ai/connectionController.mjs";
import { CREDIT_PAGES, METHODS, connectionCard, isConnected, privacyLine, searchLine, signInProblem } from "@/lib/ai/connectionPresentation.mjs";
import { logAfterConnect, takeConnectOutcome } from "@/lib/ai/connectHandoff.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { usageValue } from "@/lib/ai/usage.mjs";
import { previewConnectionServices } from "@/lib/ai/previewConnection.mjs";

// Long enough for "Connected" to land before the page hands back to what was being logged.
const RETURN_AFTER_MS = 700;

// Calmera's one AI connection. With none, two cards of the same width with OR between: ChatGPT
// Plan, whose filled button starts OpenAI's sign-in at once, and API key, whose outlined button
// opens the page to paste one. Once connected, the page is about that connection: a status card
// (checked for free on every visit), Model and Online search, Usage, and Disconnect. To connect
// another way, a person disconnects first. `then` comes from Today: "voice" opens the voice sheet
// after connecting.
export default function AIConnection({ calmeraPreview = false, calmeraPreviewState = "none" }) {
  const router = useRouter();
  const { then } = useLocalSearchParams();
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/settings");
  const { fontScale } = useWindowDimensions();
  const services = useMemo(() => (calmeraPreview ? previewConnectionServices(calmeraPreviewState, { delay: 500 }) : connectionServices(LOCAL_OWNER)),
    [calmeraPreview, calmeraPreviewState]);
  const [state, setState] = useState(INITIAL_CONNECTION);
  const controller = useMemo(() => createConnectionController(services, { onChange: setState }), [services]);
  useFocusEffect(useCallback(() => {
    controller.open({ outcome: takeConnectOutcome() });
    return () => controller.close();
  }, [controller]));

  // Opened from Today without a working connection: once there is one, go back to the meal.
  const connected = isConnected(state);
  const arrivedWithout = useRef(null);
  if (state.loaded && arrivedWithout.current === null) arrivedWithout.current = !connected;
  const returning = Boolean(then) && !calmeraPreview && arrivedWithout.current === true && connected && !state.busy;
  useEffect(() => {
    if (!returning) return undefined;
    const timer = setTimeout(() => {
      if (then === "voice") logAfterConnect("voice");
      leave();
    }, RETURN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [returning, then, leave]);

  // The connected page landing is the confirmation; a light tap goes with it.
  const wasConnected = useRef(null);
  useEffect(() => {
    if (!state.loaded) return;
    if (wasConnected.current === false && connected) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    wasConnected.current = connected;
  }, [connected, state.loaded]);

  const { current, busy, notice } = state;
  const card = connectionCard(state);
  const signInLine = state.problem?.method === "chatgpt" ? signInProblem(state.problem.outcome) : null;
  const go = page => router.push(calmeraPreview ? { pathname: "/ui-gallery", params: { page: page === "/ai-connect" ? "ai-connect-key" : page.slice(1) } } : page);
  const disconnect = () => Alert.alert(`Disconnect ${card.title}?`, "AI estimates stop until you connect again.", [
    { text: "Cancel", style: "cancel" },
    { text: "Disconnect", style: "destructive", onPress: () => controller.disconnect() },
  ]);
  const said = at => notice?.at === at
    ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={settingsStyles.problem}>{notice.text}</Text> : null;

  return <FormScreen style={[formStyles.screen, styles.page]}>
    <FormHeader title="AI connection" onBack={leave} />
    {/* Connecting or disconnecting is a new page: it starts at the top. */}
    <FormScrollView key={`ai-connection-${fontScale}-${card ? "connected" : "options"}`} contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      {/* The Keychain answers at once, so nothing stands in for it. What is there on arrival just
          shows; what lands later (the status) fades in. */}
      {current !== undefined && <LayoutAnimationConfig skipEntering>
        {!card && <View style={styles.choices}>
          <Option method="chatgpt" accent problem={signInLine} busy={busy === "connect"} disabled={Boolean(busy)}
            onPress={() => controller.connect("chatgpt")} />
          <Text style={styles.or} accessibilityRole="text">or</Text>
          <Option method="key" disabled={Boolean(busy)} onPress={() => go("/ai-connect")}>
            <CreditLinks preview={calmeraPreview} />
          </Option>
          {said("page")}
        </View>}

        {card && <SettingsSection cardStyle={styles.card} footnote={card.note.tone === "bad"
          ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={settingsStyles.problem}>{card.note.text}</Text>
          : card.note.text}>
          <Status card={card} />
        </SettingsSection>}

        {card && <SettingsSection cardStyle={styles.card} footnote={said("search") || searchLine(current, { searchable: state.searchable })}>
          <SettingsRow title="Model" value={state.model || undefined} disabled={Boolean(busy)} onPress={() => go("/ai-model")} />
          <SettingsRow title="Online search" divider toggle={state.search && state.searchable} disabled={Boolean(busy) || !state.searchable}
            onToggle={on => controller.setSearch(on)} />
        </SettingsSection>}

        {/* Every connection's requests together, kept after a disconnect. */}
        <SettingsSection label="Usage" cardStyle={styles.card}>
          <SettingsRow title="Last 7 days" value={state.usage ? usageValue(state.usage) : undefined} onPress={() => go("/ai-usage")} />
        </SettingsSection>

        {card && <SettingsSection cardStyle={styles.card} footnote={said("disconnect")}>
          <SettingsRow title="Disconnect" destructive centered showAccessory={false} disabled={Boolean(busy)} onPress={disconnect} />
        </SettingsSection>}

        <View style={styles.privacy}>
          <Ionicons name="lock-closed-outline" size={14} color={SETTINGS.inkSoft} accessible={false} />
          <Text style={styles.privacyText}>{privacyLine(current)}</Text>
        </View>
      </LayoutAnimationConfig>}
    </FormScrollView>
  </FormScreen>;
}

// One way to connect, with nothing connected: everything about it stays in its card. Both cards
// are the same width; only ChatGPT's button is filled. A sign-in that failed says so in red in
// place of the description.
function Option({ method, accent = false, problem = null, busy = false, disabled = false, onPress, children }) {
  const words = METHODS[method];
  return <View style={[settingsStyles.card, styles.card, styles.option]}>
    <View style={styles.optionHead} accessible accessibilityRole="header" accessibilityLabel={`${words.eyebrow}, ${words.title}`}>
      <Text style={styles.eyebrow}>{words.eyebrow}</Text>
      <Text style={styles.optionTitle}>{words.title}</Text>
    </View>
    {problem
      ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.problem}>{problem}</Text>
      : words.lines.map(line => <Text key={line} style={styles.optionText}>{line}</Text>)}
    {children}
    <GlassButton title={busy ? "Signing in…" : words.start} role={accent ? "accent" : "default"} onPress={onPress} disabled={disabled}
      style={styles.optionButton} />
  </View>;
}

// "How to get credits: OpenAI · Anthropic", each opening that company's help page in Safari.
function CreditLinks({ preview }) {
  return <View style={styles.links}>
    <Text style={styles.optionText}>How to get credits:</Text>
    {CREDIT_PAGES.map((page, index) => <View key={page.name} style={styles.linkItem}>
      {index > 0 && <Text style={styles.optionText} accessible={false}>·</Text>}
      <Pressable accessibilityRole="link" accessibilityLabel={`How to get ${page.name} API credits`} accessibilityHint="Opens in Safari."
        hitSlop={8} onPress={() => { if (!preview) Linking.openURL(page.url).catch(() => {}); }}
        style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
        <Text style={styles.linkText}>{page.name}</Text>
      </Pressable>
    </View>)}
  </View>;
}

// The connection in use: its name, then the email or masked key and what the last check found.
// An email or key is cut in the middle rather than wrapped, so the status always shows.
function Status({ card }) {
  const stacked = useWindowDimensions().fontScale > 1.3;
  const status = card.status && <Animated.Text key={card.status.text} entering={FadeIn.duration(SETTINGS_MOTION.fade)}
    style={[styles.statusText, card.status.tone === "good" ? styles.good : styles.bad]}>{card.status.text}</Animated.Text>;
  return <View accessible accessibilityLabel={card.title} accessibilityValue={{ text: [card.detail, card.status?.text].filter(Boolean).join(", ") }}
    style={styles.status}>
    <Text style={styles.statusTitle}>{card.title}</Text>
    <View style={[styles.statusLine, stacked && styles.statusLineStacked]}>
      {!!card.detail && <Text numberOfLines={stacked ? undefined : 1} ellipsizeMode="middle" style={styles.detail}>{card.detail}</Text>}
      {!!card.detail && !!card.status && !stacked && <Text style={styles.detail} accessible={false}> · </Text>}
      {status}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: AI_PAGE.page },
  card: { backgroundColor: AI_PAGE.card },
  choices: { gap: 12 },
  or: { ...TYPOGRAPHY.eyebrow, color: AI_PAGE.faint, textTransform: "uppercase", textAlign: "center" },
  option: { padding: 20 },
  optionHead: { gap: 2, marginBottom: 8 },
  eyebrow: { ...TYPOGRAPHY.eyebrow, color: AI_PAGE.faint, textTransform: "uppercase" },
  optionTitle: { ...TYPOGRAPHY.pageTitle, color: SETTINGS.ink },
  optionText: { ...TYPOGRAPHY.body, color: SETTINGS.inkSoft },
  problem: { ...TYPOGRAPHY.body, color: SETTINGS.danger },
  optionButton: { marginTop: 16 },
  // Links out of the app, in the accent colour, each with room to tap.
  links: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 6, marginTop: 4 },
  linkItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  link: { minHeight: 32, justifyContent: "center" },
  linkText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.primary },
  linkPressed: { opacity: 0.45 },
  status: { minHeight: 64, paddingVertical: 14, paddingHorizontal: SETTINGS.rowPadding, gap: 2, justifyContent: "center" },
  statusTitle: { ...TYPOGRAPHY.sectionTitle, color: SETTINGS.ink },
  statusLine: { flexDirection: "row", alignItems: "center" },
  statusLineStacked: { flexDirection: "column", alignItems: "flex-start", gap: 2 },
  detail: { ...TYPOGRAPHY.body, color: SETTINGS.inkSoft, flexShrink: 1, fontVariant: ["tabular-nums"] },
  statusText: { ...TYPOGRAPHY.bodyMedium, flexShrink: 0 },
  good: { color: TINTS.leaf.icon },
  bad: { color: SETTINGS.danger },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  privacyText: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, flex: 1 },
});
