import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
import { providerFor } from "@/lib/ai/models.mjs";
import { INITIAL_CONNECTION, createConnectionController } from "@/lib/ai/connectionController.mjs";
import { chatgptNote, connectionRows, isConnected, keyCheck, privacyLine } from "@/lib/ai/connectionPresentation.mjs";
import { logAfterConnect, takeKeyOutcome } from "@/lib/ai/connectHandoff.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { previewConnectionServices } from "@/lib/ai/previewConnection.mjs";

const USAGE_URL = "https://chatgpt.com/settings/usage";
// Long enough for the check to land before the page hands back to what was being logged.
const RETURN_AFTER_MS = 700;

// calmera's one AI connection, as one list: ChatGPT or an API key. The row in use is checked and
// its few settings sit underneath. Picking the other row replaces it once the new one works.
// `then` comes from Today: "voice" opens the voice sheet after connecting, "back" just returns.
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
    controller.open({ keyOutcome: takeKeyOutcome() });
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
  const rows = connectionRows(state);
  const owner = current && current.type !== "chatgpt" ? providerFor(current.provider) : null;
  const check = keyCheck(state.check?.outcome, current?.provider);
  const note = chatgptNote(state.issue);
  const openKey = () => router.push(calmeraPreview ? { pathname: "/ui-gallery", params: { page: "ai-key" } } : "/ai-key");
  const openModel = () => router.push(calmeraPreview ? { pathname: "/ui-gallery", params: { page: "ai-model" } } : "/ai-model");
  const confirmLeaving = (title, action) => Alert.alert(title, "AI estimates stop until you connect again.", [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: () => controller.disconnect() },
  ]);

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="AI connection" onBack={leave} backDisabled={busy === "sign-in"} />
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
            <Choice {...rows.chatgpt} busy={busy === "sign-in"} disabled={Boolean(busy)}
              tile={<SettingsTile tint="cocoa" size={36}><OpenAILogo /></SettingsTile>}
              onPress={rows.chatgpt.state === "current" ? undefined : () => controller.signIn()} />
            <Choice {...rows.key} divider disabled={Boolean(busy)} tile={<SettingsTile icon="key" tint="tangerine" size={36} />}
              onPress={rows.key.state === "current" ? undefined : openKey} />
          </View>
        </SettingsSection>

        {current?.type === "chatgpt" && <SettingsSection footnote={note
          ? <Text style={note.tone === "bad" ? settingsStyles.problem : settingsStyles.footnote}>{note.text}</Text>
          : rows.chatgpt.state === "current" ? "Estimates count toward your ChatGPT plan." : undefined}>
          {rows.chatgpt.state === "current" && <>
            <SettingsRow title="Model" value={state.model || undefined} disabled={Boolean(busy)} onPress={openModel} />
            <SettingsRow title="Manage usage" divider disabled={Boolean(busy)} accessibilityRole="link" accessibilityHint="Opens ChatGPT settings"
              accessory={<Ionicons name="open-outline" size={16} color={SETTINGS.chevron} />}
              onPress={() => { if (!calmeraPreview) Linking.openURL(USAGE_URL).catch(() => {}); }} />
          </>}
          <SettingsRow title="Sign out" destructive divider={rows.chatgpt.state === "current"} showAccessory={false}
            loading={busy === "disconnect"} disabled={Boolean(busy)} onPress={() => confirmLeaving("Sign out of ChatGPT?", "Sign Out")} />
        </SettingsSection>}

        {owner && <SettingsSection footnote={check?.message
          ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={settingsStyles.problem}>{check.message}</Text>
          : `Estimates use ${owner.modelName}, billed to your ${owner.company} account.`}>
          <SettingsRow title="Check key" value={check?.title} tone={check ? (check.ok ? "good" : "bad") : undefined} showAccessory={false}
            loading={busy === "check"} disabled={Boolean(busy)} onPress={() => controller.checkKey()} />
          <SettingsRow title="Replace key" divider disabled={Boolean(busy)} onPress={openKey} />
          <SettingsRow title="Remove key" destructive divider showAccessory={false} loading={busy === "disconnect"} disabled={Boolean(busy)}
            onPress={() => confirmLeaving(`Remove your ${owner.name} key?`, "Remove")} />
        </SettingsSection>}

        <View style={styles.privacy}>
          <Ionicons name="lock-closed-outline" size={14} color={SETTINGS.inkSoft} accessible={false} />
          <Text style={styles.privacyText}>{privacyLine(current)}</Text>
        </View>
      </>}
    </FormScrollView>
  </FormScreen>;
}

// One of the two ways to connect. The one in use is checked; the other leads somewhere, so it
// keeps its chevron. An email or key never wraps: it is cut in the middle, keeping both ends.
function Choice({ title, detail, state, tile, onPress, busy = false, disabled = false, divider = false }) {
  const { pressProps, highlight } = usePressHighlight();
  const stacked = useWindowDimensions().fontScale > 1.3;
  const current = state === "current", attention = state === "attention";
  return <Pressable accessibilityRole="radio" accessibilityLabel={title} accessibilityValue={{ text: detail }}
    accessibilityState={{ checked: current, busy, disabled: disabled || !onPress }}
    disabled={disabled || !onPress} onPress={onPress} {...pressProps} style={styles.choice}>
    {highlight}
    {divider && <View style={styles.choiceDivider} />}
    {tile}
    <View style={styles.choiceCopy}>
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text numberOfLines={stacked ? undefined : 1} ellipsizeMode="middle" style={[styles.choiceDetail, attention && styles.bad]}>{detail}</Text>
    </View>
    {busy ? <ActivityIndicator color={SETTINGS.accent} accessible={false} />
      : current ? <SettingsCheck selected />
        : attention ? <Ionicons name="alert-circle" size={20} color={SETTINGS.danger} accessible={false} />
          : <Ionicons name="chevron-forward" size={16} color={SETTINGS.chevron} accessible={false} />}
  </Pressable>;
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
