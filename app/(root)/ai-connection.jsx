import { TYPOGRAPHY } from "@/constants/typography";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, SettingsTile, settingsStyles } from "@/components/SettingsSection";
import OpenAILogo from "@/components/OpenAILogo";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TINTS } from "@/constants/settingsTheme";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { API_KEY_PROVIDERS, providerFor } from "@/lib/ai/models.mjs";
import { checkKeyShape, testOutcome } from "@/lib/ai/providers.mjs";
import { apiKeyIssue } from "@/lib/ai/apiKeyPresentation.mjs";
import { createConnectionStore } from "@/lib/ai/connection.mjs";
import { aiConnection, testKey } from "@/lib/ai/mealAI";
import { createPlanClient } from "@/lib/chatgpt/planClient";

// calmera has one AI connection at a time, chosen from three equals.
const CHOICES = [
  { type: "chatgpt", title: "ChatGPT", subtitle: "Sign in with your ChatGPT plan" },
  { type: "openai-key", provider: "openai", title: "OpenAI API key", subtitle: `Your own key · ${API_KEY_PROVIDERS.openai.modelName}` },
  { type: "claude-key", provider: "anthropic", title: "Claude API key", subtitle: `Your own key · ${API_KEY_PROVIDERS.anthropic.modelName}` },
];
const NAMES = { chatgpt: "ChatGPT sign-in", "openai-key": "OpenAI key", "claude-key": "Claude key" };
// Outcomes that prove nothing is wrong with the key itself, so it is saved.
const KEEP_ON = new Set(["works", "no-credit", "offline", "rate-limited", "busy"]);

const Mark = ({ type, size }) => type === "claude-key"
  ? <SettingsTile icon="sparkles" tint="tangerine" size={size} />
  : <SettingsTile tint="cocoa" size={size}><OpenAILogo /></SettingsTile>;

// The gallery preview runs on a Keychain in memory and never touches the network.
function previewServices(state) {
  const values = new Map(state === "claude-key"
    ? [["calmera.connection.preview", JSON.stringify({ type: "claude-key", key: "sk-ant-FAKE-preview-key-0000-WXYZ" })]] : []);
  let signedIn = state === "chatgpt";
  const store = createConnectionStore({ owner: "preview", secureStore: {
    getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); },
  }, chatgpt: { connected: async () => signedIn, forget: async () => { signedIn = false; } } });
  return { store, test: async () => (state === "error" ? "rejected" : "works"), account: async () => ({ email: "you@example.com" }) };
}

