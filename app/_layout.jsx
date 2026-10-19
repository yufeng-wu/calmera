import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Slot } from "expo-router";
import SafeScreen from "@/components/SafeScreen";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || Constants.expoConfig.extra.clerkPublishableKey;

  if (!publishableKey) {
    throw new Error("Missing Clerk Publishable Key");
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
        <SafeScreen>
          <Slot />
        </SafeScreen>
        {/* Force dark status-bar content (black text/icons) regardless of system theme */}
        <StatusBar style="dark" />
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
