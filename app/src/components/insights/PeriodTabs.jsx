import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useMotionPreference } from "@/hooks/useMotionPreference";

const DOT = 5;

// Words in the title's place, with the orange period from the wordmark marking the
// current one. This is how a tab chooses what the whole page shows; SegmentedControl is
// for choosing a value inside a form.
export default function PeriodTabs({ items, value, onChange }) {
  const [centers, setCenters] = useState({});
  const { reduceMotion } = useMotionPreference();
  const x = useSharedValue(null);
  const center = centers[value];
  useEffect(() => {
    if (center == null) return;
    x.value = x.value == null || reduceMotion ? center : withSpring(center, { damping: 15, stiffness: 190, mass: 0.7 });
  }, [center, reduceMotion, x]);
  const dot = useAnimatedStyle(() => ({ opacity: x.value == null ? 0 : 1, transform: [{ translateX: (x.value ?? 0) - DOT / 2 }] }));
  return <View accessibilityRole="tablist" style={styles.row}>
    {items.map(({ id, label, accessibilityLabel }) => {
      const selected = id === value;
      return <Pressable key={id} accessibilityRole="tab" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }} hitSlop={{ top: 4, bottom: 4 }}
        onLayout={({ nativeEvent: { layout } }) => { const middle = layout.x + layout.width / 2; setCenters((all) => all[id] === middle ? all : { ...all, [id]: middle }); }}
        onPress={() => { if (!selected) onChange(id); }} style={styles.tab}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.label, selected && styles.selected]}>{label}</Text>
      </Pressable>;
    })}
    <Animated.View pointerEvents="none" style={[styles.dot, dot]} />
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 },
  tab: { flexShrink: 1, minHeight: 44, minWidth: 64, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  label: { ...TYPOGRAPHY.pageTitle, color: COLORS.textLight },
  selected: { color: COLORS.text },
  dot: { position: "absolute", left: 0, bottom: 8, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: COLORS.primary },
});
