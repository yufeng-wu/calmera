import { Stack } from "expo-router";

export default function AuthRoutesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="forgot-password"
        options={{ gestureEnabled: false }}
      />
    </Stack>
  );
}
