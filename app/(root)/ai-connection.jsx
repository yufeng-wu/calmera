import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, formStyles } from "@/components/GlassForm";
import SettingsRow, { SettingsCheck } from "@/components/SettingsRow";
import { SettingsSection, SettingsTile, settingsStyles, usePressHighlight } from "@/components/SettingsSection";
import OpenAILogo from "@/components/OpenAILogo";
import { SETTINGS, TINTS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { INITIAL_CONNECTION, createConnectionController } from "@/lib/ai/connectionController.mjs";
import { methodOf } from "@/lib/ai/connectionMethods.mjs";
import { METHODS, billingLine, checkResult, connectionName, connectionRows, isConnected, privacyLine, searchLine } from "@/lib/ai/connectionPresentation.mjs";
import { logAfterConnect, takeConnectOutcome } from "@/lib/ai/connectHandoff.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { previewConnectionServices } from "@/lib/ai/previewConnection.mjs";

// Long enough for the check to land before the page hands back to what was being logged.
const RETURN_AFTER_MS = 700;

// calmera's one AI connection, as one list: ChatGPT or an API key. Both are connected the same
// way (tap the row, connect on its page) and, once connected, carry the same card: Model,
// Check connection, change it, Disconnect. Picking the other row replaces the one in use once
// the new one works. `then` comes from Today: "voice" opens the voice sheet after connecting.
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

  // The check landing is the confirmation; a light tap goes with it.
  const wasConnected = useRef(null);
  useEffect(() => {
    if (!state.loaded) return;
    if (wasConnected.current === false && connected) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    wasConnected.current = connected;
  }, [connected, state.loaded]);

  const { current, busy } = state;
  const using = methodOf(current);
  const rows = connectionRows(state);
  const check = checkResult(using, state.check?.outcome, current?.provider);
  const go = (page, params) => router.push(calmeraPreview
    ? { pathname: "/ui-gallery", params: { page: page === "/ai-connect" ? `ai-connect-${params.method}` : page.slice(1) } }
    : { pathname: page, params });
  const openConnect = (method, mode) => go("/ai-connect", mode ? { method, mode } : { method });
  const disconnect = () => Alert.alert(`Disconnect ${connectionName(current)}?`, "AI estimates stop until you connect again.", [
    { text: "Cancel", style: "cancel" },
    { text: "Disconnect", style: "destructive", onPress: () => controller.disconnect() },
  ]);
  const tile = { chatgpt: <SettingsTile tint="cocoa" size={36}><OpenAILogo /></SettingsTile>, key: <SettingsTile icon="key" tint="tangerine" size={36} /> };

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="AI connection" onBack={leave} />
    <FormScrollView key={`ai-connection-${fontScale}`} contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      <Text style={settingsStyles.lead}>One AI estimates your meals from what you say, type or snap.</Text>
      {/* The Keychain answers at once, so nothing stands in for it. */}
      {current !== undefined && <>
        <SettingsSection footnote={state.notice && <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Ionicons name={state.notice.tone === "good" ? "checkmark-circle" : "alert-circle"} size={16} accessible={false}
            color={state.notice.tone === "good" ? TINTS.leaf.icon : SETTINGS.danger} />
          <Text style={[styles.noticeText, state.notice.tone === "good" ? styles.good : styles.bad]}>{state.notice.text}</Text>
        </View>}>
          <View accessibilityRole="radiogroup">
            {["chatgpt", "key"].map((id, index) => <Choice key={id} {...rows[id]} divider={index > 0} disabled={Boolean(busy)} tile={tile[id]}
              onPress={rows[id].state === "current" ? undefined : () => openConnect(id)} />)}
          </View>
        </SettingsSection>

        {/* How estimates are made, the same two settings for every connection. */}
        {using && <SettingsSection label="Estimates" footnote={searchLine(current, { on: state.search, searchable: state.searchable })}>
          <SettingsRow title="Model" value={state.model || undefined} disabled={Boolean(busy)} onPress={() => go("/ai-model")} />
          <SettingsRow title="Look up online" divider toggle={state.search && state.searchable} disabled={Boolean(busy) || !state.searchable}
            onToggle={on => controller.setSearch(on)} />
        </SettingsSection>}

        {/* The same card for either way of connecting. */}
        {using && <SettingsSection footnote={check?.message
          ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={settingsStyles.problem}>{check.message}</Text>
          : billingLine(current)}>
          <SettingsRow title="Check connection" value={check?.title} tone={check ? (check.ok ? "good" : "bad") : undefined}
            showAccessory={false} loading={busy === "check"} disabled={Boolean(busy)} onPress={() => controller.check()} />
          <SettingsRow title={METHODS[using].change} divider disabled={Boolean(busy)} onPress={() => openConnect(using, "change")} />
          <SettingsRow title="Disconnect" destructive divider showAccessory={false} loading={busy === "disconnect"} disabled={Boolean(busy)}
            onPress={disconnect} />
        </SettingsSection>}

        <View style={styles.privacy}>
          <Ionicons name="lock-closed-outline" size={14} color={SETTINGS.inkSoft} accessible={false} />
          <Text style={styles.privacyText}>{privacyLine(current)}</Text>
        </View>
      </>}
    </FormScrollView>
  </FormScreen>;
}

