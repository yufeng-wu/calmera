import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import Constants from "expo-constants";
import { useAuth } from "@clerk/clerk-expo";
import { FormHeader, GlassButton } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { createPlanClient } from "@/lib/chatgpt/planClient";
import useFormTaskScope from "@/hooks/useFormTaskScope";

// Full-test-build-only, explicit one-shot action. Opening a URL never starts
// inference; no records, account details, credentials or response text shown.
export default function FastModeCheck() {
  const enabled = Constants.expoConfig?.extra?.calmeraFullAppTest === true;
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const started = useRef(false);
  const scope = useFormTaskScope(userId);
  const [status, setStatus] = useState("Ready for one explicit capability check.");
  const [model, setModel] = useState("");
  const [tier, setTier] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!enabled || !isLoaded || !userId || started.current || !scope.isActive()) return;
    const task = scope.start();
    if (!task) return;
    started.current = true;
    setBusy(true);
    setStatus("Checking the current connection…");
    try {
      const client = createPlanClient(userId);
      if (!await client.connected()) throw new Error("chatgpt_sign_in_required");
      const selected = await client.getSelectedModel();
      const catalog = await client.models();
      const current = catalog.find(item => item.slug === selected)?.slug || catalog[0]?.slug;
      if (!current) throw new Error("no_available_model");
      if (!task.isCurrent()) return;
      setModel(current);
      setStatus("Sending one minimal Fast request…");
      const result = await client.checkFastMode({ model: current, signal: task.signal });
      if (!task.isCurrent()) return;
      setTier(result.serviceTier || "Not reported by the server");
      setStatus(["fast", "priority"].includes(result.serviceTier)
        ? "Verified for this request. App defaults have not been changed."
        : "Fast mode was not verified. App defaults have not been changed.");
    } catch (error) {
      if (task.isCurrent()) setStatus(error.message === "chatgpt_sign_in_required"
        ? "ChatGPT is not connected in this simulator. No inference request was sent."
        : `Check did not complete: ${/^openai_http_[0-9]{3}$/.test(error.message) ? error.message : "connection or capability unavailable"}${error.apiCode ? ` · ${error.apiCode}` : ""}${error.apiParameter ? " · service_tier" : ""}. No automatic retry.`);
    } finally {
      task.finish();
      if (task.isCurrent()) setBusy(false);
    }
  };
  if (!enabled) return <Redirect href="/dashboard" />;
  return <View style={styles.page}>
    <FormHeader title="Fast mode check" onBack={() => router.replace("/settings")} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.body}>One fixed “Reply with exactly OK” request through the existing ChatGPT connection. No meals are saved.</Text>
      <GlassButton title="Run one Fast check" onPress={run} disabled={busy || started.current} />
      {!!model && <Text style={styles.body}>Current model: {model}</Text>}
      <Text style={styles.body}>Requested tier: priority (Fast mode)</Text>
      {!!tier && <Text style={styles.body}>Server tier: {tier}</Text>}
      {busy && <ActivityIndicator color={COLORS.primary} />}
      <Text accessibilityLiveRegion="polite" style={styles.body}>{status}</Text>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, content: { padding: 20, gap: 16 },
  body: { ...TYPOGRAPHY.body, color: COLORS.text } });
