import { useContext } from "react";
import { Platform } from "react-native";
import { SafeScreenTopContext } from "@/components/SafeScreen";
import { formOwnsTopInset } from "@/lib/headerLayout.mjs";
import { useUser } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import { Redirect, usePathname } from "expo-router";
import { Stack } from "expo-router/stack";
import AccountProfileGate, { AccountLoadingScreen } from "@/components/AccountProfileGate";
import FoodwrapStartupGate from "@/components/FoodwrapStartupGate";
import { COLORS } from "@/constants/colors";
import { EntriesRefreshProvider } from "@/context/EntriesRefreshContext";
import { renderNavigationScene } from "@/components/NavigationScene";

export default function Layout() {
  const { isSignedIn, isLoaded, user } = useUser();
  const pathname = usePathname();
  const review = Constants.expoConfig?.extra?.calmeraFullAppTest === true
    && ["/ui-gallery", "/background-compare", "/glass-compare", "/motion-check", "/theme-check", "/palette-compare"].includes(pathname);
  const topInset = useContext(SafeScreenTopContext);

  if (!isLoaded) return <AccountLoadingScreen topInset={topInset} />;
  if (!isSignedIn) {
    return <Redirect href={"/sign-in"} />;
  }

  return (
    <AccountProfileGate key={user.id} topInset={topInset} disabled={review}>
    <EntriesRefreshProvider>
    <FoodwrapStartupGate topInset={topInset} disabled={review}>
      <Stack screenLayout={renderNavigationScene} screenOptions={{ headerShown: false, animation: "simple_push", contentStyle: { backgroundColor: COLORS.background, paddingTop: topInset } }}>
        {/* Forms own their inset so native material can span the status area.
            Other screens keep their inset locally without resizing this stack. */}
        {["update-goals", "create", "photo-log", "chatgpt", "voice-language", "meal-times", "theme", "goals-survey", "edit/[id]", "session-log-edit/[id]", "calmera-guide", "calmera-welcome", "update-scale-type", "camera", "camera-loading"].map((name) => (
          <Stack.Screen key={name} name={name} options={{
            presentation: "card", gestureEnabled: true,
            contentStyle: { backgroundColor: COLORS.background, paddingTop:
              formOwnsTopInset(`/${name}`, undefined, Platform.OS, Platform.Version)
                || ["camera", "camera-loading"].includes(name) ? 0 : topInset },
          }} />
        ))}
        <Stack.Screen name="ui-gallery" options={{ contentStyle: { backgroundColor: COLORS.background, paddingTop: 0 } }} />
      </Stack>
    </FoodwrapStartupGate>
    </EntriesRefreshProvider>
    </AccountProfileGate>
  );
}
