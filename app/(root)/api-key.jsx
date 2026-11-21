import { TYPOGRAPHY } from "@/constants/typography";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, GlassButton, MenuButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, SettingsTile, settingsStyles } from "@/components/SettingsSection";
import OpenAILogo from "@/components/OpenAILogo";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TINTS } from "@/constants/settingsTheme";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { API_KEY_PROVIDERS, PROVIDER_IDS, providerFor } from "@/lib/ai/models.mjs";
import { checkKeyShape, testOutcome } from "@/lib/ai/providers.mjs";
import { apiKeyIssue } from "@/lib/ai/apiKeyPresentation.mjs";
import { createApiKeyStore } from "@/lib/ai/apiKeyStore.mjs";
import { apiKeyStore, testKey } from "@/lib/ai/mealAI";
import { createPlanClient, isChatGPTAvailable } from "@/lib/chatgpt/planClient";

// Outcomes that still prove nothing is wrong with the key itself, so it is kept.
const KEEP_ON = new Set(["works", "no-credit", "offline", "rate-limited", "busy"]);
const PREVIEW_KEY = "sk-ant-FAKE-preview-key-0000-WXYZ";
const ORDER = ["openai", "anthropic"];

const ProviderMark = ({ provider, size }) => provider === "openai"
  ? <SettingsTile tint="cocoa" size={size}><OpenAILogo /></SettingsTile>
  : <SettingsTile icon="sparkles" tint="tangerine" size={size} />;

// The gallery preview runs on a Keychain in memory and a test that never touches the network.
function previewServices(state) {
  const values = new Map(state === "saved" ? [["calmera.apikey.preview", JSON.stringify({ provider: "anthropic", key: PREVIEW_KEY })]] : []);
  const store = createApiKeyStore({
    getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); },
  }, "preview");
  return { store, test: async () => (state === "error" ? "rejected" : "works"), chatgpt: async () => state === "saved" };
}

export default function ApiKeySettings({ calmeraPreview = false, calmeraPreviewState = "empty" }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/settings");
  const { fontScale } = useWindowDimensions();
  const services = useMemo(() => calmeraPreview ? previewServices(calmeraPreviewState) : {
    store: apiKeyStore(LOCAL_OWNER), test: testKey,
    chatgpt: async () => isChatGPTAvailable() && Boolean(await createPlanClient(LOCAL_OWNER).connected()),
  }, [calmeraPreview, calmeraPreviewState]);
  const errorPreview = calmeraPreview && calmeraPreviewState === "error";
  const [saved, setSaved] = useState(undefined);
  const [chatgpt, setChatgpt] = useState(false);
  const [provider, setProvider] = useState(errorPreview ? "anthropic" : "openai");
  const [draft, setDraft] = useState(errorPreview ? "sk-ant-FAKE-not-a-real-key-0000" : "");
  const [action, setAction] = useState(null);
  const [result, setResult] = useState(errorPreview ? { outcome: "rejected", provider: "anthropic", saved: false } : null);
  const generation = useRef(0);

  useFocusEffect(useCallback(() => {
    const visit = ++generation.current;
    Promise.all([services.store.summary().catch(() => null), services.chatgpt().catch(() => false)]).then(([summary, connected]) => {
      if (generation.current !== visit) return;
      setSaved(summary);
      setChatgpt(Boolean(connected));
      if (summary) setProvider(summary.provider);
    });
    return () => { generation.current += 1; };
  }, [services]));

  // Each step checks it still belongs to this visit before it shows anything.
  async function run(kind, work) {
    if (action) return;
    const visit = generation.current;
    setAction(kind); setResult(null);
    try { await work(() => generation.current === visit); }
    finally { if (generation.current === visit) setAction(null); }
  }

  const save = () => run("save", async current => {
    let key;
    try { key = checkKeyShape(provider, draft); } catch (error) {
      setResult({ outcome: testOutcome(error), provider, saved: false });
      return;
    }
    const outcome = await services.test(provider, key).catch(() => "failed");
    if (!current()) return;
    if (!KEEP_ON.has(outcome)) { setResult({ outcome, provider, saved: false }); return; }
    try {
      const summary = await services.store.save(provider, key);
      if (!current()) return;
      setSaved(summary); setDraft("");
      setResult({ outcome, provider, saved: true });
    } catch {
      if (current()) Alert.alert("Couldn’t save your key", "Nothing was saved. Try again.");
    }
  });

  const test = () => run("test", async current => {
    const stored = await services.store.read().catch(() => null);
    if (!current()) return;
    if (!stored) { setSaved(null); return; }
    const outcome = await services.test(stored.provider, stored.key).catch(() => "failed");
    if (current()) setResult({ outcome, provider: stored.provider, saved: true, tested: true });
  });

  const remove = () => {
    if (action || !saved) return;
    const name = providerFor(saved.provider).name;
    Alert.alert(`Remove your ${name} key?`, chatgpt ? "Meals will use your ChatGPT sign-in again."
      : "Voice and photo logging stop until you add a key or sign in to ChatGPT.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => run("remove", async current => {
        try {
          await services.store.remove();
          if (current()) { setSaved(null); setResult(null); }
        } catch {
          if (current()) Alert.alert("Couldn’t remove your key", "It is still saved. Try again.");
        }
      }) },
    ]);
  };

  const active = saved && providerFor(saved.provider);
  const chosen = API_KEY_PROVIDERS[provider];
  const busy = Boolean(action);
  return <FormScreen style={formStyles.screen}>
    <FormHeader title="API key" onBack={leave} />
    <FormScrollView key={`api-key-${fontScale}`} keyboardAware contentContainerStyle={settingsStyles.content}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={settingsStyles.lead}>
        Use your own OpenAI or Claude key for voice, text and photo logging. Each meal is a small charge on that account.
      </Text>
      {saved === undefined ? null : active ? <>
        <SettingsSection label="In use" footnote={chatgpt
          ? "Meals use this key. Your ChatGPT sign-in is kept, and comes back if you remove the key."
          : "Meals use this key."}>
          <View style={styles.keyHeader}>
            <ProviderMark provider={active.id} size={40} />
            <View style={styles.keyCopy} accessible accessibilityLabel={`${active.name} key in use, ending in ${saved.masked.slice(-4).split("").join(" ")}`}>
              <Text accessibilityRole="header" style={styles.title}>{active.name} key</Text>
              <Text style={styles.masked} numberOfLines={1}>{saved.masked}</Text>
            </View>
            <MenuButton actions symbol="ellipsis" title={`${active.name} key`} options={["Remove Key"]} destructiveOptions={["Remove Key"]}
              accessibilityLabel={`Manage ${active.name} key`} onChange={remove} disabled={busy} style={styles.menu} />
          </View>
          <SettingsRow title="Model" value={active.modelName} icon="sparkles" tint="plum" divider />
          <View style={styles.actions}>
            <GlassButton title={action === "test" ? "Testing…" : "Test key"} symbol="checkmark.circle" onPress={test} disabled={busy} loading={action === "test"} />
          </View>
        </SettingsSection>
      </> : <>
        <SettingsSection label="Provider">
          {ORDER.filter(id => PROVIDER_IDS.includes(id)).map((id, index) => {
            const item = API_KEY_PROVIDERS[id];
            return <SettingsRow key={id} title={item.name} subtitle={item.modelName} accessibilityRole="radio" divider={index > 0}
              iconElement={<ProviderMark provider={id} />} selected={provider === id} disabled={busy}
              onPress={() => { if (!busy) { setProvider(id); setResult(null); } }} />;
          })}
        </SettingsSection>
        <SettingsSection label={`${chosen.name} key`} footnote={chatgpt ? "While a key is saved, meals use it instead of your ChatGPT sign-in." : undefined}>
          <View style={styles.entry}>
            <TextInput value={draft} onChangeText={value => { setDraft(value); if (result) setResult(null); }}
              accessibilityLabel={`${chosen.name} API key`} placeholder={`Paste your ${chosen.name} key`} placeholderTextColor={COLORS.textLight}
              secureTextEntry autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off" textContentType="none"
              editable={!busy} returnKeyType="done" onSubmitEditing={save} style={styles.input} maxLength={512} />
            <GlassButton title={action === "save" ? "Checking…" : "Save and test"} role="accent" onPress={save}
              disabled={busy || !draft.trim()} loading={action === "save"} />
          </View>
        </SettingsSection>
      </>}
      {result && <Result result={result} />}
      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={14} color={COLORS.textLight} accessible={false} />
        <Text style={styles.privacyText}>
          Your key stays in this iPhone’s Keychain. calmera sends it only to {(active || chosen).host}, straight from your phone.
        </Text>
      </View>
    </FormScrollView>
  </FormScreen>;
}

