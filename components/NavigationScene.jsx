import { StyleSheet, View } from "react-native";
import ThemeCanvas from "@/components/ThemeCanvas";
import { useTheme } from "@/context/ThemeContext";
import { BASE_CANVAS_COLOR } from "@/constants/appearance.mjs";

// Native push/pop moves two complete scenes. A transparent incoming scene
// otherwise exposes the outgoing page until UIKit detaches it at completion.
function NavigationScene({ children, topInset }) {
  const { themeId } = useTheme();
  return <View style={styles.scene}>
    <ThemeCanvas variant={themeId} topInset={topInset} />
    {children}
  </View>;
}

// Keep this layout function stable so navigation never remounts a form draft.
export function renderNavigationScene({ children, options }) {
  const topInset = StyleSheet.flatten(options.contentStyle)?.paddingTop || 0;
  return <NavigationScene topInset={topInset}>{children}</NavigationScene>;
}
const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: BASE_CANVAS_COLOR },
});