// One of the two ways to connect. The one in use is checked; the other leads to its connect
// page, so it keeps its chevron. An email or key never wraps: it is cut in the middle.
function Choice({ title, detail, state, tile, onPress, disabled = false, divider = false }) {
  const { pressProps, highlight } = usePressHighlight();
  const stacked = useWindowDimensions().fontScale > 1.3;
  const current = state === "current", attention = state === "attention";
  // A check that was there when the page opened just shows; one that has just been earned pops in.
  const earned = useRef(false);
  if (!current) earned.current = true;
  return <Pressable accessibilityRole="radio" accessibilityLabel={title} accessibilityValue={{ text: detail }}
    accessibilityState={{ checked: current, disabled: disabled || !onPress }}
    disabled={disabled || !onPress} onPress={onPress} {...pressProps} style={styles.choice}>
    {highlight}
    {divider && <View style={styles.choiceDivider} />}
    {tile}
    <View style={styles.choiceCopy}>
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text numberOfLines={stacked ? undefined : 1} ellipsizeMode="middle" style={[styles.choiceDetail, attention && styles.bad]}>{detail}</Text>
    </View>
    {current ? <Landing pop={earned.current} />
      : attention ? <Ionicons name="alert-circle" size={20} color={SETTINGS.danger} accessible={false} />
        : <Ionicons name="chevron-forward" size={16} color={SETTINGS.chevron} accessible={false} />}
  </Pressable>;
}

// SettingsCheck springs when it turns selected, so a pop mounts it unselected and selects it at once.
function Landing({ pop }) {
  const [selected, setSelected] = useState(!pop);
  useEffect(() => { setSelected(true); }, []);
  return <SettingsCheck selected={selected} />;
}

const styles = StyleSheet.create({
  choice: { minHeight: 68, paddingVertical: 14, paddingHorizontal: SETTINGS.rowPadding, gap: 14, flexDirection: "row", alignItems: "center" },
  choiceDivider: { position: "absolute", top: 0, right: 0, left: SETTINGS.rowPadding + 36 + 14, height: StyleSheet.hairlineWidth, backgroundColor: SETTINGS.hairline },
  choiceCopy: { flex: 1, gap: 2 },
  choiceTitle: { ...TYPOGRAPHY.sectionTitle, color: SETTINGS.ink },
  choiceDetail: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, fontVariant: ["tabular-nums"] },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginHorizontal: 4 },
  noticeText: { ...TYPOGRAPHY.caption, flex: 1 },
  good: { color: TINTS.leaf.icon },
  bad: { color: SETTINGS.danger },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  privacyText: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, flex: 1 },
});
