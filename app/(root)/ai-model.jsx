import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { connectionIssue } from "@/lib/chatgpt/connectionStatus.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { previewConnectionServices } from "@/lib/ai/previewConnection.mjs";

// Which ChatGPT model estimates meals. Automatic is the choice for nearly everyone, so this
// sits one tap below the connection page. Laid out like Voice language: tap a row, the check moves.
export default function AIModel({ calmeraPreview = false, calmeraPreviewState = "chatgpt" }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/ai-connection");
  const { fontScale } = useWindowDimensions();
  const services = useMemo(() => (calmeraPreview ? previewConnectionServices(calmeraPreviewState) : connectionServices(LOCAL_OWNER)),
    [calmeraPreview, calmeraPreviewState]);
  // preferred: undefined until read, null for Automatic, else a model's slug.
  const [catalog, setCatalog] = useState({ choices: [], preferred: undefined, issue: null });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);
  const visit = useRef(0);

  const load = useCallback(async () => {
    const mine = ++visit.current;
    let details;
    try { details = await services.chatgpt(); } catch (error) { details = { issue: connectionIssue(error) }; }
    if (visit.current !== mine) return;
    setCatalog({ choices: details.choices || [], issue: details.issue || null,
      // A choice that couldn't be read is unknown, not Automatic: no row gets a check it hasn't earned.
      preferred: details.preferenceError || !("preferred" in details) ? undefined : details.preferred ?? null });
  }, [services]);
  useFocusEffect(useCallback(() => { load(); return () => { visit.current += 1; }; }, [load]));

  const choose = async slug => {
    if (saving || catalog.preferred === undefined || slug === catalog.preferred) return;
    const mine = visit.current;
    Haptics.selectionAsync().catch(() => {});
    setSaving(true); setProblem(null);
    try {
      await services.setModel(slug);
      if (visit.current === mine) setCatalog(previous => ({ ...previous, preferred: slug }));
    } catch {
      if (visit.current === mine) setProblem("Couldn’t save your model. Try again.");
    } finally { if (visit.current === mine) setSaving(false); }
  };

  const { choices, preferred, issue } = catalog;
  const known = preferred !== undefined;
  const listed = choices.some(item => item.slug === preferred);
  const gone = known && preferred && choices.length > 0 && !listed;
  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Model" onBack={leave} />
    <FormScrollView key={`ai-model-${fontScale}`} contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      {/* Automatic keeps its place while the list loads, so nothing jumps when the models arrive. */}
      <SettingsSection footnote={issue ? <View style={styles.recover}>
        <Text style={settingsStyles.footnote}>{issue.kind === "sign-in" ? issue.message : "Couldn’t load ChatGPT’s models. Your choice hasn’t changed."}</Text>
        {issue.action === "retry" && <GlassButton title="Try again" symbol="arrow.clockwise" onPress={load} />}
      </View> : problem ? <Text accessibilityRole="alert" style={settingsStyles.problem}>{problem}</Text>
        : gone ? "The model you chose isn’t offered to this account any more, so Automatic is in use."
          : calmeraPreview ? "Preview only · nothing is saved." : "Used to estimate your meals."}>
        <SettingsRow title="Automatic" subtitle="Picked for you" accessibilityRole="radio" disabled={saving || !known}
          selected={known && (!preferred || gone)} onPress={() => choose(null)} />
        {/* A saved choice stays listed even when the catalog can't be read. */}
        {known && preferred && !choices.length && <SettingsRow title={preferred} divider accessibilityRole="radio" selected disabled />}
        {choices.map(item => <SettingsRow key={item.slug} title={item.display_name || item.slug} divider accessibilityRole="radio"
          disabled={saving || !known} selected={preferred === item.slug} onPress={() => choose(item.slug)} />)}
      </SettingsSection>
    </FormScrollView>
  </FormScreen>;
}

const styles = StyleSheet.create({
  recover: { gap: 10 },
});
