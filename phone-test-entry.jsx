// Explicit standalone build entry. package.json keeps expo-router/entry for the
// regular Calmera app; this entry never imports its accounts or database routes.
import { registerRootComponent } from "expo";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SafeScreen from "./components/SafeScreen";
import ChatGPTPlanTest from "./components/ChatGPTPlanTest";

function CalmeraPhoneTest() {
  return <SafeAreaProvider>
    <SafeScreen><ChatGPTPlanTest standalone /></SafeScreen>
    <StatusBar style="dark" />
  </SafeAreaProvider>;
}

registerRootComponent(CalmeraPhoneTest);
