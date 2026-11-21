import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, LayoutAnimationConfig, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { SettingsTile, usePressHighlight } from "@/components/SettingsSection";
import { SETTINGS, SETTINGS_MOTION, TINTS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { useMotionPreference } from "@/hooks/useMotionPreference";

// One row of a Settings list. A navigation row shows its current value and a chevron;
// a radio row shows a check that pops in when chosen. The divider starts at the title.
// With large text the value moves under the title, so neither has to break mid-word.
// tone colors the value when it reports a result ("good" or "bad"); accessory replaces the chevron,
// for a row that leaves the app.
export default function SettingsRow({ title, subtitle, value, icon, tint, iconElement, onPress, selected = false,
  destructive = false, disabled = false, divider = false, showAccessory = true, loading = false, centered = false,
  accessibilityRole = "button", accessibilityValue, accessibilityHint, tone, accessory }) {
  const interactive = typeof onPress === "function";
  const radio = accessibilityRole === "radio";
  const tiled = Boolean(icon || iconElement);
  const Row = interactive ? Pressable : View;
  const rowStyles = [styles.row, centered && styles.centered, disabled && !radio && styles.disabled];
  const spoken = accessibilityValue ?? (value ? { text: value } : undefined);
  const stacked = useWindowDimensions().fontScale > 1.3;
  const { pressProps, highlight } = usePressHighlight();
  // A value there from the start just shows; one that arrives or changes later fades in.
  const shownValue = <LayoutAnimationConfig skipEntering>
    {!!value && <Animated.Text key={value} entering={FadeIn.duration(SETTINGS_MOTION.fade)} numberOfLines={stacked ? undefined : 1}
      style={[styles.value, stacked && styles.valueStacked, tone === "good" && styles.good, tone === "bad" && styles.destructive]}>{value}</Animated.Text>}
  </LayoutAnimationConfig>;
  return <Row accessible accessibilityRole={interactive ? accessibilityRole : "text"}
    accessibilityLabel={[title, subtitle].filter(Boolean).join(". ")}
    accessibilityValue={spoken} accessibilityHint={accessibilityHint}
    accessibilityState={interactive ? { disabled, busy: loading, ...(radio ? { checked: selected } : {}) } : undefined}
    {...(interactive ? { disabled, onPress, ...pressProps } : {})}
    style={rowStyles}>
    {interactive && highlight}
    {divider && <View style={[styles.divider, { left: tiled ? SETTINGS.rowPadding + SETTINGS.tile + SETTINGS.rowGap : SETTINGS.rowPadding }]} />}
    {tiled && <SettingsTile icon={icon} tint={tint}>{iconElement}</SettingsTile>}
    <View style={[styles.copy, centered && styles.copyCentered]}>
      <Text style={[styles.title, destructive && styles.destructive]}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {stacked && shownValue}
    </View>
    {!stacked && shownValue}
    {loading ? <ActivityIndicator color={SETTINGS.accent} />
      : radio ? <SettingsCheck selected={selected} />
        : interactive && showAccessory && (accessory || <Ionicons name="chevron-forward" size={16} color={SETTINGS.chevron} />)}
  </Row>;
}

// A check that springs in when its row is chosen and is gone at once when it isn't.
export function SettingsCheck({ selected }) {
  const { reduceMotion } = useMotionPreference();
  const shown = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    shown.value = selected && !reduceMotion ? withSpring(1, SETTINGS_MOTION.pop) : selected ? 1 : 0;
  }, [selected, reduceMotion, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.value),
    transform: [{ scale: SETTINGS_MOTION.popFrom + (1 - SETTINGS_MOTION.popFrom) * shown.value }],
  }));
  return <Animated.View accessible={false} style={[styles.check, style]}>
    <Ionicons name="checkmark" size={20} color={SETTINGS.accent} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  row: { minHeight: SETTINGS.rowHeight, paddingVertical: 12, paddingHorizontal: SETTINGS.rowPadding, gap: SETTINGS.rowGap,
    flexDirection: "row", alignItems: "center" },
  centered: { justifyContent: "center" },
  disabled: { opacity: 0.5 },
  divider: { position: "absolute", top: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: SETTINGS.hairline },
  copy: { flex: 1, gap: 2 },
  copyCentered: { flex: 0, alignItems: "center" },
  title: { ...TYPOGRAPHY.bodyMedium, color: SETTINGS.ink },
  destructive: { color: SETTINGS.danger },
  good: { color: TINTS.leaf.icon },
  subtitle: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft },
  value: { ...TYPOGRAPHY.body, color: SETTINGS.inkSoft, flexShrink: 1, maxWidth: "50%", textAlign: "right" },
  valueStacked: { maxWidth: "100%", textAlign: "left" },
  check: { width: 22, alignItems: "center" },
});
