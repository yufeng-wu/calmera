import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { FormScreen, FormScrollView, FormCard, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import usePageExit from "@/hooks/usePageExit";
import { getVoiceLanguage, setVoiceLanguage } from "@/lib/chatgpt/nutrition";

const LANGUAGES = [{ value: "en-US", label: "English" }, { value: "zh-CN", label: "中文" }];

export default function VoiceLanguage({ calmeraPreview = false }) {
  const router = useRouter();
  const leave = usePageExit("/settings");
  const { userId } = useAuth();
  const { fontScale } = useWindowDimensions();
  const [language, setLanguage] = useState(calmeraPreview ? "en-US" : null);
  const [loading, setLoading] = useState(!calmeraPreview);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const savingRequest = useRef(null);

  useEffect(() => {
    const ticket = ++generation.current;
    const current = () => generation.current === ticket;
    const cleanup = () => { if (current()) generation.current += 1; };
    savingRequest.current = null; setSaving(false); setLoadError(false);
    if (calmeraPreview) { setLanguage("en-US"); setLoading(false); return cleanup; }
    setLanguage(null); setLoading(true);
    if (!userId) { setLoading(false); setLoadError(true); return cleanup; }
    getVoiceLanguage(userId)
      .then(value => { if (current()) setLanguage(value); })
      .catch(() => { if (current()) setLoadError(true); })
      .finally(() => { if (current()) setLoading(false); });
    return cleanup;
  }, [calmeraPreview, userId, retry]);

  async function selectLanguage(value) {
    if (loading || loadError || savingRequest.current || value === language) return;
    if (calmeraPreview) { setLanguage(value); return; }
    if (!userId) return;
    const request = { ticket: generation.current };
    savingRequest.current = request; setSaving(true);
    try {
      // Same per-Calmera-user preference as before; no migration or ChatGPT
      // connection is required to change local recognition language.
      await setVoiceLanguage(userId, value);
      if (generation.current === request.ticket) setLanguage(value);
    } catch {
      if (generation.current === request.ticket) Alert.alert("Voice language", "Could not update your voice language. Please try again.");
    } finally {
      if (savingRequest.current === request) {
        savingRequest.current = null;
        if (generation.current === request.ticket) setSaving(false);
      }
    }
  }
  const back = () => calmeraPreview
    ? router.replace({ pathname: "/ui-gallery", params: { page: "settings" } }) : leave();

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Voice language" onBack={back} />
    <FormScrollView key={`voice-language-text-${fontScale}`} contentContainerStyle={formStyles.content}>
      <Text style={formStyles.caption}>Choose the language you speak when logging meals.</Text>
      {loading ? <FormCard style={styles.feedback}>
        <ActivityIndicator color={COLORS.primary} /><Text style={formStyles.caption}>Loading your language…</Text>
      </FormCard> : loadError ? <FormCard>
        <Text style={formStyles.sectionTitle}>Couldn’t load your voice language</Text>
        <Text style={formStyles.caption}>Your saved setting is unchanged.</Text>
        <GlassButton title="Try again" onPress={() => setRetry(value => value + 1)} />
      </FormCard> : <FormCard variant="grouped" style={styles.group}>
        {LANGUAGES.map((item, index) => <SettingsRow key={item.value} title={item.label}
          selected={language === item.value} divider={index > 0} accessibilityRole="radio"
          disabled={saving} onPress={() => selectLanguage(item.value)} />)}
      </FormCard>}
      {!loading && !loadError && <Text accessibilityLiveRegion="polite" style={formStyles.caption}>
        {calmeraPreview ? "Preview only · nothing is saved." : saving ? "Saving…" : "Changes are saved automatically."}
      </Text>}
    </FormScrollView>
  </FormScreen>;
}
const styles = StyleSheet.create({
  group: { padding: 0, gap: 0, overflow: "hidden" },
  feedback: { minHeight: 130, alignItems: "center", justifyContent: "center" },
});
