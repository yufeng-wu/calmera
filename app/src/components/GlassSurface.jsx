import { Platform, StyleSheet, View } from "react-native";
import { requireCalmeraNativeView } from "../../modules/calmera-chatgpt";

const NativeGlass = Platform.OS === "ios"
  ? requireCalmeraNativeView()
  : null;

// Keep content above the material so text and touch targets stay crisp.
// Without a cornerRadius the material is a capsule (rounded up to 32 pt); panels pass their own.
export default function GlassSurface({ style, cornerRadius }) {
  return NativeGlass
    ? <NativeGlass pointerEvents="none" cornerRadius={cornerRadius || 0} style={[StyleSheet.absoluteFill, style]} />
    : <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fallback, cornerRadius ? { borderRadius: cornerRadius } : null, style]} />;
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: "#FFFCF8", borderRadius: 32, borderWidth: 1, borderColor: "#E8DFD6" },
});
