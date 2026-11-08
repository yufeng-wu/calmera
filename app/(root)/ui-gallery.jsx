import { useContext } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeScreenTopContext } from "@/components/SafeScreen";
import { formOwnsTopInset } from "@/lib/headerLayout.mjs";
import Constants from "expo-constants";
import { FormHeader, GlassButton } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import Settings from "@/app/(root)/(tabs)/settings";
import TodayCalendarPreview from "@/components/TodayCalendarPreview";
import ChatGPT from "@/app/(root)/chatgpt";
import VoiceLanguage from "@/app/(root)/voice-language";
import MealTimes from "@/app/(root)/meal-times";
import ThemeSettings from "@/app/(root)/theme";
import Survey from "@/app/(root)/goals-survey";
import EraseData from "@/app/(root)/erase-data";
import Privacy from "@/app/(root)/privacy";
import PrivacyConsentGate from "@/components/PrivacyConsentGate";
import EditMeal from "@/app/(root)/edit/[id]";
import Guide from "@/app/(root)/calmera-guide";
import TextLog from "@/app/(root)/create";
import Photo from "@/app/(root)/photo-log";
import FoodwrapWordmark from "@/components/FoodwrapWordmark";
import AppLoadingScreen from "@/components/AppLoadingScreen";
import FoodwrapRefreshScrollView from "@/components/FoodwrapRefreshScrollView";
import FoodwrapLoading from "@/components/FoodwrapLoading";

function TodayRefreshPreview() {
  const focused = useIsFocused();
  const refresh = () => new Promise(resolve => setTimeout(resolve, 1400));
  return <FoodwrapRefreshScrollView active={focused} onRefresh={refresh}
    contentContainerStyle={{ flexGrow: 1, paddingTop: 12, paddingHorizontal: 20 }}>
    <FoodwrapWordmark style={{ marginBottom: 16 }} />
    <Text style={[styles.note, { textAlign: "center" }]}>Pull down, then release to refresh</Text>
    <View style={{ marginTop: 24, padding: 24, borderRadius: 24, backgroundColor: "#FFFFFF80" }}>
      <Text style={{ color: COLORS.text, fontSize: 22, marginBottom: 12 }}>Today</Text>
      <Text style={styles.note}>Your meals stay visible while the native control refreshes them.</Text>
    </View>
  </FoodwrapRefreshScrollView>;
}

function TodayLoadingPreview({ calmeraPreviewState }) {
  const focused = useIsFocused();
  return <View style={{ flex: 1, paddingTop: 12 }}>
    <FoodwrapWordmark style={{ marginBottom: 16 }} />
    <Text style={[styles.note, { textAlign: "center", paddingHorizontal: 20 }]}>
      {calmeraPreviewState === "reduced" ? "Reduced Motion preview" : "Today loading preview"}
    </Text>
    <View style={{ flex: 1, justifyContent: "center" }}>
      <FoodwrapLoading active={focused} staticOnly={calmeraPreviewState === "reduced"} />
    </View>
  </View>;
}

