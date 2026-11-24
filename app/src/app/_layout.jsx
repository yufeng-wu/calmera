import { Slot, usePathname, useSegments } from "expo-router";
import { Platform } from "react-native";
import SafeScreen from "@/components/SafeScreen";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { AppResetProvider } from "@/context/AppResetContext";
import ThemeCanvas from "@/components/ThemeCanvas";
import { BASE_CANVAS_COLOR } from "@/constants/appearance.mjs";
import { GestureHandlerRootView } from "react-native-gesture-handler";

function ThemedApp({ fullBleedHeader }) {
  const { themeId } = useTheme();
  return <>
    <ThemeCanvas variant={themeId} />
    <SafeScreen transparent formOwnsTopInset={fullBleedHeader}><Slot /></SafeScreen>
    <StatusBar style="dark" />
  </>;
}

export default function RootLayout() {
  const pathname = usePathname();
  const segments = useSegments();
  // Keep real navigator frames stable through push/pop. Each native screen
  // owns its own inset, so opening a form cannot move the previous tab page.
  const fullBleedHeader = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26
    && segments[0] === "(root)";
  const review = Constants.expoConfig?.extra?.calmeraFullAppTest === true && pathname === "/ui-gallery";

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: BASE_CANVAS_COLOR }}>
      <AppResetProvider>
        <ThemeProvider review={review}><ThemedApp fullBleedHeader={fullBleedHeader} /></ThemeProvider>
      </AppResetProvider>
    </GestureHandlerRootView>
  );
}
