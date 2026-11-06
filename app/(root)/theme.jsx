import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { FormHeader, GlassButton, FormScreen, FormScrollView, formStyles } from "@/components/GlassForm";
import { settingsStyles, usePressHighlight } from "@/components/SettingsSection";
import ThemeCanvas from "@/components/ThemeCanvas";
import { APPEARANCE_THEMES } from "@/constants/appearance.mjs";
import { SETTINGS, SETTINGS_MOTION } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { useTheme } from "@/context/ThemeContext";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import usePageExit from "@/hooks/usePageExit";

export default function ThemeSettings({ calmeraPreview = false }) {
  const router = useRouter();
  const leave = usePageExit("/settings");
  const { fontScale } = useWindowDimensions();
  const { themeId, selectTheme, ready, saving, error, reload, review } = useTheme();
  const back = () => calmeraPreview
    ? router.replace({ pathname: "/ui-gallery", params: { page: "settings" } }) : leave();
  const choose = id => {
    if (!ready || (id === themeId && !error)) return;
    Haptics.selectionAsync().catch(() => {});
    selectTheme(id).catch(() => {});
  };
  const wide = fontScale > 1.35;
  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Theme" onBack={back} />
    <FormScrollView key={`theme-text-${fontScale}`} contentContainerStyle={settingsStyles.content}>
      <Text style={settingsStyles.lead}>Choose your calmera mood. The whole app changes with it.</Text>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="App theme">
        {APPEARANCE_THEMES.map(item => <ThemeOption key={item.id} item={item} wide={wide} disabled={!ready}
          selected={item.id === themeId} onPress={() => choose(item.id)} />)}
      </View>
      <View style={styles.notes}>
        <Text accessibilityLiveRegion="polite" style={[settingsStyles.footnote, error && styles.problem]}>
          {!ready ? "Loading your theme…" : saving ? "Saving…" : error === "save" ? "Couldn’t save this theme. Try again."
            : error === "load" ? "Couldn’t load your saved theme. Try again, or pick one."
              : "Saved on this phone."}
        </Text>
        {!!error && <GlassButton title="Try again" symbol="arrow.clockwise" onPress={() => error === "load" ? reload() : selectTheme(themeId).catch(() => {})} />}
        <Text style={settingsStyles.footnote}>Glow and Aura move gently. They stay still when Reduce Motion is on.</Text>
        {review && <Text style={settingsStyles.footnote}>UI review · this choice is saved only in the test preference.</Text>}
      </View>
    </FormScrollView>
  </FormScreen>;
}

// A live swatch of the theme. The chosen one gets an accent ring and a check that pops in.
function ThemeOption({ item, selected, wide, disabled, onPress }) {
  const { reduceMotion } = useMotionPreference();
  const shown = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    shown.value = !selected ? withTiming(0, { duration: reduceMotion ? 0 : 120 })
      : reduceMotion ? 1 : withSpring(1, SETTINGS_MOTION.pop);
  }, [selected, reduceMotion, shown]);
  const ring = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value) }));
  const { pressProps, highlight } = usePressHighlight(styles.highlight);
  const badge = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value),
    transform: [{ scale: SETTINGS_MOTION.popFrom + (1 - SETTINGS_MOTION.popFrom) * shown.value }] }));
  return <Pressable accessibilityRole="radio" accessibilityLabel={`${item.name}. ${item.description}.`}
    accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} {...pressProps}
    style={[styles.option, { width: wide ? "100%" : "48%" }]}>
    {highlight}
    <View style={styles.swatch} pointerEvents="none">
      <ThemeCanvas variant={item.id} motionEnabled={false} />
      <Animated.View style={[styles.badge, badge]}><Ionicons name="checkmark" size={14} color={SETTINGS.surface} /></Animated.View>
    </View>
    <View style={styles.copy}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={settingsStyles.footnote} numberOfLines={wide ? undefined : 2}>{item.description}</Text>
    </View>
    <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
  </Pressable>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  option: { padding: 8, paddingBottom: 12, gap: 10, borderRadius: 22, backgroundColor: SETTINGS.surface,
    borderWidth: 0.5, borderColor: SETTINGS.edge },
  highlight: { borderRadius: 22 },
  // Selection sits on top of the edge, so choosing never shifts the layout.
  ring: { ...StyleSheet.absoluteFillObject, margin: -0.5, borderRadius: 22, borderWidth: 2, borderColor: SETTINGS.accent },
  swatch: { height: 96, borderRadius: 15, overflow: "hidden", borderWidth: 0.5, borderColor: SETTINGS.hairline },
  badge: { position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
    backgroundColor: SETTINGS.accent },
  copy: { gap: 2, paddingHorizontal: 6 },
  name: { ...TYPOGRAPHY.bodyMedium, color: SETTINGS.ink },
  notes: { gap: 10, marginTop: -8 },
  problem: { color: SETTINGS.danger },
});
