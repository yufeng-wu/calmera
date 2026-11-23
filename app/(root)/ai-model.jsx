import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import { AI_PAGE, SETTINGS } from "@/constants/settingsTheme";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { PROVIDER_PAGES } from "@/lib/ai/loggingProblem.mjs";
import { providerFor } from "@/lib/ai/models.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { previewConnectionServices } from "@/lib/ai/previewConnection.mjs";

// Which model estimates meals, the same page for ChatGPT and for a key: every model the
// connection can use, by name, newest first. One is already checked so logging always works.
// Choosing another takes effect on the next meal; nothing reconnects.
export default function AIModel({ calmeraPreview = false, calmeraPreviewState = "chatgpt" }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/ai-connection");
  const { fontScale } = useWindowDimensions();
  const services = useMemo(() => (calmeraPreview ? previewConnectionServices(calmeraPreviewState) : connectionServices(LOCAL_OWNER)),
    [calmeraPreview, calmeraPreviewState]);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [problem, setProblem] = useState(null);
  const visit = useRef(0);

  const load = useCallback(async () => {
    const mine = ++visit.current;
    setLoading(true);
    const next = await services.models().catch(() => null);
    if (visit.current !== mine) return;
    setCatalog(next);
    setLoading(false);
  }, [services]);
  useFocusEffect(useCallback(() => { load(); return () => { visit.current += 1; }; }, [load]));

  const choose = async choice => {
    if (loading || saving || !catalog || choice.id === catalog.selected) return;
    const mine = visit.current;
    Haptics.selectionAsync().catch(() => {});
    setSaving(choice.id); setProblem(null);
    try {
      await services.setModel(catalog, choice);
      if (visit.current === mine) setCatalog(previous => ({ ...previous, selected: choice.id }));
    } catch {
      if (visit.current === mine) setProblem("Couldn’t save your model. Try again.");
    } finally { if (visit.current === mine) setSaving(null); }
  };

  const company = catalog ? (catalog.provider === "chatgpt" ? "ChatGPT" : providerFor(catalog.provider)?.company) : null;
  const footnote = catalog?.issue
    ? <View style={styles.recover}>
      <Text style={settingsStyles.footnote}>{catalog.issue.kind === "sign-in" ? catalog.issue.message : "Couldn’t load ChatGPT’s models. Your choice hasn’t changed."}</Text>
      {catalog.issue.action === "retry" && <GlassButton title="Try again" symbol="arrow.clockwise" onPress={load} />}
    </View>
    : problem ? <Text accessibilityRole="alert" style={settingsStyles.problem}>{problem}</Text>
      : catalog?.fromFallback ? <View style={styles.recover}>
        <Text style={settingsStyles.footnote}>{`Couldn’t get the full list from ${company}, so these are the ones Calmera knows.`}</Text>
        <GlassButton title="Try again" symbol="arrow.clockwise" onPress={load} />
      </View>
        : calmeraPreview ? "Preview only · nothing is saved." : undefined;

  return <FormScreen style={[formStyles.screen, styles.page]}>
    <FormHeader title="Model" onBack={leave} />
    <FormScrollView key={`ai-model-${fontScale}`} contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      {!loading && !catalog && <Text style={settingsStyles.lead}>Connect an AI to choose its model.</Text>}
      {(loading || catalog) && <SettingsSection cardStyle={styles.card} footnote={loading ? undefined : footnote}>
        {loading && <View style={styles.loading} accessible accessibilityRole="progressbar" accessibilityLabel="Loading models"
          accessibilityState={{ busy: true }}>
          <ActivityIndicator color={SETTINGS.accent} accessible={false} />
          <Text style={settingsStyles.footnote}>Loading models…</Text>
        </View>}
        {catalog?.models.map((model, index) => <SettingsRow key={model.id} title={model.name} accessibilityRole="radio" divider={loading || index > 0}
          selected={catalog.selected === model.id} loading={saving === model.id} disabled={loading || Boolean(saving)} onPress={() => choose(model)} />)}
      </SettingsSection>}
      {catalog?.provider === "chatgpt" && <SettingsSection cardStyle={styles.card}>
        <SettingsRow title="Manage usage" subtitle="These estimates use your ChatGPT plan." onPress={() => {
          if (!calmeraPreview) Linking.openURL(PROVIDER_PAGES.chatgpt.url).catch(() => Alert.alert("Couldn’t open ChatGPT settings", "Please try again."));
        }} />
      </SettingsSection>}
    </FormScrollView>
  </FormScreen>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: AI_PAGE.page },
  card: { backgroundColor: AI_PAGE.card },
  loading: { flexDirection: "row", alignItems: "center", gap: SETTINGS.rowGap, minHeight: SETTINGS.rowHeight,
    paddingHorizontal: SETTINGS.rowPadding, paddingVertical: 12 },
  recover: { gap: 10 },
});
