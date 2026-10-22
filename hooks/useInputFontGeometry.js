import { Platform, StyleSheet, useWindowDimensions } from "react-native";

// RN 0.79 Fabric can retain stale native input/placeholder fonts after recycling.
// Explicit iOS geometry follows Dynamic Type once; Android keeps native scaling.
export default function useInputFontGeometry(style, { allowFontScaling, maxFontSizeMultiplier } = {}) {
  const { fontScale } = useWindowDimensions();
  const resolvedStyle = StyleSheet.flatten(style) || {};
  const scale = allowFontScaling === false ? 1
    : typeof maxFontSizeMultiplier === "number" && Number.isFinite(maxFontSizeMultiplier) && maxFontSizeMultiplier >= 1
      ? Math.min(fontScale, maxFontSizeMultiplier) : fontScale;
  return {
    style: Platform.OS === "ios" ? {
      ...resolvedStyle,
      ...(typeof resolvedStyle.fontSize === "number" ? { fontSize: resolvedStyle.fontSize * scale } : {}),
      ...(typeof resolvedStyle.lineHeight === "number" ? { lineHeight: resolvedStyle.lineHeight * scale } : {}),
    } : resolvedStyle,
    allowFontScaling: Platform.OS === "ios" ? false : allowFontScaling,
  };
}
