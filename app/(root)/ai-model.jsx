import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
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
  // undefined while it loads, null with no connection.
  const [catalog, setCatalog] = useState(undefined);
  const [saving, setSaving] = useState(null);
  const [problem, setProblem] = useState(null);
  const visit = useRef(0);

  const load = useCallback(async () => {
    const mine = ++visit.current;
    const next = await services.models().catch(() => null);
    if (visit.current === mine) setCatalog(next);
  }, [services]);
  useFocusEffect(useCallback(() => { load(); return () => { visit.current += 1; }; }, [load]));

  const choose = async choice => {
    if (saving || !catalog || choice.id === catalog.selected) return;
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
        <Text style={settingsStyles.footnote}>{`Couldn’t get the full list from ${company}, so these are the ones calmera knows.`}</Text>
        <GlassButton title="Try again" symbol="arrow.clockwise" onPress={load} />
      </View>
        : calmeraPreview ? "Preview only · nothing is saved." : "Used from the next meal you log.";

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Model" onBack={leave} />
    <FormScrollView key={`ai-model-${fontScale}`} contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      {catalog === null && <Text style={settingsStyles.lead}>Connect an AI to choose its model.</Text>}
      {catalog && <SettingsSection footnote={footnote}>
        {catalog.models.map((model, index) => <SettingsRow key={model.id} title={model.name} accessibilityRole="radio" divider={index > 0}
          selected={catalog.selected === model.id} loading={saving === model.id} disabled={Boolean(saving)} onPress={() => choose(model)} />)}
      </SettingsSection>}
    </FormScrollView>
  </FormScreen>;
}

const styles = StyleSheet.create({
  recover: { gap: 10 },
});
