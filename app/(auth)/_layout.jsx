import { Stack } from "expo-router";
import { COLORS } from "@/constants/colors";

export default function AuthRoutesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "simple_push", contentStyle: { backgroundColor: COLORS.background } }}>
      <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="forgot-password"
        options={{ gestureEnabled: false }}
      />
    </Stack>
  );
}
