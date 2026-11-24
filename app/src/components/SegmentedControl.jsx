import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { requireCalmeraNativeView } from "../../modules/calmera-chatgpt";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";

const NativeSegmented = Platform.OS === "ios" ? requireCalmeraNativeView("Segmented") : null;

// One row of choices. iOS draws UIKit's segmented control (Liquid Glass on iOS 26).
// fitContent sizes each segment to its title instead of equal widths.
export default function SegmentedControl({ options, symbols, value, onChange, disabled = false, accessibilityLabel, style, fitContent = false }) {
  const { fontScale } = useWindowDimensions();
  // A symbol above each title needs a taller row.
  const height = symbols ? Math.max(62, Math.round(38 * fontScale + 24)) : Math.max(48, Math.round(20 * fontScale + 28));
  if (NativeSegmented) return <NativeSegmented style={[{ height }, style]} options={options} symbols={symbols || []} selected={value || ""}
    controlLabel={accessibilityLabel || ""} controlDisabled={disabled} fitContent={fitContent}
    onSelect={({ nativeEvent }) => { if (nativeEvent.value !== value) onChange(nativeEvent.value); }} />;
  return <View style={[styles.track, { minHeight: height }, style]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
    {options.map(option => {
      const selected = option === value;
      return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }}
        disabled={disabled} onPress={() => { if (!selected) onChange(option); }}
        style={[styles.segment, fitContent && styles.fitted, selected && styles.selected]}>
        <Text style={[styles.label, selected && styles.selectedLabel]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{option}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 3, borderRadius: 999, backgroundColor: "#EFE7E0" },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 999, paddingHorizontal: 4 },
  fitted: { flex: 0, flexGrow: 1, flexBasis: "auto", paddingHorizontal: 10 },
  selected: { backgroundColor: COLORS.white },
  label: { ...TYPOGRAPHY.captionMedium, color: COLORS.text },
  selectedLabel: { color: COLORS.primary, fontWeight: "600" },
});