export default function AIConnectionSettings({ calmeraPreview = false, calmeraPreviewState = "none" }) {
  const router = useRouter();
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/settings");
  const { fontScale } = useWindowDimensions();
  const services = useMemo(() => calmeraPreview ? previewServices(calmeraPreviewState) : {
    store: aiConnection(LOCAL_OWNER), test: testKey, account: () => createPlanClient(LOCAL_OWNER).account(),
  }, [calmeraPreview, calmeraPreviewState]);
  const errorPreview = calmeraPreview && calmeraPreviewState === "error";
  const [current, setCurrent] = useState(undefined);
  const [email, setEmail] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState(errorPreview ? "claude-key" : null);
  const [draft, setDraft] = useState(errorPreview ? "sk-ant-FAKE-not-a-real-key-0000" : "");
  const [action, setAction] = useState(null);
  const [result, setResult] = useState(errorPreview ? { outcome: "rejected", provider: "anthropic", saved: false } : null);
  const generation = useRef(0);

  const load = useCallback(async isCurrent => {
    const connection = await services.store.read().catch(() => null);
    if (!isCurrent()) return;
    setCurrent(connection);
    if (connection?.type === "chatgpt") {
      const account = await services.account().catch(() => null);
      if (isCurrent()) setEmail(account?.email || null);
    }
  }, [services]);

  useFocusEffect(useCallback(() => {
    const visit = ++generation.current;
    load(() => generation.current === visit);
    return () => { generation.current += 1; };
  }, [load]));

  // Each step checks it still belongs to this visit before it shows anything.
  async function run(kind, work) {
    if (action) return;
    const visit = generation.current;
    setAction(kind); setResult(null);
    try { await work(() => generation.current === visit); }
    finally { if (generation.current === visit) setAction(null); }
  }

  const pick = choice => {
    if (action) return;
    if (choice.type === "chatgpt") { router.push("/chatgpt"); return; }
    setPicked(choice.type); setResult(null);
  };

  const pickedProvider = CHOICES.find(choice => choice.type === picked)?.provider;
  const saveKey = () => run("save", async isCurrent => {
    const provider = pickedProvider;
    let key;
    try { key = checkKeyShape(provider, draft); } catch (error) {
      setResult({ outcome: testOutcome(error), provider, saved: false });
      return;
    }
    const outcome = await services.test(provider, key).catch(() => "failed");
    if (!isCurrent()) return;
    if (!KEEP_ON.has(outcome)) { setResult({ outcome, provider, saved: false }); return; }
    try {
      // Saving it replaces the old connection; the store deletes the old credential after.
      const saved = await services.store.saveKey(provider, key);
      if (!isCurrent()) return;
      setCurrent(saved); setDraft(""); setPicked(null); setChoosing(false); setEmail(null);
      setResult({ outcome, provider, saved: true });
    } catch {
      if (isCurrent()) Alert.alert("Couldn’t save your key", "Your connection hasn’t changed. Try again.");
      if (isCurrent()) load(isCurrent);
    }
  });
  const save = () => {
    if (action || !pickedProvider || !draft.trim()) return;
    if (!current) { saveKey(); return; }
    const name = providerFor(pickedProvider).name;
    Alert.alert(`Replace your ${NAMES[current.type]}?`, `calmera uses one AI connection. Your ${NAMES[current.type]} is deleted from this iPhone once the ${name} key works.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Replace", onPress: saveKey },
    ]);
  };

  const test = () => run("test", async isCurrent => {
    const connection = await services.store.credential().catch(() => null);
    if (!isCurrent()) return;
    if (!connection?.key) { load(isCurrent); return; }
    const outcome = await services.test(connection.provider, connection.key).catch(() => "failed");
    if (isCurrent()) setResult({ outcome, provider: connection.provider, saved: true, tested: true });
  });

  const disconnect = () => {
    if (action || !current) return;
    const name = NAMES[current.type];
    Alert.alert(current.type === "chatgpt" ? "Disconnect ChatGPT?" : `Remove your ${name}?`,
      `It is deleted from this iPhone. AI logging stops until you choose a connection again; you can still add meals by hand.`, [
        { text: "Cancel", style: "cancel" },
        { text: current.type === "chatgpt" ? "Disconnect" : "Remove", style: "destructive", onPress: () => run("disconnect", async isCurrent => {
          try {
            await services.store.disconnect();
            if (isCurrent()) { setCurrent(null); setEmail(null); setChoosing(false); setPicked(null); }
          } catch {
            if (isCurrent()) Alert.alert("Couldn’t disconnect", "Your connection is still here. Try again.");
          }
        }) },
      ]);
  };

  const busy = Boolean(action);
  const showChoices = current === null || choosing;
  const choices = CHOICES.filter(choice => choice.type !== current?.type);
  const host = (picked && providerFor(pickedProvider)?.host) || (current?.provider && providerFor(current.provider).host)
    || (current?.type === "chatgpt" && "OpenAI");
  return <FormScreen style={formStyles.screen}>
    <FormHeader title="AI connection" onBack={choosing && !busy ? () => { setChoosing(false); setPicked(null); setResult(null); } : leave} />
    <FormScrollView key={`ai-connection-${fontScale}`} keyboardAware contentContainerStyle={settingsStyles.content}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={settingsStyles.lead}>
        calmera uses one AI connection to estimate meals from what you say, type or photograph.
      </Text>
      {/* The Keychain answers at once, so nothing stands in for it. */}
      {current === undefined ? null
        : showChoices ? <>
          <SettingsSection label={current ? "Switch to" : "Choose one"} footnote={current
            ? `Your ${NAMES[current.type]} stays until the new connection works, then it is deleted from this iPhone.` : undefined}>
            {choices.map((choice, index) => <SettingsRow key={choice.type} title={choice.title} subtitle={choice.subtitle}
              iconElement={<Mark type={choice.type} />} divider={index > 0} disabled={busy}
              accessibilityRole={choice.type === "chatgpt" ? "button" : "radio"} selected={picked === choice.type}
              showAccessory={choice.type === "chatgpt" || picked === choice.type} onPress={() => pick(choice)} />)}
          </SettingsSection>
          {pickedProvider && <SettingsSection label={`${providerFor(pickedProvider).name} key`}>
            <View style={styles.entry}>
              <TextInput value={draft} onChangeText={value => { setDraft(value); if (result) setResult(null); }}
                accessibilityLabel={`${providerFor(pickedProvider).name} API key`} placeholder={`Paste your ${providerFor(pickedProvider).name} key`}
                placeholderTextColor={COLORS.textLight} secureTextEntry autoCapitalize="none" autoCorrect={false} spellCheck={false}
                autoComplete="off" textContentType="none" editable={!busy} returnKeyType="done" onSubmitEditing={save}
                style={styles.input} maxLength={512} />
              <GlassButton title={action === "save" ? "Checking…" : "Save and test"} role="accent" onPress={save}
                disabled={busy || !draft.trim()} loading={action === "save"} />
            </View>
          </SettingsSection>}
        </> : <>
          <SettingsSection label="Connected">
            <View style={styles.header}>
              <Mark type={current.type} size={40} />
              <View style={styles.copy} accessible>
                <Text accessibilityRole="header" style={styles.title}>{current.type === "chatgpt" ? "ChatGPT" : CHOICES.find(choice => choice.type === current.type).title}</Text>
                <Text style={styles.detail} numberOfLines={1}>{current.type === "chatgpt" ? email || "Signed in on this phone" : current.masked}</Text>
              </View>
              {action === "disconnect" && <ActivityIndicator color={COLORS.primary} accessibilityLabel="Disconnecting" />}
            </View>
            {current.type === "chatgpt"
              ? <SettingsRow title="Model and account" icon="sparkles" tint="plum" divider disabled={busy} onPress={() => router.push("/chatgpt")} />
              : <>
                <SettingsRow title="Model" value={providerFor(current.provider).modelName} icon="sparkles" tint="plum" divider />
                <View style={styles.actions}>
                  <GlassButton title={action === "test" ? "Testing…" : "Test key"} symbol="checkmark.circle" onPress={test} disabled={busy} loading={action === "test"} />
                </View>
              </>}
          </SettingsSection>
          <SettingsSection>
            <SettingsRow title="Use another connection" icon="swap-horizontal" tint="sky" disabled={busy}
              onPress={() => { if (!busy) { setChoosing(true); setResult(null); } }} />
            <SettingsRow title="Disconnect" icon="close" tint="rose" destructive divider showAccessory={false} disabled={busy} onPress={disconnect} />
          </SettingsSection>
        </>}
      {result && <Result result={result} />}
      {!!host && <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={COLORS.textLight} accessible={false} />
        <Text style={styles.privacyText}>{current?.type === "chatgpt" && !picked
          ? "Only what you log goes to OpenAI. Your ChatGPT sign-in stays on this phone."
          : `Your key stays in this iPhone’s Keychain. calmera sends it only to ${host}, straight from your phone.`}</Text>
      </View>}
    </FormScrollView>
  </FormScreen>;
}

// What a save or test found, in a sentence: green when the key works, red when it doesn't.
function Result({ result }) {
  const provider = providerFor(result.provider);
  if (result.outcome === "works") return <View style={styles.result} accessibilityRole="alert" accessibilityLiveRegion="polite">
    <Ionicons name="checkmark-circle" size={18} color={TINTS.leaf.icon} accessible={false} />
    <Text style={[styles.resultText, styles.works]}>
      {result.tested ? `Works. Meals use ${provider.modelName}.` : `Connected. Meals now use ${provider.modelName}.`}
    </Text>
  </View>;
  const issue = apiKeyIssue(result.outcome, result.provider) || apiKeyIssue("failed", result.provider);
  return <View style={styles.result} accessibilityRole="alert" accessibilityLiveRegion="polite">
    <Ionicons name="alert-circle" size={18} color={COLORS.expense} accessible={false} />
    <Text style={[styles.resultText, styles.problem]}>
      <Text style={styles.resultTitle}>{issue.title}. </Text>
      {issue.message}{result.saved && !result.tested ? " Your key is saved." : result.saved ? "" : " Nothing was changed."}
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  copy: { flex: 1, gap: 2 },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  detail: { ...TYPOGRAPHY.caption, color: COLORS.textLight, fontVariant: ["tabular-nums"], letterSpacing: 0.5 },
  actions: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  entry: { padding: 16, gap: 12 },
  // No lineHeight: on iOS it pushes a one-line field's text off its centre.
  input: { fontSize: TYPOGRAPHY.input.fontSize, fontWeight: TYPOGRAPHY.input.fontWeight, color: COLORS.text, height: 48,
    paddingHorizontal: 14, borderRadius: 14, backgroundColor: COLORS.track, borderWidth: 0.5, borderColor: "#E4D6CA" },
  result: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4, marginTop: -8 },
  resultText: { ...TYPOGRAPHY.caption, flex: 1 },
  resultTitle: { ...TYPOGRAPHY.captionMedium },
  works: { color: TINTS.leaf.icon },
  problem: { color: COLORS.expense },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  privacyText: { ...TYPOGRAPHY.caption, color: COLORS.textLight, flex: 1 },
});
