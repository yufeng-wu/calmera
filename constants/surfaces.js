import { DynamicColorIOS, Platform } from "react-native";

// The app keeps a white canvas. Static content surfaces have clear neutral
// edges; floating native controls continue to own their Liquid Glass material.
const outline = Platform.OS === "ios" ? DynamicColorIOS({
  light: "#E5E5EA", dark: "#E5E5EA",
  highContrastLight: "#8E8E93", highContrastDark: "#8E8E93",
}) : "#E5E5EA";
const separator = Platform.OS === "ios" ? DynamicColorIOS({
  light: "#E2E2E7", dark: "#E2E2E7",
  highContrastLight: "#8E8E93", highContrastDark: "#8E8E93",
}) : "#E2E2E7";

export const SURFACES = Object.freeze({
  content: "#FFFFFF",
  grouped: "#FFFFFF",
  pressed: "#F5F5F7",
  outline,
  separator,
  edge: { borderWidth: 0.5, borderColor: outline },
  elevated: {
    shadowColor: "#000000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
});
