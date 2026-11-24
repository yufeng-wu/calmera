import { useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import { VOICE_LANGUAGES, createVoiceLanguagePreferences } from "@/lib/voice/voiceLanguagePreferences.mjs";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { FormScreen, FormScrollView, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/settings/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/settings/SettingsSection";
import usePageExit from "@/hooks/usePageExit";
import { getVoiceLanguage, setVoiceLanguage } from "@/lib/chatgpt/nutrition";

export default function VoiceLanguage({ calmeraPreview = false, calmeraPreviewState = "ready" }) {
  const router = useRouter();
  const leave = usePageExit("/settings");
  const userId = LOCAL_OWNER;
  const { fontScale } = useWindowDimensions();
  const focused = useIsFocused();
  const errorPreview = calmeraPreview && ["load-error", "save-error"].includes(calmeraPreviewState);
  const owner = calmeraPreview ? `calmera-voice-preview:${calmeraPreviewState}` : userId;
  const ownerRef = useRef(owner);
  const previewPreferences = useMemo(() => {
    if (!errorPreview) return null;
    let stored = "en-US", reads = 0, writes = 0;
    return createVoiceLanguagePreferences({
      getItem: async () => {
        if (++reads === 1 && calmeraPreviewState === "load-error") throw new Error("synthetic_read_failure");
        return stored;
      },
      setItem: async (_key, value) => {
        stored = value;
        if (++writes === 1 && calmeraPreviewState === "save-error") throw new Error("synthetic_write_failure");
      },
    });
  }, [errorPreview, calmeraPreviewState]);
  const [language, setLanguage] = useState(calmeraPreview && !errorPreview ? "en-US" : null);
  const [loading, setLoading] = useState(!calmeraPreview || errorPreview);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const loadingRef = useRef(!calmeraPreview || errorPreview);
  const confirmed = useRef(null);
  if (ownerRef.current !== owner) { loadingRef.current = true; confirmed.current = null; }
  ownerRef.current = owner;
  const loadingRequest = useRef(null);
  const savingRequest = useRef(null);
  const scope = useFormTaskScope(owner, () => {
    // Reset only presentation. The shared preference coordinator retains any
    // native write; the new focus read waits for its actual settlement.
    loadingRequest.current = null; savingRequest.current = null;
    confirmed.current = null; loadingRef.current = true; setSaving(false);
  });

  useEffect(() => {
    if (!focused) return;
    const task = scope.start();
    if (!task) return;
    let active = true;
    const current = () => active && task.isCurrent() && ownerRef.current === owner;
    loadingRequest.current = task;
    confirmed.current = null; loadingRef.current = true;
    setSaving(false); setLoadError(false);
    const finish = () => {
      task.finish();
      if (loadingRequest.current === task) {
        loadingRequest.current = null;
        if (current()) { loadingRef.current = false; setLoading(false); }
      }
    };
    if (calmeraPreview && !errorPreview) {
      confirmed.current = { owner, language: "en-US" };
      setLanguage("en-US"); finish();
      return () => { active = false; task.finish(); };
    }
    setLanguage(null); setLoading(true);
    if (!calmeraPreview && !userId) {
      setLoadError(true); finish();
      return () => { active = false; task.finish(); };
    }
    const options = { signal: task.signal, isActive: current };
    const read = calmeraPreview ? previewPreferences.load(owner, options) : getVoiceLanguage(userId, options);
    read.then(value => {
      if (current()) { confirmed.current = { owner, language: value }; setLanguage(value); }
    }).catch(() => {
      if (current()) { confirmed.current = null; setLanguage(null); setLoadError(true); }
    })
      .finally(finish);
    return () => { active = false; task.finish(); };
  }, [scope, owner, calmeraPreview, errorPreview, previewPreferences, userId, retry, focused]);

  const retryLoad = () => {
    if (ownerRef.current !== owner || !scope.isActive() || loadingRef.current || savingRequest.current) return;
    confirmed.current = null; loadingRef.current = true; setLoading(true);
    setRetry(value => value + 1);
  };
  async function selectLanguage(value) {
    if (ownerRef.current !== owner || !scope.isActive() || loadingRef.current || loadError
      || savingRequest.current || !confirmed.current || confirmed.current.owner !== owner
      || value === confirmed.current.language) return;
    if (calmeraPreview && !errorPreview) { confirmed.current = { owner, language: value }; setLanguage(value); return; }
    if (!calmeraPreview && !userId) return;
    const task = scope.start();
    if (!task) return;
    const current = () => task.isCurrent() && ownerRef.current === owner;
    savingRequest.current = task; confirmed.current = null; setSaving(true);
    try {
      // Writes remain serialized even if this page blurs. Only presentation is
      // focus-scoped; a reopened page reads the confirmed stored preference.
      if (calmeraPreview) await previewPreferences.save(owner, value);
      else await setVoiceLanguage(userId, value);
      if (current()) { confirmed.current = { owner, language: value }; setLanguage(value); }
    } catch {
      if (current()) { confirmed.current = null; setLanguage(null); setLoadError(true); }
    } finally {
      task.finish();
      if (savingRequest.current === task) {
        savingRequest.current = null;
        if (current()) setSaving(false);
      }
    }
  }
  const back = () => calmeraPreview
    ? router.replace({ pathname: "/ui-gallery", params: { page: "settings" } }) : leave();

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Voice language" onBack={back} />
    <FormScrollView key={`voice-language-text-${fontScale}`} contentContainerStyle={settingsStyles.content}>
      {loadError ? <SettingsSection label="Language">
        <View style={styles.problem}>
          <Text style={formStyles.sectionTitle}>Couldn’t confirm your voice language</Text>
          <GlassButton title="Try again" symbol="arrow.clockwise" onPress={retryLoad} />
        </View>
      </SettingsSection>
        // While the saved choice loads, the rows keep their place without a check, so nothing jumps.
        // The note stays put while a choice saves; the check already shows it took.
        : <SettingsSection label="Language" footnote={calmeraPreview ? "Preview only · nothing is saved."
          : "Used when you log by voice."}>
          {VOICE_LANGUAGES.map((item, index) => <SettingsRow key={item.value} title={item.label}
            selected={!loading && language === item.value} divider={index > 0} accessibilityRole="radio"
            disabled={saving || loading} onPress={() => { if (item.value !== language) Haptics.selectionAsync().catch(() => {}); selectLanguage(item.value); }} />)}
        </SettingsSection>}
    </FormScrollView>
  </FormScreen>;
}
const styles = StyleSheet.create({
  problem: { padding: 18, gap: 10 },
});
