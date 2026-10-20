import { useContext } from "react";
import { Platform } from "react-native";
import { formOwnsTopInset } from "@/lib/headerLayout.mjs";
import { SafeScreenTopContext } from "@/components/SafeScreen";
import { Stack } from "expo-router";
import { COLORS } from "@/constants/colors";

export default function AuthRoutesLayout() {
  const topInset = useContext(SafeScreenTopContext);
  const formContentStyle = pathname => ({ backgroundColor: COLORS.background,
    paddingTop: formOwnsTopInset(pathname, undefined, Platform.OS, Platform.Version) ? 0 : topInset });
  return (
    <Stack screenOptions={{ headerShown: false, animation: "simple_push", contentStyle: { backgroundColor: COLORS.background, paddingTop: topInset } }}>
      <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
      {/* Each adopted form owns its inset; pushing it never resizes Sign In. */}
      <Stack.Screen name="sign-up" options={{ contentStyle: formContentStyle("/sign-up") }} />
      <Stack.Screen
        name="forgot-password"
        options={{ gestureEnabled: false, contentStyle: formContentStyle("/forgot-password") }}
      />
    </Stack>
  );
}
