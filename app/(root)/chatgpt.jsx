import { TYPOGRAPHY } from "@/constants/typography";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useFocusEffect, usePreventRemove } from "@react-navigation/native";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import { createSettingsOperations } from "@/lib/chatgpt/settingsOperations.mjs";
import { readChatGPTConnection } from "@/lib/chatgpt/connectionOutcome.mjs";
import { connectionIssue, isAuthorizationCancelled } from "@/lib/chatgpt/connectionStatus.mjs";
import { selectNutritionModel } from "@/lib/chatgpt/modelSelection.mjs";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormCard, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import OpenAILogo, { OPENAI_BLOSSOM_SYMBOL } from "@/components/OpenAILogo";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import usePageExit from "@/hooks/usePageExit";
import { createPlanClient, isChatGPTAvailable } from "@/lib/chatgpt/planClient";

const PREVIEW_MODELS = [{ slug: "calmera-preview", display_name: "ChatGPT model" }, { slug: "calmera-preview-fast", display_name: "ChatGPT fast model" }];
const settingsOperations = createSettingsOperations();
const emptyConnection = () => ({ connected: false, state: "disconnected", account: null, choices: [], selected: "", preferred: null, issue: null });

function chooseAction(title, options) {
  if (Platform.OS === "ios") ActionSheetIOS.showActionSheetWithOptions({
    title, options: [...options.map(option => option.title), "Cancel"], cancelButtonIndex: options.length,
    destructiveButtonIndex: options.findIndex(option => option.destructive) < 0 ? undefined : options.findIndex(option => option.destructive),
  }, index => options[index]?.onPress());
  else Alert.alert(title, undefined, [...options.map(option => ({ text: option.title, onPress: option.onPress,
    style: option.destructive ? "destructive" : "default" })), { text: "Cancel", style: "cancel" }]);
}

export default function ChatGPTSettings(props) {
  const { userId } = useAuth();
  return <ChatGPTSettingsForm key={props.calmeraPreview ? `preview-${props.calmeraPreviewState}` : userId || "signed-out"} userId={userId} {...props} />;
}

