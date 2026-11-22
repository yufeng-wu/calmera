import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, LayoutAnimationConfig } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, SettingsTile, settingsStyles, usePressHighlight } from "@/components/SettingsSection";
import OpenAILogo from "@/components/OpenAILogo";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { SETTINGS, SETTINGS_MOTION, TINTS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { INITIAL_CONNECTION, createConnectionController } from "@/lib/ai/connectionController.mjs";
import { METHODS, billingLine, checkResult, connectionCard, connectionName, isConnected, privacyLine, problemFor, searchLine } from "@/lib/ai/connectionPresentation.mjs";
import { logAfterConnect, takeConnectOutcome } from "@/lib/ai/connectHandoff.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { usageValue } from "@/lib/ai/usage.mjs";
import { previewConnectionServices } from "@/lib/ai/previewConnection.mjs";

// Long enough for the check to land before the page hands back to what was being logged.
const RETURN_AFTER_MS = 700;

// calmera's one AI connection. With none, two cards of the same size: a ChatGPT account, whose
// button starts OpenAI's sign-in at once, and an API key, whose button opens the page to paste
// it. Once connected, the one in use says so and carries Model, Online search, its own settings
// and Usage; the other way folds into one row that switches (on its connect page, where the old
// connection stays until the new one works). `then` comes from Today: "voice" opens the voice
// sheet after connecting.
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

  // "Connected" landing is the confirmation; a light tap goes with it.
  const wasConnected = useRef(null);
  useEffect(() => {
    if (!state.loaded) return;
    if (wasConnected.current === false && connected) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    wasConnected.current = connected;
  }, [connected, state.loaded]);

  const { current, busy } = state;
  const card = connectionCard(state);
  const check = card && checkResult(card.method, state.check?.outcome, current.provider);
  const signInProblem = state.problem?.method === "chatgpt" ? problemFor("chatgpt", state.problem.outcome) : null;
  const go = (page, params) => router.push(calmeraPreview
    ? { pathname: "/ui-gallery", params: { page: page === "/ai-connect" ? `ai-connect-${params.method}` : page.slice(1) } }
    : { pathname: page, params });
  const openConnect = (method, mode) => go("/ai-connect", mode ? { method, mode } : { method });
  const disconnect = () => Alert.alert(`Disconnect ${connectionName(current)}?`, "AI estimates stop until you connect again.", [
    { text: "Cancel", style: "cancel" },
    { text: "Disconnect", style: "destructive", onPress: () => controller.disconnect() },
  ]);
  const tile = size => ({ chatgpt: <SettingsTile tint="cocoa" size={size}><OpenAILogo /></SettingsTile>, key: <SettingsTile icon="key" tint="tangerine" size={size} /> });
  const notice = state.notice && <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
    <Ionicons name={state.notice.tone === "good" ? "checkmark-circle" : "alert-circle"} size={16} accessible={false}
      color={state.notice.tone === "good" ? TINTS.leaf.icon : SETTINGS.danger} />
    <Text style={[styles.noticeText, state.notice.tone === "good" ? styles.good : styles.bad]}>{state.notice.text}</Text>
  </View>;
  // Usage stays reachable after disconnecting, as long as there is something to show.
  const usage = state.usage && (card || state.usage.total.requests > 0) ? state.usage : null;

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="AI connection" onBack={leave} />
    <FormScrollView key={`ai-connection-${fontScale}`} contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      {/* The Keychain answers at once, so nothing stands in for it. What is there on arrival just
          shows; what lands later (Connected) fades in. */}
      {current !== undefined && <LayoutAnimationConfig skipEntering>
        {!card && <View style={styles.choices}>
          <SettingsSection label="Choose one">
            <Offer method="chatgpt" tile={tile(30).chatgpt} accent problem={signInProblem} loading={busy === "connect"}
              disabled={Boolean(busy)} onPress={() => controller.connect("chatgpt")} />
          </SettingsSection>
          <Text style={styles.or}>or</Text>
          <SettingsSection footnote={notice}>
            <Offer method="key" tile={tile(30).key} disabled={Boolean(busy)} onPress={() => openConnect("key")} />
          </SettingsSection>
        </View>}

        {card && <SettingsSection footnote={notice}>
          <InUse card={card} tile={tile(36)[card.method]} loaded={state.loaded} disabled={Boolean(busy)} onFix={() => openConnect(card.method)} />
          <SettingsRow title={METHODS[card.other].switchTo} divider disabled={Boolean(busy)} onPress={() => openConnect(card.other)} />
        </SettingsSection>}

        {/* How estimates are made, the same two settings for every connection. */}
        {card && <SettingsSection label="Estimates" footnote={searchLine(current, { on: state.search, searchable: state.searchable })}>
          <SettingsRow title="Model" value={state.model || undefined} disabled={Boolean(busy)} onPress={() => go("/ai-model")} />
          <SettingsRow title="Online search" divider toggle={state.search && state.searchable} disabled={Boolean(busy) || !state.searchable}
            onToggle={on => controller.setSearch(on)} />
        </SettingsSection>}

        {/* The same settings for either way of connecting. */}
        {card && <SettingsSection footnote={check?.message
          ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={settingsStyles.problem}>{check.message}</Text>
          : billingLine(current)}>
          <SettingsRow title="Check connection" value={check?.title} tone={check ? (check.ok ? "good" : "bad") : undefined}
            showAccessory={false} loading={busy === "check"} disabled={Boolean(busy)} onPress={() => controller.check()} />
          <SettingsRow title={METHODS[card.method].change} divider disabled={Boolean(busy)} onPress={() => openConnect(card.method, "change")} />
          <SettingsRow title="Disconnect" destructive divider showAccessory={false} loading={busy === "disconnect"} disabled={Boolean(busy)}
            onPress={disconnect} />
        </SettingsSection>}

        {usage && <SettingsSection label="Usage">
          <SettingsRow title="Last 7 days" value={usageValue(usage)} onPress={() => go("/ai-usage")} />
        </SettingsSection>}

        <View style={styles.privacy}>
          <Ionicons name="lock-closed-outline" size={14} color={SETTINGS.inkSoft} accessible={false} />
          <Text style={styles.privacyText}>{privacyLine(current)}</Text>
        </View>
      </LayoutAnimationConfig>}
    </FormScrollView>
  </FormScreen>;
}

