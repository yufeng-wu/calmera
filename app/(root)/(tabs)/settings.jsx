import { useCallback, useContext, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, LayoutAnimationConfig } from "react-native-reanimated";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import FoodwrapWordmark from "@/components/FoodwrapWordmark";
import OpenAILogo from "@/components/OpenAILogo";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles, usePressHighlight } from "@/components/SettingsSection";
import { NUTRIENT_COLORS } from "@/constants/colors";
import { SETTINGS, SETTINGS_MOTION } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { useTheme } from "@/context/ThemeContext";
import useProfile from "@/hooks/useProfile";
import useWarmSettingsRoutes from "@/hooks/useWarmSettingsRoutes";
import { getVoiceLanguage } from "@/lib/chatgpt/nutrition";
import { createPlanClient, isChatGPTAvailable } from "@/lib/chatgpt/planClient";
import { formatNumber } from "@/lib/insights/stats.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { VOICE_LANGUAGES } from "@/lib/voiceLanguagePreferences.mjs";

const GOALS = [
  { key: "calorieGoal", label: "Calories", unit: "", spoken: "kilocalories", color: NUTRIENT_COLORS.calories },
  { key: "proteinGoal", label: "Protein", unit: "g", spoken: "grams", color: NUTRIENT_COLORS.protein },
  { key: "carbsGoal", label: "Carbs", unit: "g", spoken: "grams", color: NUTRIENT_COLORS.carbs },
  { key: "fatGoal", label: "Fat", unit: "g", spoken: "grams", color: NUTRIENT_COLORS.fat },
];
const PREVIEW = { chatgpt: "Connected", language: "English",
  goals: { calorieGoal: 1800, proteinGoal: 140, carbsGoal: 180, fatGoal: 60 } };
