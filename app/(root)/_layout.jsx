import { useUser } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { Stack } from "expo-router/stack";
import { COLORS } from "@/constants/colors";
import { EntriesRefreshProvider } from "@/context/EntriesRefreshContext";

export default function Layout() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null; // this is for better ux.
  if (!isSignedIn) {
    return <Redirect href={"/sign-in"} />;
  }

  return (
    <EntriesRefreshProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
        {/* These custom headers live below SafeScreen's inset. A rectangular
            native-stack push avoids UIKit's temporary rounded push mask there. */}
        {["update-goals", "create", "photo-log", "chatgpt", "goals-survey", "edit/[id]", "session-log-edit/[id]", "calmera-guide", "calmera-welcome", "update-scale-type", "camera", "camera-loading"].map((name) => (
          <Stack.Screen key={name} name={name} options={{
            presentation: "card", animation: "simple_push", gestureEnabled: true,
          }} />
        ))}
      </Stack>
    </EntriesRefreshProvider>
  );
}
