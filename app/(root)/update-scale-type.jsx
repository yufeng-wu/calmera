import { TYPOGRAPHY } from "@/constants/typography";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { FormCard, FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import ScaleOptions from "@/components/ScaleOptions";
import { USERS_API_URL } from "@/constants/api";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import usePageExit from "@/hooks/usePageExit";

export default function UpdateScaleType({ calmeraPreview = false }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");
  const { fontScale } = useWindowDimensions();
  const { getToken } = useAuth();
  const tokenRef = useRef(getToken); tokenRef.current = getToken;
  const savingRef = useRef(false);
  const [selected, setSelected] = useState("integer");
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!calmeraPreview);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [previewMessage, setPreviewMessage] = useState("");
  useEffect(() => {
    if (calmeraPreview) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setIsFetching(true); setLoadError(false);
    (async () => {
      const token = await tokenRef.current();
      const res = await fetch(`${USERS_API_URL}/get-user`, { signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      if (active) setSelected(data.scaleType || "integer");
    })().catch(() => { if (active) setLoadError(true); })
      .finally(() => { clearTimeout(timer); if (active) setIsFetching(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [calmeraPreview, retry]);
  const handleSave = async () => {
    if (savingRef.current || isFetching || loadError) return;
    if (calmeraPreview) { setPreviewMessage("Scale type saved in preview only."); return; }
    savingRef.current = true; setLoading(true);
    try {
      const token = await tokenRef.current();
      const res = await fetch(`${USERS_API_URL}/update-scale-type`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scaleType: selected }),
      });
      if (!res.ok) throw new Error("Failed to update scale type");
      Alert.alert("Success", "Scale type updated", [{ text: "OK", onPress: leave }]);
    } catch { Alert.alert("Error", "Unable to update scale type"); }
    finally { savingRef.current = false; setLoading(false); }
  };
  return <View style={formStyles.screen}>
    <FormHeader title="Scale calibration" onBack={leave} onSave={handleSave} saving={loading} saveDisabled={isFetching || loadError} />
    <ScrollView key={`text-size-${fontScale}`} contentContainerStyle={formStyles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}><Text accessibilityRole="header" style={styles.title}>Your kitchen scale</Text>
        <Text style={styles.caption}>Choose the display that matches your scale so Calmera can read it correctly.</Text></View>
      {isFetching ? <FormCard style={styles.feedback}><ActivityIndicator color={COLORS.primary} /><Text style={styles.caption}>Loading your scale type…</Text></FormCard>
        : loadError ? <FormCard><Text style={styles.title}>Couldn’t load your scale type</Text><Text style={styles.caption}>Your saved setting has not changed. Please try again.</Text>
          <GlassButton title="Try again" onPress={() => setRetry(value => value + 1)} /></FormCard>
          : <ScaleOptions selected={selected} onSelect={setSelected} disabled={loading} />}
      {!!previewMessage && <Text accessibilityLiveRegion="polite" style={styles.caption}>{previewMessage}</Text>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  intro: { gap: 8, paddingHorizontal: 4 },
  title: { ...TYPOGRAPHY.pageTitle, color: COLORS.text,},
  caption: { ...TYPOGRAPHY.body, color: COLORS.textLight,},
  feedback: { minHeight: 150, alignItems: "center", justifyContent: "center" },
});