const goalNumber = (value) => {
  const number = value === null || value === undefined || value === "" ? NaN : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

// Your goals, how you log, the app itself, and erasing everything, in that order.
export default function SettingsScreen({ calmeraPreview = false }) {
  const router = useRouter();
  useWarmSettingsRoutes();
  const { theme } = useTheme();
  const { fontScale } = useWindowDimensions();
  // The gallery preview shows this page outside the tabs, under its own bar of about the same height.
  const tabBarHeight = useContext(BottomTabBarHeightContext) || 96;
  const profile = useProfile();
  const status = useLoggingStatus(calmeraPreview ? null : LOCAL_OWNER, calmeraPreview);
  const goals = calmeraPreview ? PREVIEW.goals : profile.goals;
  const [previewMessage, setPreviewMessage] = useState("");
  const openPage = (path, label) => {
    if (calmeraPreview) {
      if (["/voice-language", "/meal-times", "/theme", "/erase-data", "/privacy"].includes(path)) router.push({ pathname: "/ui-gallery", params: { page: path.slice(1) } });
      else setPreviewMessage(`${label} selected. Preview only.`);
      return;
    }
    router.push(path);
  };
  return <View style={styles.screen}>
    <View key={`settings-header-${fontScale}`} style={[styles.header, { minHeight: Math.max(64, 40 * fontScale + 20) }]}>
      <Text accessibilityRole="header" style={styles.title}>Settings</Text>
    </View>
    {/* Rows soften as they scroll under the title, as on Insights. */}
    <MaskedView style={styles.scroll} maskElement={<LinearGradient colors={["transparent", "black"]} locations={[0, 0.02]} style={styles.scroll} />}>
    <ScrollView key={`text-size-${fontScale}`} contentContainerStyle={[settingsStyles.content, { paddingTop: 6, paddingBottom: tabBarHeight + 32 }]}
      scrollIndicatorInsets={{ bottom: tabBarHeight }} showsVerticalScrollIndicator={false}>
      {/* What is already loaded on the first visit just shows; only what arrives later fades in. */}
      <LayoutAnimationConfig skipEntering>
      <SettingsSection label="Daily goals">
        <GoalsCard goals={goals} failed={!calmeraPreview && profile.failed} large={fontScale > 1.3}
          onPress={() => openPage("/update-goals", "Daily goals")} />
      </SettingsSection>
      </LayoutAnimationConfig>

      <SettingsSection label="Logging">
        <SettingsRow title="ChatGPT" value={status.chatgpt} iconElement={<OpenAILogo />} tint="cocoa"
          onPress={() => openPage("/chatgpt", "ChatGPT")} />
        <SettingsRow title="Voice language" value={status.language} icon="mic" tint="sky" divider
          onPress={() => openPage("/voice-language", "Voice language")} />
        <SettingsRow title="Meal times" icon="time" tint="rose" divider
          onPress={() => openPage("/meal-times", "Meal times")} />
      </SettingsSection>

      <SettingsSection label="App">
        <SettingsRow title="Theme" value={theme.name} icon="color-palette" tint="plum"
          onPress={() => openPage("/theme", "Theme")} />
        <SettingsRow title="Export your data" icon="share" tint="tangerine" divider
          onPress={() => openPage("/export-data", "Export your data")} />
        <SettingsRow title="Privacy Policy" icon="shield-checkmark" tint="leaf" divider
          onPress={() => openPage("/privacy", "Privacy Policy")} />
      </SettingsSection>

      <SettingsSection footnote="Removes your meals, goals and settings from this iPhone.">
        <SettingsRow title="Erase all data" destructive centered showAccessory={false}
          onPress={() => openPage("/erase-data", "Erase all data")} />
      </SettingsSection>

      {!!previewMessage && <Text accessibilityLiveRegion="polite" style={settingsStyles.footnote}>{previewMessage}</Text>}
      <View accessible accessibilityLabel={`calmera. Version ${Constants.expoConfig?.version ?? ""}`} style={styles.footer}>
        <FoodwrapWordmark maxWidth={68} style={styles.wordmark} />
        <Text style={settingsStyles.footnote}>Version {Constants.expoConfig?.version}</Text>
      </View>
    </ScrollView>
    </MaskedView>
  </View>;
}

// Read on every visit, since both can change on their own pages or outside the app.
function useLoggingStatus(userId, preview) {
  const [status, setStatus] = useState(preview ? { chatgpt: PREVIEW.chatgpt, language: PREVIEW.language } : { chatgpt: null, language: null });
  useFocusEffect(useCallback(() => {
    if (preview || !userId) return;
    let active = true;
    const controller = new AbortController();
    const client = isChatGPTAvailable() ? createPlanClient(userId) : null;
    Promise.all([
      client ? client.connected().catch(() => null) : false,
      getVoiceLanguage(userId, { signal: controller.signal, isActive: () => active }).catch(() => null),
    ]).then(([connected, language]) => {
      if (!active) return;
      setStatus({ chatgpt: connected === null ? null : connected ? "Connected" : "Not connected",
        language: VOICE_LANGUAGES.find(({ value }) => value === language)?.label ?? null });
    });
    return () => { active = false; controller.abort(); };
  }, [userId, preview]));
  return status;
}

// The four targets in Today's ring colors. Values that load late fade in where "–" stood.
function GoalsCard({ goals, failed, large, onPress }) {
  const values = GOALS.map((goal) => ({ ...goal, value: goalNumber(goals?.[goal.key]) }));
  const unset = values.every(({ value }) => value === null);
  const spoken = unset ? "Not set" : values.map(({ label, value, spoken: unit }) => `${label} ${value === null ? "not set" : `${formatNumber(value)} ${unit}`}`).join(", ");
  const { pressProps, highlight } = usePressHighlight();
  return <Pressable accessibilityRole="button" accessibilityLabel="Daily goals" accessibilityValue={{ text: spoken }}
    accessibilityHint="Opens the goals editor" onPress={onPress} {...pressProps} style={styles.goals}>
    {highlight}
    <View style={styles.goalGrid}>
      {values.map(({ key, label, unit, color, value }) => <View key={key} style={[styles.goal, large && styles.goalLarge]}>
        <View style={styles.goalLabelRow}>
          <View style={[styles.goalDot, { backgroundColor: color }]} />
          <Text numberOfLines={1} style={styles.goalLabel}>{label}</Text>
        </View>
        <Animated.Text key={`${key}-${value}`} entering={value === null ? undefined : FadeIn.duration(SETTINGS_MOTION.fade)} numberOfLines={1} style={styles.goalValue}>
          {value === null ? "–" : formatNumber(value)}{value !== null && !!unit && <Text style={styles.goalUnit}>{` ${unit}`}</Text>}
        </Animated.Text>
      </View>)}
    </View>
    <Ionicons name="chevron-forward" size={16} color={SETTINGS.chevron} />
    {(unset || failed) && <Text style={styles.goalNote}>{failed ? "Couldn’t load your goals. Tap to try again." : "Set your daily goals."}</Text>}
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  scroll: { flex: 1 },
  header: { minHeight: 64, paddingHorizontal: 20, justifyContent: "center", alignItems: "center" },
  title: { ...TYPOGRAPHY.pageTitle, color: SETTINGS.ink },
  goals: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingVertical: 16, paddingLeft: SETTINGS.rowPadding, paddingRight: 14 },
  goalGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  goal: { width: "25%", gap: 3, paddingRight: 6 },
  goalLarge: { width: "50%" },
  goalLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  goalDot: { width: 7, height: 7, borderRadius: 3.5 },
  goalLabel: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, flexShrink: 1 },
  goalValue: { ...TYPOGRAPHY.value, color: SETTINGS.ink },
  goalUnit: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft },
  goalNote: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, width: "100%" },
  footer: { alignItems: "center", gap: 4, paddingTop: 4 },
  wordmark: { height: 22 },
});
