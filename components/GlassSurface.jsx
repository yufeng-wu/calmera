import { Platform, StyleSheet, View } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

const NativeGlass = Platform.OS === "ios"
  ? requireNativeViewManager("CalmeraChatGPT")
  : null;

// Keep content above the material so text and touch targets stay crisp.
export default function GlassSurface({ style }) {
  return NativeGlass
    ? <NativeGlass pointerEvents="none" style={[StyleSheet.absoluteFill, style]} />
    : <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fallback, style]} />;
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: "#FFFCF8", borderRadius: 32, borderWidth: 1, borderColor: "#E8DFD6" },
});
