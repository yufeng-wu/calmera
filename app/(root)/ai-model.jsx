import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { SETTINGS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { providerFor } from "@/lib/ai/models.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { previewConnectionServices } from "@/lib/ai/previewConnection.mjs";

// Long lists get a search field; short ones don't need it.
const SEARCH_FROM = 9;

// Which model estimates meals, the same page for ChatGPT and for a key. The recommended one is
// already chosen and listed first; every other model the connection can use follows, newest
// first, in plain words. Choosing one takes effect on the next meal; nothing reconnects.
export default function AIModel({ calmeraPreview = false, calmeraPreviewState = "chatgpt" }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/ai-connection");
  const { fontScale } = useWindowDimensions();
  const services = useMemo(() => (calmeraPreview ? previewConnectionServices(calmeraPreviewState) : connectionServices(LOCAL_OWNER)),
    [calmeraPreview, calmeraPreviewState]);
  // undefined while it loads, null with no connection.
  const [catalog, setCatalog] = useState(undefined);
  const [query, setQuery] = useState("");
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

  const recommended = catalog?.models?.[0];
  const others = catalog?.models?.slice(1) || [];
  const needle = query.trim().toLowerCase();
  const shown = needle ? others.filter(model => `${model.name} ${model.id}`.toLowerCase().includes(needle)) : others;
  const company = catalog ? (catalog.provider === "chatgpt" ? "ChatGPT" : providerFor(catalog.provider)?.company) : null;
  const row = (model, index) => <SettingsRow key={model.id} title={model.name} subtitle={model.detail || undefined} accessibilityRole="radio"
    divider={index > 0} selected={catalog.selected === model.id} loading={saving === model.id} disabled={Boolean(saving)} onPress={() => choose(model)} />;

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Model" onBack={leave} />
    <FormScrollView key={`ai-model-${fontScale}`} keyboardAware contentContainerStyle={settingsStyles.content}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
      {catalog === null && <Text style={settingsStyles.lead}>Connect an AI to choose its model.</Text>}
      {catalog && <>
        <SettingsSection label="Recommended" footnote={catalog.issue
          ? <View style={styles.recover}>
            <Text style={settingsStyles.footnote}>{catalog.issue.kind === "sign-in" ? catalog.issue.message : "Couldn’t load ChatGPT’s models. Your choice hasn’t changed."}</Text>
            {catalog.issue.action === "retry" && <GlassButton title="Try again" symbol="arrow.clockwise" onPress={load} />}
          </View> : undefined}>
          {recommended && row(recommended, 0)}
        </SettingsSection>
        {others.length > 0 && <>
          {others.length >= SEARCH_FROM && <View style={styles.search}>
            <Ionicons name="search" size={16} color={SETTINGS.inkSoft} accessible={false} />
            <TextInput value={query} onChangeText={setQuery} accessibilityLabel="Search models" placeholder="Search models"
              placeholderTextColor={COLORS.textLight} autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing"
              returnKeyType="search" style={styles.searchInput} />
          </View>}
          <SettingsSection label="All models" footnote={problem
            ? <Text accessibilityRole="alert" style={settingsStyles.problem}>{problem}</Text>
            : catalog.fromFallback ? <View style={styles.recover}>
              <Text style={settingsStyles.footnote}>{`Couldn’t get the full list from ${company}, so these are the ones calmera knows.`}</Text>
              <GlassButton title="Try again" symbol="arrow.clockwise" onPress={load} />
            </View>
              : calmeraPreview ? "Preview only · nothing is saved." : "Used from the next meal you log."}>
            {shown.length ? shown.map((model, index) => row(model, index))
              : <Text style={styles.empty}>{`No model matches “${query.trim()}”.`}</Text>}
          </SettingsSection>
        </>}
        {needle && others.length >= SEARCH_FROM && <Pressable accessibilityRole="button" onPress={() => setQuery("")} style={styles.clear}>
          <Text style={styles.clearText}>Show all models</Text>
        </Pressable>}
      </>}
    </FormScrollView>
  </FormScreen>;
}

const styles = StyleSheet.create({
  recover: { gap: 10 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: COLORS.track, marginBottom: -8 },
  // No lineHeight: on iOS it pushes a one-line field's text off its centre.
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.text, height: 44 },
  empty: { ...TYPOGRAPHY.body, color: SETTINGS.inkSoft, padding: SETTINGS.rowPadding },
  clear: { alignSelf: "center", minHeight: 44, justifyContent: "center", marginTop: -12 },
  clearText: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
});
