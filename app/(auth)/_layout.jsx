import { useContext } from "react";
import { SafeScreenTopContext } from "@/components/SafeScreen";
import { Stack } from "expo-router";
import { COLORS } from "@/constants/colors";

export default function AuthRoutesLayout() {
  const topInset = useContext(SafeScreenTopContext);
  return (
    <Stack screenOptions={{ headerShown: false, animation: "simple_push", contentStyle: { backgroundColor: COLORS.background, paddingTop: topInset } }}>
      <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="forgot-password"
        options={{ gestureEnabled: false }}
      />
    </Stack>
  );
}
