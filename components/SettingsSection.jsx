import { StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { SETTINGS, SETTINGS_MOTION, TINTS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { useMotionPreference } from "@/hooks/useMotionPreference";

// The touch highlight every Settings row and card shares. As in iOS lists, it shows a
// moment after touch-down (so a scroll doesn't flash it) and fades out once released.
// Spread pressProps on the Pressable and render highlight as its first child.
export function usePressHighlight(style) {
  const { reduceMotion } = useMotionPreference();
  const shown = useSharedValue(0);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  return {
    pressProps: {
      unstable_pressDelay: 60,
      onPressIn: () => { cancelAnimation(shown); shown.value = 1; },
      onPressOut: () => { shown.value = reduceMotion ? 0 : withTiming(0, { duration: SETTINGS_MOTION.release }); },
    },
    highlight: <Animated.View pointerEvents="none" style={[styles.highlight, style, fade]} />,
  };
}

// One group on a Settings page: a label above, a white card, and an optional note below.
export function SettingsSection({ label, footnote, children, style, cardStyle }) {
  return <View style={[styles.section, style]}>
    {!!label && <Text accessibilityRole="header" style={styles.label}>{label}</Text>}
    <View style={[styles.card, cardStyle]}>{children}</View>
    {typeof footnote === "string" ? <Text style={settingsStyles.footnote}>{footnote}</Text> : footnote}
  </View>;
}

// A pastel tile behind a row's icon. Pass children for artwork that keeps its own colors.
export function SettingsTile({ icon, tint = "tangerine", size = SETTINGS.tile, children }) {
  const colors = TINTS[tint] || TINTS.tangerine;
  return <View accessible={false} style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: colors.fill }]}>
    {children || <Ionicons name={icon} size={Math.round(size * 0.6)} color={colors.icon} />}
  </View>;
}

const CARD = { borderRadius: SETTINGS.cardRadius, backgroundColor: SETTINGS.surface, borderWidth: 0.5, borderColor: SETTINGS.edge, overflow: "hidden" };

export const settingsStyles = StyleSheet.create({
  content: { paddingHorizontal: SETTINGS.gutter, paddingTop: 12, paddingBottom: 44, gap: SETTINGS.sectionGap },
  lead: { ...TYPOGRAPHY.body, color: SETTINGS.inkSoft, marginHorizontal: 4, marginBottom: -8 },
  footnote: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, marginHorizontal: 4 },
  problem: { ...TYPOGRAPHY.caption, color: SETTINGS.danger, marginHorizontal: 4 },
  card: CARD,
});

const styles = StyleSheet.create({
  section: { gap: 8 },
  label: { ...TYPOGRAPHY.eyebrow, color: SETTINGS.inkSoft, textTransform: "uppercase", marginHorizontal: 4 },
  card: CARD,
  tile: { alignItems: "center", justifyContent: "center" },
  highlight: { ...StyleSheet.absoluteFillObject, backgroundColor: SETTINGS.pressed },
});