function ChatGPTSettingsForm({ userId, calmeraPreview = false, calmeraPreviewState = "connected" }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");
  const { fontScale } = useWindowDimensions();
  const owner = calmeraPreview ? "calmera-ui-preview" : userId;
  const client = useMemo(() => {
    if (!calmeraPreview) return userId ? createPlanClient(userId) : null;
    let connected = calmeraPreviewState !== "disconnected", preferred = null, attempts = 0;
    return {
      connected: async () => connected,
      account: async () => connected ? { email: "you@example.com", hasRegistration: true } : null,
      connect: async () => { connected = true; }, disconnect: async () => { connected = false; },
      models: async () => { if (calmeraPreviewState === "catalog-error" && ++attempts === 1) throw new TypeError("synthetic_network_failure"); return PREVIEW_MODELS; },
      getSelectedModel: async () => preferred, setSelectedModel: async value => { preferred = value; },
      hasWelcomed: async () => true,
    };
  }, [calmeraPreview, calmeraPreviewState, userId]);
  const available = calmeraPreview || isChatGPTAvailable();
  const [connection, setConnection] = useState(emptyConnection);
  const [action, setAction] = useState("check");
  const [view, setView] = useState("connection");
  const [notice, setNotice] = useState(null);
  const checking = useRef(true);
  const presentation = useRef(null);
  const scope = useFormTaskScope(owner, () => { checking.current = true; presentation.current = null; setAction("check"); setView("connection"); setNotice(null); });
  usePreventRemove(view === "models", () => { if (!presentation.current) setView("connection"); });

  useFocusEffect(useCallback(() => {
    const task = scope.start();
    if (!task) return;
    let active = true;
    const current = () => active && task.isCurrent();
    checking.current = true; setAction("check");
    (async () => {
      // A pending provider callback or model write survives leaving this page.
      // Wait before reading it; never start another native sign-in on refocus.
      let pending = calmeraPreview ? null : settingsOperations.current(owner);
      while (pending) {
        await pending.promise.catch(() => {});
        if (!current()) return;
        pending = settingsOperations.current(owner);
      }
      if (!client || !available) {
        if (current()) setConnection({ ...emptyConnection(), issue: connectionIssue(new Error("development_build_required")), state: "unavailable" });
        return;
      }
      const result = await readChatGPTConnection(client, { isCurrent: current });
      if (current() && result) setConnection(result);
    })().catch(error => {
      if (current()) setConnection(previous => ({ ...previous, state: connectionIssue(error).kind, issue: connectionIssue(error) }));
    }).finally(() => {
      task.finish();
      if (current()) { checking.current = false; setAction(null); }
    });
    return () => { active = false; task.finish(); };
  }, [scope, owner, client, available, calmeraPreview]));

  async function runOperation(kind, work, apply) {
    if (!client || !available || !scope.isActive() || checking.current || presentation.current
      || (!calmeraPreview && settingsOperations.current(owner))) return;
    const task = scope.start();
    if (!task) return;
    const current = () => task.isCurrent();
    const operation = calmeraPreview ? { promise: Promise.resolve().then(() => work(current)) } : settingsOperations.start(owner, kind, () => work(current));
    if (!operation) { task.finish(); return; }
    presentation.current = task; setAction(kind); setNotice(null);
    try {
      const result = await operation.promise;
      if (task.isCurrent()) apply(result);
    } catch (error) {
      if (!task.isCurrent() || (kind === "connect" && isAuthorizationCancelled(error))) return;
      if (kind === "check") setConnection(previous => ({ ...previous, state: connectionIssue(error).kind, issue: connectionIssue(error) }));
      else if (kind === "model") setNotice("Your model choice couldn’t be saved. Please try again.");
      else if (kind === "disconnect") setNotice("We couldn’t disconnect ChatGPT. Please try again when your connection is available.");
      else {
        const account = await client.account?.().catch(() => null);
        if (!task.isCurrent()) return;
        if (connection.connected) setNotice("Sign-in didn’t finish. Your previous ChatGPT account is still selected.");
        else setConnection(previous => ({ ...previous, account, state: "sign-in", issue: {
          kind: "sign-in", title: "Sign-in didn’t finish", message: connectionIssue(error).message, action: "sign-in",
        } }));
      }
    } finally {
      task.finish();
      if (presentation.current === task) { presentation.current = null; if (task.isCurrent()) setAction(null); }
    }
  }

  const retry = () => runOperation("check", current => readChatGPTConnection(client, { isCurrent: current }), setConnection);
  const connect = newAccount => runOperation("connect", current => readChatGPTConnection(client, {
    authorize: true, connectOptions: { newAccount }, readWelcome: true, isCurrent: current,
  }), result => {
    if (!result) return;
    setConnection(result);
    if (result.welcomed === false) Alert.alert("You’re using your ChatGPT plan", "Eligible AI requests use your ChatGPT plan. Manage your limits in ChatGPT settings.", [
      { text: "Got it", onPress: () => client.markWelcomed?.().catch(() => {}) },
    ], { cancelable: false });
  });
  const signIn = () => {
    if (action || checking.current || presentation.current) return;
    if (connection.account?.hasRegistration) chooseAction("Continue with ChatGPT", [
      { title: connection.account.email ? `Continue as ${connection.account.email}` : "Continue with saved account", onPress: () => connect(false) },
      { title: "Use another account", onPress: () => connect(true) },
    ]);
    else connect(false);
  };
  const manageAccount = () => {
    if (action || !connection.account || !scope.isActive()) return;
    chooseAction(connection.account.email || "ChatGPT account", [
      { title: "Change account", onPress: () => connect(true) },
      { title: "Disconnect", destructive: true, onPress: () => runOperation("disconnect", () => client.disconnect(), () => { setConnection(emptyConnection()); setView("connection"); }) },
    ]);
  };
  const selectModel = slug => {
    if (slug === connection.preferred) { setView("connection"); return; }
    runOperation("model", () => client.setSelectedModel(slug), () => {
      setConnection(previous => ({ ...previous, preferred: slug, selected: selectNutritionModel(previous.choices, slug) || "" }));
      setView("connection");
    });
  };
  const manageUsage = () => { if (!calmeraPreview) Linking.openURL("https://chatgpt.com/settings/usage").catch(() => setNotice("ChatGPT settings couldn’t open. Please try again.")); };

  const ready = connection.state === "ready";
  const preferredModel = connection.choices.find(item => item.slug === connection.preferred);
  const issue = available ? connection.issue : connectionIssue(new Error("development_build_required"));
  const pending = Boolean(action);
  const title = action === "check" ? "Checking connection…" : action === "connect" ? "Connecting to ChatGPT…"
    : action === "disconnect" ? "Disconnecting…" : issue?.title || (ready ? "Connected" : "Connect your ChatGPT plan");
  const detail = action ? null : issue?.message || (ready ? "Using your ChatGPT plan for meal estimates." : "Estimate meal nutrition with your own ChatGPT plan.");
  const primary = pending ? null : issue?.action || (!connection.connected && !issue ? "sign-in" : null);

  return <FormScreen style={formStyles.screen}>
    <FormHeader title={view === "models" ? "Model" : "ChatGPT"} onBack={view === "models" ? () => { if (!pending) { setView("connection"); setNotice(null); } } : leave} backDisabled={view === "models" && pending} />
    <FormScrollView key={`chatgpt-${view}-${fontScale}`} contentContainerStyle={formStyles.content} showsVerticalScrollIndicator={false}>
      {view === "models" ? <>
        <Text style={styles.sectionNote}>Choose a model for your meal estimates.</Text>
        <FormCard style={styles.group}>
          <SettingsRow title="Automatic" subtitle="Calmera chooses an available model." accessibilityRole="radio"
            selected={!preferredModel} onPress={() => selectModel(null)} disabled={pending} />
          {connection.choices.map(item => <SettingsRow key={item.slug} title={item.display_name || item.slug} divider accessibilityRole="radio"
            selected={connection.preferred === item.slug} onPress={() => selectModel(item.slug)} disabled={pending} />)}
        </FormCard>
        {connection.preferred && !preferredModel && <Text style={styles.sectionNote}>Your saved model isn’t available for this account. Automatic selection is being used.</Text>}
        {action === "model" && <ActivityIndicator color={COLORS.primary} accessibilityLabel="Saving model" />}
      </> : <>
        <FormCard style={styles.statusCard}>
          <View style={styles.statusHeading}>
            <View style={styles.brandBadge}><OpenAILogo /></View>
            <View style={styles.statusCopy} accessibilityLiveRegion="polite">
              <View style={styles.titleRow}>
                <Text accessibilityRole="header" style={styles.title}>{title}</Text>
                {pending ? <ActivityIndicator color={COLORS.primary} accessible={false} /> : ready && <View style={styles.connectedDot} />}
              </View>
              {detail && <Text style={styles.detail}>{detail}</Text>}
            </View>
          </View>
          {primary && <GlassButton title={primary === "sign-in" ? "Continue with ChatGPT" : primary === "usage" ? "Manage usage" : "Try again"}
            symbol={primary === "sign-in" ? OPENAI_BLOSSOM_SYMBOL : primary === "usage" ? "arrow.up.right" : "arrow.clockwise"}
            onPress={primary === "sign-in" ? signIn : primary === "usage" ? manageUsage : retry} disabled={!available} style={styles.primary} />}
        </FormCard>
        {(connection.account || ready) && <FormCard style={styles.group}>
          {connection.account && <SettingsRow title="Account" subtitle={connection.account.email || "Saved ChatGPT account"}
            icon="person-outline" onPress={manageAccount} disabled={pending} />}
          {ready && <SettingsRow title="Model" subtitle={preferredModel?.display_name || preferredModel?.slug || "Automatic"} icon="sparkles-outline"
            divider={Boolean(connection.account)} onPress={() => { if (!pending) { setNotice(null); setView("models"); } }} disabled={pending} />}
        </FormCard>}
        {connection.connected && primary !== "usage" && <Pressable accessibilityRole="link" accessibilityLabel="Manage usage in ChatGPT"
          disabled={pending} onPress={manageUsage} style={styles.usageLink}>
          <Text style={styles.linkText}>Manage usage in ChatGPT</Text><Ionicons name="open-outline" size={14} color={COLORS.primary} />
        </Pressable>}
      </>}
      {notice && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={COLORS.textLight} accessible={false} />
        <Text style={styles.privacyText}>Only the food details you submit go to OpenAI. Your ChatGPT credentials stay on this phone.</Text>
      </View>
    </FormScrollView>
  </FormScreen>;
}
const styles = StyleSheet.create({
  statusCard: { gap: 20 },
  statusHeading: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  brandBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F7F0E9", alignItems: "center", justifyContent: "center" },
  statusCopy: { flex: 1, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text, flexShrink: 1 },
  detail: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  connectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#6F9E7C" },
  primary: { minHeight: 50 },
  group: { padding: 0, gap: 0, overflow: "hidden" },
  sectionNote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, marginHorizontal: 4 },
  usageLink: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, minHeight: 44, paddingHorizontal: 4, marginTop: -10 },
  linkText: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  notice: { ...TYPOGRAPHY.caption, color: COLORS.primary, paddingHorizontal: 4 },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  privacyText: { ...TYPOGRAPHY.caption, color: COLORS.textLight, flex: 1 },
});
