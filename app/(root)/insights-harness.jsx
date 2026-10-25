import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { FormCard, FormHeader, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { FOCUS } from "@/lib/insights/digest.mjs";
import { CORE_RULES, DEFAULT_PREFS, TONES } from "@/lib/insights/harness.mjs";
import { useInsightPrefs } from "@/lib/insights/prefs";

const NOTES_EXAMPLE = "e.g. I'm vegetarian, I train 4x a week in the evening, and I want answers in Chinese.";

export default function InsightsHarness() {
  const router = useRouter();
  const { userId } = useAuth();
  const { prefs, save } = useInsightPrefs(userId);
  const [notes, setNotes] = useState(prefs.notes);
  const [showCore, setShowCore] = useState(false);
  useEffect(() => { setNotes(prefs.notes); }, [prefs.notes]);
  const done = () => { save({ notes }); router.back(); };

  return <View style={formStyles.screen}>
    <FormHeader title="Your analyst" onBack={() => router.back()} onSave={done} />
    <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive">
      <Text style={styles.section}>WHAT YOU CARE ABOUT</Text>
      <FormCard variant="grouped" style={styles.group}>
        {Object.entries(FOCUS).map(([id, focus], index) => <SettingsRow key={id} title={`${focus.emoji}  ${focus.label}`}
          accessibilityRole="radio" selected={prefs.focus === id} divider={index > 0} onPress={() => save({ focus: id })} />)}
      </FormCard>

      <Text style={styles.section}>TONE</Text>
      <FormCard variant="grouped" style={styles.group}>
        {Object.entries(TONES).map(([id, description], index) => <SettingsRow key={id}
          title={id === "gentle" ? "Gentle" : "Direct"} subtitle={description}
          accessibilityRole="radio" selected={prefs.tone === id} divider={index > 0} onPress={() => save({ tone: id })} />)}
      </FormCard>

      <Text style={styles.section}>YOUR INSTRUCTIONS</Text>
      <FormCard style={styles.notesCard}>
        <TextInput value={notes} onChangeText={setNotes} placeholder={NOTES_EXAMPLE} placeholderTextColor={COLORS.textLight}
          multiline maxLength={2000} style={styles.notes} textAlignVertical="top" />
        <Text style={styles.caption}>{"Added to the analyst's instructions on every check-in and chat. Stays on this phone."}</Text>
      </FormCard>

      <Pressable onPress={() => setShowCore((value) => !value)} style={styles.coreToggle}>
        <Text style={styles.section}>BUILT-IN RULES {showCore ? "▾" : "▸"}</Text>
      </Pressable>
      {showCore && <FormCard style={styles.coreCard}>
        <Text style={styles.core}>{CORE_RULES}</Text>
        <Text style={styles.caption}>{"These always apply and can't be edited. Your instructions are added after them."}</Text>
      </FormCard>}

      <Pressable onPress={() => { save(DEFAULT_PREFS); setNotes(""); }} style={styles.reset}>
        <Text style={styles.resetText}>Reset to default</Text>
      </Pressable>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 8, paddingBottom: 60, gap: 12 },
  section: { ...TYPOGRAPHY.eyebrow, color: COLORS.textLight, marginTop: 6, marginLeft: 4 },
  group: { padding: 0, gap: 0, overflow: "hidden" },
  notesCard: { gap: 8, padding: 16 },
  notes: { ...TYPOGRAPHY.input, minHeight: 110, color: COLORS.text },
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  coreToggle: { paddingVertical: 4 },
  coreCard: { gap: 10, padding: 16, backgroundColor: "#F7F1EC" },
  core: { fontSize: 12, lineHeight: 18, color: COLORS.text, fontFamily: "Menlo" },
  reset: { alignSelf: "center", padding: 10 },
  resetText: { ...TYPOGRAPHY.button, color: COLORS.expense },
});
