import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Slot, usePathname } from "expo-router";
import SafeScreen from "@/components/SafeScreen";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import ThemeCanvas from "@/components/ThemeCanvas";
import { BASE_CANVAS_COLOR } from "@/constants/appearance.mjs";
import { GestureHandlerRootView } from "react-native-gesture-handler";

function ThemedApp() {
  const { themeId, energized } = useTheme();
  return <>
    <ThemeCanvas variant={themeId} energized={energized} />
    <SafeScreen transparent><Slot /></SafeScreen>
    <StatusBar style="dark" />
  </>;
}

export default function RootLayout() {
  const pathname = usePathname();
  const review = Constants.expoConfig?.extra?.calmeraFullAppTest === true
    && ["/ui-gallery", "/background-compare", "/theme-check"].includes(pathname);
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || Constants.expoConfig.extra.clerkPublishableKey;

  if (!publishableKey) {
    throw new Error("Missing Clerk Publishable Key");
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: BASE_CANVAS_COLOR }}>
      <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
        <ThemeProvider review={review}><ThemedApp /></ThemeProvider>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
