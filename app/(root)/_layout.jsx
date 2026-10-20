import { useContext } from "react";
import { Platform } from "react-native";
import { SafeScreenTopContext } from "@/components/SafeScreen";
import { formOwnsTopInset } from "@/lib/headerLayout.mjs";
import { useUser } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { Stack } from "expo-router/stack";
import { COLORS } from "@/constants/colors";
import { EntriesRefreshProvider } from "@/context/EntriesRefreshContext";
import { renderNavigationScene } from "@/components/NavigationScene";

export default function Layout() {
  const { isSignedIn, isLoaded } = useUser();
  const topInset = useContext(SafeScreenTopContext);

  if (!isLoaded) return null; // this is for better ux.
  if (!isSignedIn) {
    return <Redirect href={"/sign-in"} />;
  }

  return (
    <EntriesRefreshProvider>
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
    </EntriesRefreshProvider>
  );
}
