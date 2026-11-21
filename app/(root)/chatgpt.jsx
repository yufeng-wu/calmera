import { TYPOGRAPHY } from "@/constants/typography";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect, usePreventRemove } from "@react-navigation/native";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { createSettingsOperations } from "@/lib/chatgpt/settingsOperations.mjs";
import { readChatGPTConnection } from "@/lib/chatgpt/connectionOutcome.mjs";
import { connectionIssue, isAuthorizationCancelled } from "@/lib/chatgpt/connectionStatus.mjs";
import { selectNutritionModel } from "@/lib/chatgpt/modelSelection.mjs";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, GlassButton, MenuButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, SettingsTile, settingsStyles } from "@/components/SettingsSection";
import OpenAILogo from "@/components/OpenAILogo";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import usePageExit from "@/hooks/usePageExit";
import { createPlanClient, isChatGPTAvailable } from "@/lib/chatgpt/planClient";
import { apiKeyStore } from "@/lib/ai/mealAI";
import { providerFor } from "@/lib/ai/models.mjs";

const PREVIEW_MODELS = [{ slug: "calmera-preview", display_name: "ChatGPT model" }, { slug: "calmera-preview-fast", display_name: "ChatGPT fast model" }];
const settingsOperations = createSettingsOperations();
const emptyConnection = () => ({ connected: false, state: "disconnected", account: null, choices: [], selected: "", preferred: null, preferenceError: false, issue: null });

function chooseAction(title, options) {
  if (Platform.OS === "ios") ActionSheetIOS.showActionSheetWithOptions({
    title, options: [...options.map(option => option.title), "Cancel"], cancelButtonIndex: options.length,
    destructiveButtonIndex: options.findIndex(option => option.destructive) < 0 ? undefined : options.findIndex(option => option.destructive),
  }, index => options[index]?.onPress());
  else Alert.alert(title, undefined, [...options.map(option => ({ text: option.title, onPress: option.onPress,
    style: option.destructive ? "destructive" : "default" })), { text: "Cancel", style: "cancel" }]);
}

