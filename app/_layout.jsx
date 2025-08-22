import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Slot } from "expo-router";
import SafeScreen from "@/components/SafeScreen";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";

export default function RootLayout() {
  const publishableKey = Constants.expoConfig.extra.clerkPublishableKey;

  if (!publishableKey) {
    throw new Error("Missing Clerk Publishable Key");
  }

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <SafeScreen>
        <Slot />
      </SafeScreen>
      {/* Force dark status-bar content (black text/icons) regardless of system theme */}
      <StatusBar style="dark" />
    </ClerkProvider>
  );
}