// What a save or test found, in a sentence: green when the key works, red when it doesn't.
function Result({ result }) {
  const provider = providerFor(result.provider);
  if (result.outcome === "works") return <View style={styles.result} accessibilityRole="alert" accessibilityLiveRegion="polite">
    <Ionicons name="checkmark-circle" size={18} color={TINTS.leaf.icon} accessible={false} />
    <Text style={[styles.resultText, styles.works]}>
      {result.tested ? `Works. Meals use ${provider.modelName}.` : `Saved and working. Meals now use ${provider.modelName}.`}
    </Text>
  </View>;
  const issue = apiKeyIssue(result.outcome, result.provider) || apiKeyIssue("failed", result.provider);
  return <View style={styles.result} accessibilityRole="alert" accessibilityLiveRegion="polite">
    <Ionicons name="alert-circle" size={18} color={COLORS.expense} accessible={false} />
    <Text style={[styles.resultText, styles.problem]}>
      <Text style={styles.resultTitle}>{issue.title}. </Text>
      {issue.message}{result.saved && !result.tested ? " Your key is saved." : result.saved ? "" : " Nothing was saved."}
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  keyHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  keyCopy: { flex: 1, gap: 2 },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  masked: { ...TYPOGRAPHY.caption, color: COLORS.textLight, fontVariant: ["tabular-nums"], letterSpacing: 0.5 },
  menu: { width: 48, height: 48 },
  actions: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  entry: { padding: 16, gap: 12 },
  // No lineHeight: on iOS it pushes a one-line field's text off its centre.
  input: { fontSize: TYPOGRAPHY.input.fontSize, fontWeight: TYPOGRAPHY.input.fontWeight, color: COLORS.text, height: 48, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: COLORS.track, borderWidth: 0.5, borderColor: "#E4D6CA" },
  result: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4, marginTop: -8 },
  resultText: { ...TYPOGRAPHY.caption, flex: 1 },
  resultTitle: { ...TYPOGRAPHY.captionMedium },
  works: { color: TINTS.leaf.icon },
  problem: { color: COLORS.expense },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  privacyText: { ...TYPOGRAPHY.caption, color: COLORS.textLight, flex: 1 },
});