// One way to connect, with nothing connected: what it is, one line, one button. Both cards are
// the same size; only the button says which is the usual way in (filled) and which isn't. The
// line is always there, two lines tall, so a problem in it never moves the button.
function Offer({ method, tile, accent = false, problem = null, loading = false, disabled = false, onPress }) {
  const words = METHODS[method];
  return <View style={styles.offer}>
    <View style={styles.box} accessible accessibilityRole="header" accessibilityLabel={words.account}>
      {tile}
      <Text style={styles.boxText}>{words.account}</Text>
    </View>
    <View style={styles.line}>
      {problem ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.problem}>
        <Text style={styles.problemTitle}>{problem.title}. </Text>{problem.message}
      </Text> : <Text style={styles.hint}>{words.offer}</Text>}
    </View>
    <GlassButton title={loading ? "Signing in…" : words.start} role={accent ? "accent" : "default"} onPress={onPress}
      disabled={disabled} loading={loading} />
  </View>;
}

// The connection in use: its name, who or which key, and Connected in green. When it needs
// connecting again the line turns red and tapping the card fixes it. An email or key never
// wraps: it is cut in the middle.
function InUse({ card, tile, loaded, disabled, onFix }) {
  const { pressProps, highlight } = usePressHighlight();
  const stacked = useWindowDimensions().fontScale > 1.3;
  const fix = card.attention ? onFix : undefined;
  const status = !loaded ? null : card.attention ? <Ionicons name="alert-circle" size={20} color={SETTINGS.danger} accessible={false} />
    : <Animated.View entering={FadeIn.duration(SETTINGS_MOTION.fade)} style={styles.connected}>
      <Ionicons name="checkmark-circle" size={18} color={TINTS.leaf.icon} accessible={false} />
      <Text style={styles.connectedText}>Connected</Text>
    </Animated.View>;
  return <Pressable accessible accessibilityRole={fix ? "button" : "text"} accessibilityLabel={card.title}
    accessibilityValue={{ text: [card.detail, loaded && !card.attention ? "Connected" : null].filter(Boolean).join(". ") }}
    accessibilityState={fix ? { disabled } : undefined} disabled={disabled || !fix} onPress={fix} {...(fix ? pressProps : {})} style={styles.inUse}>
    {fix && highlight}
    {tile}
    <View style={styles.inUseCopy}>
      <Text style={styles.inUseTitle}>{card.title}</Text>
      <Text numberOfLines={stacked ? undefined : 1} ellipsizeMode="middle" style={[styles.inUseDetail, card.attention && styles.bad]}>{card.detail}</Text>
      {stacked && status}
    </View>
    {!stacked && status}
  </Pressable>;
}

const styles = StyleSheet.create({
  choices: { gap: 10 },
  or: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, textAlign: "center" },
  offer: { padding: 16, gap: 10 },
  // What you connect with, the same box as on the connect page.
  box: { minHeight: 48, borderRadius: 14, backgroundColor: COLORS.track, flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 9, paddingVertical: 8 },
  boxText: { ...TYPOGRAPHY.input, color: COLORS.text, flex: 1, flexShrink: 1 },
  line: { minHeight: 2 * TYPOGRAPHY.caption.lineHeight, justifyContent: "center" },
  hint: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, marginHorizontal: 2 },
  problem: { ...TYPOGRAPHY.caption, color: SETTINGS.danger, marginHorizontal: 2 },
  problemTitle: { ...TYPOGRAPHY.captionMedium },
  inUse: { minHeight: 68, paddingVertical: 14, paddingHorizontal: SETTINGS.rowPadding, gap: 14, flexDirection: "row", alignItems: "center" },
  inUseCopy: { flex: 1, gap: 2 },
  inUseTitle: { ...TYPOGRAPHY.sectionTitle, color: SETTINGS.ink },
  inUseDetail: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, fontVariant: ["tabular-nums"] },
  connected: { flexDirection: "row", alignItems: "center", gap: 4 },
  connectedText: { ...TYPOGRAPHY.captionMedium, color: TINTS.leaf.icon },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginHorizontal: 4 },
  noticeText: { ...TYPOGRAPHY.caption, flex: 1 },
  good: { color: TINTS.leaf.icon },
  bad: { color: SETTINGS.danger },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  privacyText: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, flex: 1 },
});