export default function ChatGPTSettings(props) {
  return <ChatGPTSettingsForm key={props.calmeraPreview ? `preview-${props.calmeraPreviewState}` : LOCAL_OWNER} userId={LOCAL_OWNER} {...props} />;
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
  const [keyInUse, setKeyInUse] = useState(null);
  const checking = useRef(true);
  const presentation = useRef(null);
  const scope = useFormTaskScope(owner, () => { checking.current = true; presentation.current = null; setAction("check"); setView("connection"); setNotice(null); });
  usePreventRemove(view === "models", () => { if (!presentation.current) setView("connection"); });

  // A saved API key is used instead of ChatGPT; say so here too.
  useFocusEffect(useCallback(() => {
    if (calmeraPreview) return;
    let active = true;
    apiKeyStore(owner).summary().then(saved => { if (active) setKeyInUse(saved ? providerFor(saved.provider)?.name : null); }, () => {});
    return () => { active = false; };
  }, [calmeraPreview, owner]));

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
      else if (kind === "model") setNotice("Couldn’t save your model. Try again.");
      else if (kind === "disconnect") setNotice("Couldn’t disconnect ChatGPT. Check your connection and try again.");
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

  const retry = () => runOperation("check", current => readChatGPTConnection(client, { isCurrent: current }), result => {
    if (!result) return;
    setConnection(result);
    if (result.issue?.kind === "sign-in") setView("connection");
  });
  const connect = newAccount => runOperation("connect", current => readChatGPTConnection(client, {
    authorize: true, connectOptions: { newAccount }, readWelcome: true, isCurrent: current,
  }), result => {
    if (!result) return;
    setConnection(result);
    if (result.welcomed === false) Alert.alert("You’re using your ChatGPT plan", "Meal estimates count toward it. Set limits anytime in ChatGPT settings.", [
      { text: "OK", onPress: () => client.markWelcomed?.().catch(() => {}) },
    ], { cancelable: false });
  });
  const signIn = () => {
    if (action || checking.current || presentation.current) return;
    if (connection.account?.hasRegistration) chooseAction("Continue with ChatGPT", [
      { title: connection.account.email ? `Continue as ${connection.account.email}` : "Continue with Saved Account", onPress: () => connect(false) },
      { title: "Use Another Account", onPress: () => connect(true) },
    ]);
    else connect(false);
  };
  // The "•••" menu opens from its button, as Mail's and Photos' do.
  const manageAccount = choice => {
    if (action || !connection.account || !scope.isActive()) return;
    if (choice === "Change Account") connect(true);
    else if (choice === "Disconnect") runOperation("disconnect", () => client.disconnect(), () => { setConnection(emptyConnection()); setView("connection"); });
  };
  const selectModel = slug => {
    if (!connection.preferenceError && slug === connection.preferred) { setView("connection"); return; }
    runOperation("model", () => client.setSelectedModel(slug), () => {
      setConnection(previous => ({ ...previous, preferred: slug, preferenceError: false, selected: selectNutritionModel(previous.choices, slug) || "" }));
      setView("connection");
    });
  };
  const manageUsage = () => { if (!calmeraPreview) Linking.openURL("https://chatgpt.com/settings/usage").catch(() => setNotice("Couldn’t open ChatGPT settings. Try again.")); };

  const preferredModel = connection.choices.find(item => item.slug === connection.preferred);
  const issue = available ? connection.issue : connectionIssue(new Error("development_build_required"));
  const pending = Boolean(action);
  const needsSignIn = issue?.kind === "sign-in";
  const linked = connection.connected && !needsSignIn;
  const title = action === "connect" ? "Connecting ChatGPT…" : action === "disconnect" ? "Disconnecting…"
    : linked ? "ChatGPT connected" : needsSignIn ? "ChatGPT sign-in required" : action === "check" ? "Checking ChatGPT…" : issue?.title || "Connect ChatGPT";
  const email = connection.account?.email;
  const defaultLabel = connection.preferenceError ? "Choose a model" : preferredModel?.display_name || connection.preferred || "Automatic";
  const automaticSelected = !connection.preferenceError && (!connection.preferred || (!connection.detailsError && !preferredModel));
  const savedChoiceUnconfirmed = connection.detailsError && connection.preferred && !preferredModel;
  const canSignIn = available && !pending && (needsSignIn || (!connection.connected && !issue));
  const canRetry = available && !pending && !linked && !canSignIn && issue?.action === "retry";

  return <FormScreen style={formStyles.screen}>
    <FormHeader title={view === "models" ? "Default model" : "ChatGPT"} onBack={view === "models" ? () => { if (!pending) { setView("connection"); setNotice(null); } } : leave} backDisabled={view === "models" && pending} />
    <FormScrollView key={`chatgpt-${view}-${fontScale}`} contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      {view === "models" ? <>
        <SettingsSection footnote={connection.detailsError ? <View style={styles.modelFeedback}>
          <Text style={settingsStyles.footnote}>{issue?.message || "Couldn’t load models. Your choice hasn’t changed."}</Text>
          {issue?.action === "retry" && <GlassButton title="Try again" symbol="arrow.clockwise" onPress={retry} disabled={pending} />}
        </View> : connection.preferred && !preferredModel ? "Your saved model isn’t available for this account, so Automatic is in use."
          : "Used to estimate your meals."}>
          <SettingsRow title="Automatic" subtitle="Picked for you." accessibilityRole="radio"
            selected={automaticSelected} onPress={() => selectModel(null)} disabled={pending} />
          {savedChoiceUnconfirmed && <SettingsRow title={connection.preferred} subtitle="Saved default" divider accessibilityRole="radio"
            selected onPress={() => selectModel(connection.preferred)} disabled={pending} />}
          {connection.choices.map(item => <SettingsRow key={item.slug} title={item.display_name || item.slug} divider accessibilityRole="radio"
            selected={connection.preferred === item.slug} onPress={() => selectModel(item.slug)} disabled={pending} />)}
        </SettingsSection>
        {pending && <ActivityIndicator color={COLORS.primary} accessibilityLabel={action === "model" ? "Saving default model" : "Loading available models"} />}
      </> : <>
        <SettingsSection label="Account" footnote={!linked && !canSignIn && !pending && issue ? issue.message : undefined}>
          <View style={styles.connectionHeader}>
            <SettingsTile tint="cocoa" size={40}><OpenAILogo /></SettingsTile>
            <View style={styles.statusCopy} accessibilityLiveRegion="polite">
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              {email ? <Text style={styles.detail} numberOfLines={1}>{email}</Text> : !pending && <Text style={styles.detail}>{linked ? "Connected on this phone" : "Use your ChatGPT plan in calmera."}</Text>}
            </View>
            {pending ? <ActivityIndicator color={COLORS.primary} accessible={false} /> : connection.account && <MenuButton actions symbol="ellipsis"
              title={connection.account.email || "ChatGPT account"} options={["Change Account", "Disconnect"]} destructiveOptions={["Disconnect"]}
              accessibilityLabel="Manage ChatGPT account" onChange={manageAccount} disabled={Boolean(action)} style={styles.accountMenu} />}
          </View>
          {(canSignIn || canRetry) && <View style={styles.signInAction}>
            <GlassButton title={canSignIn ? "Continue with ChatGPT" : "Try again"} symbol={canSignIn ? "" : "arrow.clockwise"} onPress={canSignIn ? signIn : retry} />
          </View>}
          {linked && <SettingsRow title="Default model" value={defaultLabel} icon="sparkles" tint="plum" divider
            onPress={() => { if (!pending) { setNotice(null); setView("models"); } }} disabled={pending} />}
        </SettingsSection>
        {connection.connected && <Pressable accessibilityRole="link" accessibilityLabel="Manage usage in ChatGPT"
          disabled={pending} onPress={manageUsage} style={({ pressed }) => [styles.usageLink, pressed && styles.linkPressed]}>
          <Text style={styles.linkText}>Manage usage in ChatGPT</Text><Ionicons name="open-outline" size={14} color={COLORS.primary} />
        </Pressable>}
      </>}
      {notice && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      {keyInUse && <Text style={settingsStyles.footnote}>Your {keyInUse} API key is in use, so meals don’t use ChatGPT right now. Remove the key in Settings → API key to switch back.</Text>}
      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={COLORS.textLight} accessible={false} />
        <Text style={styles.privacyText}>Only what you log goes to OpenAI. Your ChatGPT sign-in stays on this phone.</Text>
      </View>
    </FormScrollView>
  </FormScreen>;
}
const styles = StyleSheet.create({
  connectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  statusCopy: { flex: 1, gap: 2 },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  detail: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  accountMenu: { width: 48, height: 48 },
  signInAction: { paddingHorizontal: 16, paddingBottom: 16 },
  modelFeedback: { gap: 10 },
  usageLink: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, minHeight: 44, paddingHorizontal: 4, marginTop: -16 },
  linkText: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  linkPressed: { opacity: 0.45 },
  notice: { ...TYPOGRAPHY.caption, color: COLORS.primary, paddingHorizontal: 4 },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  privacyText: { ...TYPOGRAPHY.caption, color: COLORS.textLight, flex: 1 },
});
