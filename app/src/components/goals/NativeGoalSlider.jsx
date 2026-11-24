import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { requireCalmeraNativeView } from "../../../modules/calmera-chatgpt";
import { COLORS } from "@/constants/colors";

const NativeSlider = Platform.OS === "ios" ? requireCalmeraNativeView("GoalSlider") : null;
export default function NativeGoalSlider({ value, minimumValue = 0, maximumValue = 100,
  step = 1, onValueChange, onSlidingComplete, accessibilityLabel, unit = "", disabled = false, unset = false, color, style }) {
  const update = (next) => { onValueChange?.(next); onSlidingComplete?.(next); };
  if (NativeSlider) return <NativeSlider style={[styles.slider, style]} value={Number(value) || 0}
    minimumValue={minimumValue} maximumValue={maximumValue} step={step} sliderDisabled={disabled}
    sliderLabel={accessibilityLabel || "Goal"} unit={unit} valueUnset={unset} trackColor={color}
    onValueChange={({ nativeEvent }) => onValueChange?.(nativeEvent.value)}
    onSlidingComplete={({ nativeEvent }) => onSlidingComplete?.(nativeEvent.value)} />;
  // Existing frameworks only: accessible stepper fallback outside iOS, no new dependency.
  const change = (direction) => update(Math.min(maximumValue, Math.max(minimumValue,
    Number(((Number(value) || 0) + direction * step).toFixed(4)))));
  return <View style={[styles.fallback, style]}>
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Decrease ${accessibilityLabel}`}
      onPress={() => change(-1)} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable>
    <View style={[styles.track, color && { backgroundColor: `${color}33` }]}><View style={[styles.fill, color && { backgroundColor: color }, { width: `${Math.max(0, Math.min(100,
      ((Number(value) || 0) - minimumValue) / Math.max(1, maximumValue - minimumValue) * 100))}%` }]} /></View>
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Increase ${accessibilityLabel}`}
      onPress={() => change(1)} style={styles.step}><Text style={styles.stepText}>+</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  slider: { minHeight: 44, width: "100%" },
  fallback: { minHeight: 44, flexDirection: "row", gap: 12, alignItems: "center" },
  step: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  stepText: { color: COLORS.primary, fontSize: 24 },
  track: { flex: 1, height: 5, backgroundColor: COLORS.border, borderRadius: 3 },
  fill: { height: 5, backgroundColor: COLORS.primary, borderRadius: 3 },
});
