import { TYPOGRAPHY } from "@/constants/typography";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FormHeader, FormCard } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import usePageExit from "@/hooks/usePageExit";

// Legacy deep links retain a quiet fallback. Live is not added to app navigation.
export default function LiveComingSoon({ calmeraPreview = false } = {}) {
  const { fontScale } = useWindowDimensions();
  const exit = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");
  return <View style={styles.screen}>
    <FormHeader title="Live AI" onBack={exit} />
    <ScrollView key={`fallback-text-${fontScale}`} contentContainerStyle={styles.content}><FormCard style={styles.card}>
      <View style={styles.icon}><Ionicons name="videocam-outline" size={32} color={COLORS.primary} /></View>
      <Text style={styles.title}>Coming soon</Text>
      <Text style={styles.note}>Use Photo, Manual, or Voice to record your meals.</Text>
    </FormCard></ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20 },
  card: { alignItems: "center", paddingVertical: 32, gap: 14 },
  icon: { height: 64, width: 64, borderRadius: 32, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center" },
  title: { ...TYPOGRAPHY.pageTitle, color: COLORS.text},
  note: { ...TYPOGRAPHY.body, color: COLORS.textLight, textAlign: "center"},
});
