import { TYPOGRAPHY } from "@/constants/typography";
import { useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import GuideGallery from "@/components/GuideGallery";
import ScaleOptions from "@/components/ScaleOptions";
import { GlassButton } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { USERS_API_URL } from "@/constants/api";
import usePageExit from "@/hooks/usePageExit";

export default function CalmeraWelcomeScreen({ calmeraPreview = false }) {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const navigation = useNavigation();
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");
  const { getToken } = useAuth();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const savingRef = useRef(false);
  const start = async () => {
    if (savingRef.current || !selected) return;
    if (calmeraPreview) { setPreviewMessage("Scale selected. Preview only; camera stays closed."); return; }
    savingRef.current = true; setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${USERS_API_URL}/update-scale-type`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scaleType: selected }),
      });
      if (!res.ok) throw new Error("Failed to save scale type");
      if (typeof navigation.popToTop === "function") navigation.popToTop();
      router.push("/(root)/camera");
    } catch { Alert.alert("Error", "Unable to save scale type"); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <GuideGallery title="Welcome to Calmera" onBack={leave} finalPage={
    <ScrollView key={`text-size-${fontScale}`} contentContainerStyle={styles.selector} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}><Text accessibilityRole="header" style={styles.title}>Select your scale type</Text>
        <Text style={styles.description}>Choose the display that matches your kitchen scale. This helps Calmera read its measurements correctly.</Text></View>
      <ScaleOptions selected={selected} onSelect={setSelected} disabled={saving} />
      <GlassButton title="Start Using Calmera AI" symbol="arrow.right" onPress={start} loading={saving}
        disabled={!selected} style={styles.start} />
      {!!previewMessage && <Text accessibilityLiveRegion="polite" style={styles.description}>{previewMessage}</Text>}
    </ScrollView>
  } />;
}
const styles = StyleSheet.create({
  selector: { gap: 18, padding: 4, paddingBottom: 20 },
  intro: { gap: 8, paddingHorizontal: 4 },
  title: { ...TYPOGRAPHY.pageTitle, color: COLORS.text,},
  description: { ...TYPOGRAPHY.body, color: COLORS.textLight,},
  start: { width: "100%", minHeight: 52 },
});
