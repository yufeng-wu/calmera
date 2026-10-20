import { TYPOGRAPHY } from "@/constants/typography";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useFocusEffect } from "@react-navigation/native";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import { createSettingsOperations } from "@/lib/chatgpt/settingsOperations.mjs";
import { readChatGPTConnection } from "@/lib/chatgpt/connectionOutcome.mjs";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormCard, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import usePageExit from "@/hooks/usePageExit";
import { createPlanClient, isChatGPTAvailable } from "@/lib/chatgpt/planClient";
import { friendlyError } from "@/lib/chatgpt/protocol.mjs";

const PREVIEW_MODELS = [{ slug: "calmera-preview", display_name: "ChatGPT model" }, { slug: "calmera-preview-fast", display_name: "ChatGPT fast model" }];
// Owner model writes and the shared provider listener outlive page reopening.
// Only UI presentation is cancelled when a focus scope ends.
const settingsOperations = createSettingsOperations();

export default function ChatGPTSettings({ calmeraPreview = false, calmeraPreviewState = "connected" }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");
  const { fontScale } = useWindowDimensions();
  const { userId } = useAuth();
  const owner = calmeraPreview ? "calmera-ui-preview" : userId;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const client = useMemo(() => !calmeraPreview && userId ? createPlanClient(userId) : null, [calmeraPreview, userId]);
  const catalogErrorPreview = calmeraPreview && calmeraPreviewState === "catalog-error";
  const previewClient = useMemo(() => {
    if (!catalogErrorPreview) return null;
    let attempts = 0;
    return {
      connected: async () => true,
      models: async () => {
        if (++attempts === 1) throw new Error("synthetic_catalog_unavailable");
        return PREVIEW_MODELS;
      },
      getSelectedModel: async () => PREVIEW_MODELS[0].slug,
    };
  }, [catalogErrorPreview]);
  const [connected, setConnected] = useState(calmeraPreview && calmeraPreviewState !== "disconnected");
  const [busy, setBusy] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [checking, setChecking] = useState(!calmeraPreview);
  const [connectionError, setConnectionError] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(false);
  const [models, setModels] = useState(calmeraPreview && !catalogErrorPreview ? PREVIEW_MODELS : []);
  const [model, setModel] = useState(calmeraPreview && !catalogErrorPreview ? PREVIEW_MODELS[0].slug : "");
  const checkingRef = useRef(!calmeraPreview);
  const presentationTask = useRef(null);
  const available = calmeraPreview || isChatGPTAvailable();
  const scope = useFormTaskScope(owner, () => {
    // Reset presentation only. A still-pending write remains in the module
    // mutex and the focus check waits for it before reading the saved choice.
    presentationTask.current = null;
    checkingRef.current = true;
    setBusy(false); setSavingModel(false); setDetailsLoading(false);
  });

  useFocusEffect(useCallback(() => {
    const task = scope.start();
    if (!task) return;
    let active = true;
    const current = () => active && task.isCurrent() && ownerRef.current === owner;
    checkingRef.current = true;
    setChecking(!calmeraPreview || catalogErrorPreview);
    setDetailsError(false); setConnectionError(false);
    let pending = calmeraPreview ? null : settingsOperations.current(owner);
    setBusy(pending?.kind === "connect");
    setSavingModel(pending?.kind === "model");
    (async () => {
      if (calmeraPreview && !catalogErrorPreview) {
        setConnected(calmeraPreviewState !== "disconnected");
        setModels(PREVIEW_MODELS);
        setModel(value => PREVIEW_MODELS.some(item => item.slug === value) ? value : PREVIEW_MODELS[0].slug);
        return;
      }
      setConnected(false); setModels([]); setModel("");
      const detailsClient = calmeraPreview ? previewClient : client;
      if (!detailsClient) return;
      while (pending) {
        // Native Connect is process-wide; an owner's earlier model write can
        // also still be settling. Drain both before reading confirmed state.
        await pending.promise.catch(() => {});
        if (!current()) return;
        pending = settingsOperations.current(owner);
        setBusy(pending?.kind === "connect");
        setSavingModel(pending?.kind === "model");
      }
      const outcome = await readChatGPTConnection(detailsClient, {
        isCurrent: current,
        onConnection: value => {
          if (!current()) return;
          setConnected(value); setConnectionError(false); setChecking(false); setDetailsLoading(value);
        },
      });
      if (current() && outcome) {
        setModels(outcome.choices); setModel(outcome.selected); setDetailsError(outcome.detailsError);
      }
    })().catch(() => {
      if (current()) {
        setConnectionError(true);
        Alert.alert("ChatGPT", "Couldn’t check your connection. Reconnect to try again.");
      }
    }).finally(() => {
      task.finish();
      if (current()) {
        checkingRef.current = false;
        setChecking(false); setBusy(false); setSavingModel(false); setDetailsLoading(false);
      }
    });
    return () => { active = false; task.finish(); };
  }, [scope, owner, client, previewClient, calmeraPreview, calmeraPreviewState, catalogErrorPreview]));

  async function retryModels() {
    if (ownerRef.current !== owner || !scope.isActive() || checkingRef.current || presentationTask.current
      || (!calmeraPreview && settingsOperations.current(owner))) return;
    const detailsClient = calmeraPreview ? previewClient : client;
    if (!detailsClient || !connected) return;
    const task = scope.start();
    if (!task) return;
    const current = () => task.isCurrent() && ownerRef.current === owner;
    const load = () => readChatGPTConnection(detailsClient, { knownConnected: true, isCurrent: current });
    // Preview must never inspect or acquire production provider/storage locks.
    const operation = calmeraPreview ? { promise: load() } : settingsOperations.start(owner, "details", load);
    if (!operation) { task.finish(); return; }
    presentationTask.current = task;
    setDetailsLoading(true);
    try {
      const outcome = await operation.promise;
      if (!current() || !outcome) return;
      setModels(outcome.choices); setModel(outcome.selected); setDetailsError(outcome.detailsError);
    } catch {
      if (current()) { setModels([]); setModel(""); setDetailsError(true); }
    } finally {
      task.finish();
      if (presentationTask.current === task) {
        presentationTask.current = null;
        if (current()) setDetailsLoading(false);
      }
    }
  }
  async function connect() {
    if (ownerRef.current !== owner || !scope.isActive() || checkingRef.current || presentationTask.current
      || (!calmeraPreview && settingsOperations.current(owner))) return;
    if (catalogErrorPreview) { await retryModels(); return; }
    if (calmeraPreview) { setConnected(true); setModels(PREVIEW_MODELS); setModel(value => PREVIEW_MODELS.some(item => item.slug === value) ? value : PREVIEW_MODELS[0].slug); return; }
    if (!client) return;
    const task = scope.start();
    if (!task) return;
    const current = () => task.isCurrent() && ownerRef.current === owner;
    const operation = settingsOperations.start(owner, "connect", () => readChatGPTConnection(client, {
      authorize: true, readWelcome: true, isCurrent: current,
      onConnection: value => {
        if (!current()) return;
        setConnected(value); setConnectionError(false); setModels([]); setModel(""); setDetailsError(false);
        setBusy(false); setDetailsLoading(value);
      },
    }));
    if (!operation) { task.finish(); return; }
    presentationTask.current = task;
    setBusy(true);
    try {
      const outcome = await operation.promise;
      if (!current() || !outcome) return;
      setConnected(outcome.connected); setModels(outcome.choices); setModel(outcome.selected); setDetailsError(outcome.detailsError);
      if (outcome.welcomed === false) Alert.alert("You are using your ChatGPT plan", "Eligible requests in foodwrap use your own ChatGPT plan. foodwrap is free. Review usage and app limits in ChatGPT settings.", [
        { text: "Got it", onPress: () => { if (current()) client.markWelcomed().catch(() => {}); } },
      ], { cancelable: false });
    } catch (error) { if (current()) Alert.alert("ChatGPT", friendlyError(error)); }
    finally {
      task.finish();
      if (presentationTask.current === task) {
        presentationTask.current = null;
        if (current()) { setBusy(false); setDetailsLoading(false); }
      }
    }
  }
  async function selectModel(slug) {
    if (ownerRef.current !== owner || !scope.isActive() || checkingRef.current || presentationTask.current
      || (!calmeraPreview && settingsOperations.current(owner)) || slug === model) return;
    if (calmeraPreview) { setModel(slug); return; }
    if (!client) return;
    const task = scope.start();
    if (!task) return;
    const current = () => task.isCurrent() && ownerRef.current === owner;
    const operation = settingsOperations.start(owner, "model", () => client.setSelectedModel(slug));
    if (!operation) { task.finish(); return; }
    presentationTask.current = task;
    setSavingModel(true);
    try {
      await operation.promise;
      if (current()) setModel(slug);
    } catch {
      if (current()) Alert.alert("ChatGPT", "Couldn’t save your model choice. Please try again.");
    } finally {
      task.finish();
      if (presentationTask.current === task) {
        presentationTask.current = null;
        if (current()) setSavingModel(false);
      }
    }
  }
  return <FormScreen style={formStyles.screen}>
    <FormHeader title="ChatGPT" onBack={leave} />
    <FormScrollView key={`text-size-${fontScale}`} contentContainerStyle={formStyles.content} showsVerticalScrollIndicator={false}>
      <FormCard>
        <View style={styles.connectionHeading}>
          <View style={styles.connectionIcon}><Ionicons name="sparkles-outline" size={24} color={COLORS.primary} /></View>
          <View style={styles.headingCopy}><Text accessibilityRole="header" style={styles.title}>{checking || connectionError ? "Your ChatGPT plan" : connected ? "ChatGPT connected" : "Connect ChatGPT"}</Text>
            <View style={styles.statusLine} accessibilityLiveRegion="polite">
              {(checking || savingModel || detailsLoading) && <ActivityIndicator size="small" color={COLORS.primary} accessible={false} />}
              <Text style={styles.status}>{busy ? "Connecting…" : savingModel ? "Saving model…" : checking ? "Checking connection…" : detailsLoading ? "Loading models…" : connectionError ? "Connection status unavailable" : connected ? "Connected on this phone" : "Not connected"}</Text>
            </View></View>
        </View>
        <Text style={styles.text}>Use your own ChatGPT plan in foodwrap. Your plan limits apply. Your food records stay in your existing foodwrap account.</Text>
        {!available && <Text style={styles.text}>This build does not include ChatGPT connection. Please use an updated iOS build.</Text>}
        {!checking && <GlassButton title={connected ? "Reconnect ChatGPT" : "Connect ChatGPT"} symbol="sparkles"
            loading={busy} disabled={!available || savingModel || detailsLoading} onPress={connect} style={styles.action} />}
        {connected && !checking && <GlassButton title="Manage usage in ChatGPT" symbol="arrow.up.right" disabled={busy || savingModel || detailsLoading}
          onPress={() => { if (!calmeraPreview) Linking.openURL("https://chatgpt.com/settings/usage").catch(() => {}); }} style={styles.action} />}
      </FormCard>
      {connected && !checking && (!detailsLoading || models.length > 0 || detailsError) && <View style={styles.section}>
        <Text style={styles.sectionLabel}>MODEL</Text>
        <FormCard style={styles.group}>
          {models.length ? models.map((item, index) => <SettingsRow key={item.slug} title={item.display_name || item.slug}
            selected={model === item.slug} divider={index > 0} accessibilityRole="radio" onPress={() => selectModel(item.slug)} disabled={busy || savingModel || detailsLoading} />)
            : <View style={styles.modelFeedback}>
              <Text style={styles.text}>{detailsError ? "Models couldn’t load. Try again, or reconnect ChatGPT." : "No models are available for your ChatGPT plan right now."}</Text>
              <GlassButton title="Retry models" symbol="arrow.clockwise" disabled={busy || savingModel || detailsLoading} onPress={retryModels} style={styles.action} />
            </View>}
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
  statusLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  status: { ...TYPOGRAPHY.caption, color: COLORS.textLight, flexShrink: 1},
  text: { ...TYPOGRAPHY.body, color: COLORS.textLight,},
  action: { width: "100%", minHeight: 50 },
  section: { gap: 10 },
  sectionLabel: { ...TYPOGRAPHY.eyebrow, color: COLORS.textLight, marginLeft: 4},
  group: { padding: 0, gap: 0, overflow: "hidden" },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#F7F0E9", padding: 16 },
  privacyText: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.textLight,},
  modelFeedback: { padding: 18, gap: 12 },
});
