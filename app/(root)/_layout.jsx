import { useContext, useState } from "react";
import { Platform } from "react-native";
import { SafeScreenTopContext } from "@/components/SafeScreen";
import { formOwnsTopInset } from "@/lib/headerLayout.mjs";
import Constants from "expo-constants";
import { usePathname } from "expo-router";
import { Stack } from "expo-router/stack";
import FoodwrapStartupGate from "@/components/FoodwrapStartupGate";
import PrivacyConsentGate from "@/components/PrivacyConsentGate";
import { COLORS } from "@/constants/colors";
import { useAppReset } from "@/context/AppResetContext";
import { FoodIconsProvider } from "@/context/FoodIconsContext";
import { EntriesRefreshProvider } from "@/context/EntriesRefreshContext";
import { renderNavigationScene } from "@/components/NavigationScene";
import { LOCAL_OWNER } from "@/lib/owner.mjs";

export default function Layout() {
  const pathname = usePathname();
  const review = Constants.expoConfig?.extra?.calmeraFullAppTest === true
    && ["/ui-gallery", "/background-compare", "/glass-compare", "/motion-check", "/theme-check", "/palette-compare"].includes(pathname);
  const topInset = useContext(SafeScreenTopContext);
  // Erase all data starts everything below over, from the privacy agreement on.
  const { epoch } = useAppReset();
  // The launch redirect lands on Today without sliding in; later moves back to the tabs still animate.
  const [launched, setLaunched] = useState(false);

  // Consent comes first: no meals or AI until the person has agreed.
  return (
    <PrivacyConsentGate key={epoch} disabled={review}>
    <FoodIconsProvider owner={LOCAL_OWNER}>
    <EntriesRefreshProvider>
    <FoodwrapStartupGate disabled={review}>
      {/* After Start Over this stack mounts with no saved place, so it opens on the tabs
          (Today) instead of the first screen listed below. Launch links still set their own. */}
      <Stack initialRouteName="(tabs)" screenLayout={renderNavigationScene} screenOptions={{ headerShown: false, animation: "simple_push", contentStyle: { backgroundColor: COLORS.background, paddingTop: topInset } }}>
        {/* Forms own their inset so native material can span the status area.
            Other screens keep their inset locally without resizing this stack. */}
        {["update-goals", "create", "photo-log", "chatgpt", "ai-connection", "voice-language", "theme", "export-data", "erase-data", "privacy", "insights/[card]", "goals-survey", "edit/[id]", "calmera-guide"].map((name) => (
          <Stack.Screen key={name} name={name} options={{
            presentation: "card", gestureEnabled: true,
            contentStyle: { backgroundColor: COLORS.background, paddingTop:
              formOwnsTopInset(`/${name}`, undefined, Platform.OS, Platform.Version) ? 0 : topInset },
          }} />
        ))}
        <Stack.Screen name="(tabs)" options={{ animation: launched ? "simple_push" : "none" }} listeners={{ transitionEnd: () => setLaunched(true) }} />
        <Stack.Screen name="ui-gallery" options={{ contentStyle: { backgroundColor: COLORS.background, paddingTop: 0 } }} />
      </Stack>
    </FoodwrapStartupGate>
    </EntriesRefreshProvider>
    </FoodIconsProvider>
    </PrivacyConsentGate>
  );
}