const screens = [
  { id: "app-loading", title: "App loading", Component: AppLoadingScreen },
  { id: "today-refresh", title: "Today pull to refresh", Component: TodayRefreshPreview },
  { id: "today-loading", title: "Today logo loading", Component: TodayLoadingPreview },
  { id: "today-loading-reduced", title: "Today loading reduced motion", Component: TodayLoadingPreview, state: "reduced" },

  { id: "settings", title: "Settings", Component: Settings },
  { id: "chatgpt", title: "ChatGPT connected", Component: ChatGPT },
  { id: "chatgpt-disconnected", title: "Connect ChatGPT", Component: ChatGPT, state: "disconnected" },
  { id: "chatgpt-catalog-error", title: "ChatGPT model recovery", Component: ChatGPT, state: "catalog-error" },
  { id: "voice-language", title: "Voice language", Component: VoiceLanguage },
  { id: "voice-language-load-error", title: "Voice language load recovery", Component: VoiceLanguage, state: "load-error" },
  { id: "voice-language-save-error", title: "Voice language save recovery", Component: VoiceLanguage, state: "save-error" },
  { id: "meal-times", title: "Meal times", Component: MealTimes },
  { id: "meal-times-load-error", title: "Meal times load recovery", Component: MealTimes, state: "load-error" },
  { id: "meal-times-save-error", title: "Meal times save recovery", Component: MealTimes, state: "save-error" },
  { id: "theme", title: "Theme", Component: ThemeSettings },
  { id: "survey", title: "Goals survey", Component: Survey },
  { id: "recommendation", title: "Survey recommendation", Component: Survey, stage: "recommendation" },
  { id: "recommendation-unspecified", title: "Survey unspecified sex", Component: Survey, stage: "recommendation-unspecified" },
  { id: "recommendation-minor", title: "Survey under 18", Component: Survey, stage: "recommendation-minor" },
  { id: "recommendation-save-error", title: "Survey save rejection", Component: Survey, stage: "save-error" },
  { id: "erase-data", title: "Erase all data", Component: EraseData },
  { id: "erase-data-erasing", title: "Erasing all data", Component: EraseData, stage: "erase-data-erasing" },
  { id: "erase-data-failed", title: "Erase all data retry", Component: EraseData, stage: "erase-data-failed" },
  { id: "erase-data-done", title: "All data erased", Component: EraseData, stage: "erase-data-done" },
  { id: "privacy-consent", title: "Privacy and AI consent", Component: PrivacyConsentGate },
  { id: "privacy-consent-updated", title: "Updated policy consent", Component: PrivacyConsentGate, state: "updated" },
  { id: "privacy-consent-error", title: "Consent not saved", Component: PrivacyConsentGate, state: "error" },
  { id: "privacy", title: "Privacy Policy", Component: Privacy, stage: "privacy" },
  { id: "privacy-health-data", title: "Health Data Policy", Component: Privacy, stage: "health-data" },
  { id: "edit-meal", title: "Edit meal", Component: EditMeal },
  { id: "edit-save-navigation-error", title: "Meal saved navigation recovery", Component: EditMeal, state: "saved-navigation-error" },
  { id: "today-calendar", title: "Today calendar", Component: TodayCalendarPreview },
  { id: "today-calendar-loading", title: "Today calendar loading", Component: TodayCalendarPreview, state: "cold-loading" },
  { id: "today-calendar-error", title: "Today calendar retry", Component: TodayCalendarPreview, state: "history-error" },
  { id: "guide", title: "Tutorial", Component: Guide },
  { id: "manual", title: "Text Log", Component: TextLog },
  { id: "manual-save-navigation-error", title: "Text saved navigation recovery", Component: TextLog, state: "saved-navigation-error" },
  { id: "text-review", title: "Text meal review", Component: TextLog, state: "review" },
  { id: "photo-review", title: "Photo meal review", Component: Photo, state: "review" },
  { id: "photo", title: "Photo empty", Component: Photo },
  { id: "photo-selected", title: "Photo selected", Component: Photo, state: "selected" },
  { id: "photo-save-navigation-error", title: "Photo saved navigation recovery", Component: Photo, state: "saved-navigation-error" },
];

// Actual production components with local-only behavior. No profile or history reads,
// credentials, camera, microphone, or saved data changes.
export default function UIGallery() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const { page } = useLocalSearchParams();
  const safeTop = useContext(SafeScreenTopContext);
  const localInset = formOwnsTopInset("/ui-gallery", page, Platform.OS, Platform.Version) ? 0 : safeTop;
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/dashboard" />;
  const id = Array.isArray(page) ? page[0] : page;
  const index = screens.findIndex(item => item.id === id);
  const entry = screens[index];
  const select = target => router.replace({ pathname: "/ui-gallery", params: target ? { page: target } : {} });
  if (!entry) return <View style={[styles.screen, { paddingTop: localInset }]}>
    <FormHeader title="UI review" />
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.note}>Actual calmera pages with synthetic data and local-only actions. These examples can’t change your saved meals or goals or send anything for inference.</Text>
      {screens.map(item => <GlassButton key={item.id} title={item.title} onPress={() => select(item.id)} />)}
    </ScrollView>
  </View>;
  const Component = entry.Component;
  return <View style={[styles.screen, { paddingTop: localInset }]}>
    <View style={styles.page}><Component key={id} calmeraPreview
      calmeraPreviewStage={entry.stage} calmeraPreviewState={entry.state} /></View>
    <View style={styles.reviewBar}>
      <GlassButton title={fontScale > 1.3 ? "" : "Pages"} accessibilityLabel="All review pages" symbol="chevron.left" onPress={() => select(null)} style={[styles.reviewButton, fontScale > 1.3 && { width: 44, height: 44 }]} />
      <Text maxFontSizeMultiplier={1.2} style={styles.counter}>{index + 1} / {screens.length}{"\n"}Synthetic review</Text>
      <GlassButton title={fontScale > 1.3 ? "" : "Next"} symbol="chevron.right" accessibilityLabel="Review next page"
        onPress={() => select(screens[(index + 1) % screens.length].id)} style={[styles.reviewButton, fontScale > 1.3 && { width: 44, height: 44 }]} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  page: { flex: 1 },
  list: { padding: 20, paddingBottom: 40, gap: 12 },
  note: { color: COLORS.textLight, fontSize: 14, lineHeight: 21, marginBottom: 6 },
  reviewBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#E9DFD6" },
  reviewButton: { width: 105, minHeight: 44 },
  counter: { flex: 1, textAlign: "center", color: COLORS.textLight, fontSize: 11, lineHeight: 16 },
});
