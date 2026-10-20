import { TYPOGRAPHY } from "@/constants/typography";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormCard, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import usePageExit from "@/hooks/usePageExit";
import { createPlanClient, isChatGPTAvailable } from "@/lib/chatgpt/planClient";
import { friendlyError } from "@/lib/chatgpt/protocol.mjs";

const PREVIEW_MODELS = [{ slug: "calmera-preview", display_name: "ChatGPT model" }, { slug: "calmera-preview-fast", display_name: "ChatGPT fast model" }];
export default function ChatGPTSettings({ calmeraPreview = false, calmeraPreviewState = "connected" }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");
  const { fontScale } = useWindowDimensions();
  const { userId } = useAuth();
  const client = useMemo(() => !calmeraPreview && userId ? createPlanClient(userId) : null, [calmeraPreview, userId]);
  const [connected, setConnected] = useState(calmeraPreview && calmeraPreviewState !== "disconnected");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(!calmeraPreview);
  const [models, setModels] = useState(calmeraPreview ? PREVIEW_MODELS : []);
  const [model, setModel] = useState(calmeraPreview ? PREVIEW_MODELS[0].slug : "");
  const available = calmeraPreview || isChatGPTAvailable();

  useEffect(() => {
    let active = true;
    if (calmeraPreview) {
      setConnected(calmeraPreviewState !== "disconnected"); setChecking(false); return;
    }
    if (!client) { setChecking(false); return; }
    setChecking(true);
    (async () => {
      const value = await client.connected();
      if (!active) return;
      setConnected(value);
      if (value) {
        const choices = await client.models(), selected = await client.getSelectedModel();
        if (active) { setModels(choices); setModel(choices.find(item => item.slug === selected)?.slug || choices[0]?.slug || ""); }
      }
    })().catch(() => { if (active) Alert.alert("ChatGPT", "Please reconnect your account."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [calmeraPreview, calmeraPreviewState, client, userId]);

  async function connect() {
    if (busy) return;
    if (calmeraPreview) { setConnected(true); setModels(PREVIEW_MODELS); setModel(value => PREVIEW_MODELS.some(item => item.slug === value) ? value : PREVIEW_MODELS[0].slug); return; }
    if (!client) return;
    setBusy(true);
    try {
      await client.connect();
      const choices = await client.models(), selected = await client.getSelectedModel();
      setConnected(true); setModels(choices);
      setModel(choices.find(item => item.slug === selected)?.slug || choices[0]?.slug || "");
      if (!await client.hasWelcomed()) Alert.alert("You are using your ChatGPT plan", "Eligible Calmera AI requests use your own ChatGPT plan. Calmera is free. Review usage and app limits in ChatGPT settings.", [
        { text: "Got it", onPress: () => client.markWelcomed().catch(() => {}) },
      ], { cancelable: false });
    } catch (error) { Alert.alert("ChatGPT", friendlyError(error)); }
    finally { setBusy(false); }
  }
  async function selectModel(slug) {
    if (calmeraPreview) { setModel(slug); return; }
    if (!client || busy) return;
    try { await client.setSelectedModel(slug); setModel(slug); }
    catch { Alert.alert("ChatGPT", "Could not update the selected model."); }
  }
  return <FormScreen style={formStyles.screen}>
    <FormHeader title="ChatGPT" onBack={leave} />
    <FormScrollView key={`text-size-${fontScale}`} contentContainerStyle={formStyles.content} showsVerticalScrollIndicator={false}>
      <FormCard>
        <View style={styles.connectionHeading}>
          <View style={styles.connectionIcon}><Ionicons name="sparkles-outline" size={24} color={COLORS.primary} /></View>
          <View style={styles.headingCopy}><Text accessibilityRole="header" style={styles.title}>{checking ? "Your ChatGPT plan" : connected ? "ChatGPT connected" : "Connect your ChatGPT"}</Text>
            <Text style={styles.status}>{checking ? "Checking connection…" : connected ? "Connected on this phone" : "Use your own ChatGPT plan"}</Text></View>
        </View>
        <Text style={styles.text}>Use your own ChatGPT plan for Calmera AI. Your plan limits apply. Your food records stay in your existing Calmera account.</Text>
        {!available && <Text style={styles.text}>This build does not include ChatGPT connection. Please use an updated iOS build.</Text>}
        {checking ? <View style={styles.checking}><ActivityIndicator color={COLORS.primary} /><Text style={styles.caption}>Checking your connection…</Text></View>
          : <GlassButton title={connected ? "Reconnect ChatGPT" : "Continue with ChatGPT"} symbol="sparkles"
            loading={busy} disabled={!available} onPress={connect} style={styles.action} />}
        {connected && !checking && <GlassButton title="Manage usage in ChatGPT" symbol="arrow.up.right" disabled={busy}
          onPress={() => { if (!calmeraPreview) Linking.openURL("https://chatgpt.com/settings/usage").catch(() => {}); }} style={styles.action} />}
      </FormCard>
      {connected && !checking && <View style={styles.section}>
        <Text style={styles.sectionLabel}>MODEL</Text>
        <FormCard style={styles.group}>
          {models.length ? models.map((item, index) => <SettingsRow key={item.slug} title={item.display_name || item.slug}
            selected={model === item.slug} divider={index > 0} accessibilityRole="radio" onPress={() => selectModel(item.slug)} disabled={busy} />)
            : <Text style={styles.empty}>No models are available. Reconnect to try again.</Text>}
        </FormCard>
      </View>}
      <FormCard style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={18} color={COLORS.textLight} />
        <Text style={styles.privacyText}>Food descriptions and selected meal photos go directly to OpenAI. Your ChatGPT credentials stay on this phone.</Text>
      </FormCard>
    </FormScrollView>
  </FormScreen>;
}
const styles = StyleSheet.create({
  connectionHeading: { flexDirection: "row", gap: 12, alignItems: "center" },
  connectionIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#F6EEE7", alignItems: "center", justifyContent: "center" },
  headingCopy: { flex: 1, gap: 5 },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text,},
  status: { ...TYPOGRAPHY.caption, color: COLORS.textLight,},
  text: { ...TYPOGRAPHY.body, color: COLORS.textLight,},
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textLight,},
  action: { width: "100%", minHeight: 50 },
  checking: { flexDirection: "row", gap: 10, alignItems: "center", minHeight: 50 },
  section: { gap: 10 },
  sectionLabel: { ...TYPOGRAPHY.eyebrow, color: COLORS.textLight, marginLeft: 4},
  group: { padding: 0, gap: 0, overflow: "hidden" },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#F7F0E9", padding: 16 },
  privacyText: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.textLight,},
  empty: { ...TYPOGRAPHY.body, color: COLORS.textLight, padding: 18,},
});
