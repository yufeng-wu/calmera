import { TYPOGRAPHY } from "@/constants/typography";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useClerk } from "@clerk/clerk-expo";
import { FormCard, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

export default function SettingsScreen({ calmeraPreview = false }) {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const { signOut } = useClerk();
  const [previewMessage, setPreviewMessage] = useState("");
  const openPage = (path, label) => {
    if (calmeraPreview) { setPreviewMessage(`${label} selected. Preview only.`); return; }
    router.push(path);
  };
  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => {
        if (calmeraPreview) { setPreviewMessage("Sign out confirmed. Preview only."); return; }
        await signOut();
      } },
    ]);
  };
  return <View style={formStyles.screen}>
    <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Settings</Text></View>
    <ScrollView key={`text-size-${fontScale}`} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.section}>CALMERA</Text>
      <FormCard variant="grouped" style={styles.group}>
        <SettingsRow title="ChatGPT connection" subtitle="Your account, model and voice language"
          icon="sparkles-outline" onPress={() => openPage("/chatgpt", "ChatGPT connection")} />
        <SettingsRow title="Nutrition goals" subtitle="Adjust your daily targets" icon="options-outline" divider
          onPress={() => openPage("/update-goals", "Nutrition goals")} />
      </FormCard>
      <Text style={styles.section}>ACCOUNT</Text>
      <FormCard variant="grouped" style={styles.group}>
        <SettingsRow title="Sign out" icon="log-out-outline" destructive onPress={handleLogout} />
      </FormCard>
      {!!previewMessage && <Text accessibilityLiveRegion="polite" style={formStyles.caption}>{previewMessage}</Text>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  header: { minHeight: 64, paddingHorizontal: 20, justifyContent: "center", alignItems: "center" },
  title: { ...TYPOGRAPHY.pageTitle, color: COLORS.text},
  content: { padding: 20, paddingTop: 14, paddingBottom: 150, gap: 12 },
  section: { ...TYPOGRAPHY.eyebrow, color: COLORS.textLight, marginTop: 6, marginLeft: 4},
  group: { padding: 0, gap: 0, overflow: "hidden" },
});
