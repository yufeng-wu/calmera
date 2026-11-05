import { TYPOGRAPHY } from "@/constants/typography";
import React, { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import NativeGoalSlider from "@/components/NativeGoalSlider";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { goalInputValue, goalSliderBounds } from "@/lib/goalSlider.mjs";

export default function GoalSliderRow({
  label, unit, value, onChange, maximum, rangeIncrement, step, disabled = false, color,
}) {
  const displayValue = goalInputValue(value);
  const rangeRef = useRef(goalSliderBounds(displayValue, maximum, rangeIncrement));
  const nextRange = goalSliderBounds(displayValue, maximum, rangeIncrement);
  // Expand for existing targets, while keeping the scale stable during a drag.
  rangeRef.current = {
    minimumValue: Math.min(rangeRef.current.minimumValue, nextRange.minimumValue),
    maximumValue: Math.max(rangeRef.current.maximumValue, nextRange.maximumValue),
  };

  return <View style={styles.row}>
    <View style={styles.heading} accessible
      accessibilityLabel={`${label}, ${displayValue || "not set"} ${unit}`}>
      <View style={styles.labelRow}>
        {!!color && <View style={[styles.dot, { backgroundColor: color }]} />}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.valueGroup}>
        <Text style={styles.value}>{displayValue ? Number(displayValue).toLocaleString("en-US") : "—"}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
    <NativeGoalSlider
      {...rangeRef.current}
      value={Number(displayValue) || 0}
      unset={displayValue === ""}
      step={step}
      disabled={disabled}
      onValueChange={(next) => onChange(goalInputValue(next))}
      accessibilityLabel={`${label} goal`}
      unit={unit}
      style={styles.slider}
    />
  </View>;
}

const styles = StyleSheet.create({
  row: { paddingTop: 8, paddingBottom: 2 },
  heading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    justifyContent: "space-between", columnGap: 16, rowGap: 4 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text, flexShrink: 1},
  valueGroup: { flexDirection: "row", alignItems: "baseline", gap: 5, marginLeft: "auto" },
  value: { ...TYPOGRAPHY.value, color: COLORS.text, fontVariant: ["tabular-nums"]},
  unit: { ...TYPOGRAPHY.caption, color: COLORS.textLight,},
  slider: { height: 44, width: "100%" },
});
