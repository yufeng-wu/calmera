import { useContext } from "react";
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeScreenTopContext } from "@/components/SafeScreen";
import { formOwnsTopInset } from "@/lib/headerLayout.mjs";
import Constants from "expo-constants";
import { FormHeader, GlassButton } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import SignIn from "@/app/(auth)/sign-in";
import SignUp from "@/app/(auth)/sign-up";
import ForgotPassword from "@/app/(auth)/forgot-password";
import Settings from "@/app/(root)/(tabs)/settings";
import History from "@/app/(root)/(tabs)/history";
import ChatGPT from "@/app/(root)/chatgpt";
import VoiceLanguage from "@/app/(root)/voice-language";
import ThemeSettings from "@/app/(root)/theme";
import Survey from "@/app/(root)/goals-survey";
import EditMeal from "@/app/(root)/edit/[id]";
import EditSession from "@/app/(root)/session-log-edit/[id]";
import Guide from "@/app/(root)/calmera-guide";
import Welcome from "@/app/(root)/calmera-welcome";
import Scale from "@/app/(root)/update-scale-type";
import Manual from "@/app/(root)/create";
import Photo from "@/app/(root)/photo-log";
import LiveFallback from "@/components/LiveComingSoon";

const screens = [
  { id: "sign-in", title: "Sign In", Component: SignIn },
  { id: "sign-up", title: "Create account", Component: SignUp },
  { id: "verification", title: "Email verification", Component: SignUp, stage: "verification" },
  { id: "signup-setup", title: "Verified account setup", Component: SignUp, stage: "setup" },
  { id: "forgot-password", title: "Reset password", Component: ForgotPassword },
  { id: "reset-code", title: "Reset verification", Component: ForgotPassword, stage: "verification" },
  { id: "reset", title: "New password", Component: ForgotPassword, stage: "reset" },
  { id: "settings", title: "Settings", Component: Settings },
  { id: "chatgpt", title: "ChatGPT connected", Component: ChatGPT },
  { id: "chatgpt-disconnected", title: "Connect ChatGPT", Component: ChatGPT, state: "disconnected" },
  { id: "voice-language", title: "Voice language", Component: VoiceLanguage },
  { id: "theme", title: "Theme", Component: ThemeSettings },
  { id: "survey", title: "Goals survey", Component: Survey },
  { id: "recommendation", title: "Survey recommendation", Component: Survey, stage: "recommendation" },
  { id: "edit-meal", title: "Edit meal", Component: EditMeal },
  { id: "edit-session", title: "Edit scale item", Component: EditSession },
  { id: "history", title: "History", Component: History },
  { id: "guide", title: "Tutorial", Component: Guide },
  { id: "welcome", title: "Welcome and scale setup", Component: Welcome },
  { id: "scale", title: "Scale display", Component: Scale },
  { id: "live", title: "Legacy Live fallback", Component: LiveFallback },
  { id: "manual", title: "Manual", Component: Manual },
  { id: "photo", title: "Photo empty", Component: Photo },
  { id: "photo-selected", title: "Photo selected", Component: Photo, state: "selected" },
];

// Actual production components with local-only behavior. No account switching,
// profile/history reads, credentials, camera, microphone, or database writes.
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
      <Text style={styles.note}>Actual Calmera pages with synthetic data and local-only actions. Your account stays signed in; these examples cannot submit authentication, inference, or record changes.</Text>
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
