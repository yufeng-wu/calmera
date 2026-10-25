import { Pressable, StyleSheet, Text, View } from "react-native";
import { SURFACES } from "@/constants/surfaces";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import Sparkline from "./Sparkline";

// One dashboard line: what it is, the number, how it compares, and its shape.
export default function MetricRow({ title, value, unit, detail, values, type, goal, divider, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${value} ${unit || ""}. ${detail || ""}`}
    onPress={onPress} style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
    <View style={styles.copy}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.valueLine} numberOfLines={1}>
        <Text style={styles.value}>{value}</Text>{unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
      {!!detail && <Text style={styles.detail}>{detail}</Text>}
    </View>
    <Sparkline values={values} type={type} goal={goal} />
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 18 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.separator },
  pressed: { backgroundColor: SURFACES.pressed },
  copy: { flex: 1, gap: 2 },
  title: { ...TYPOGRAPHY.body, color: COLORS.text },
  valueLine: { marginTop: 2 },
  value: { fontSize: 22, fontWeight: "600", lineHeight: 28, color: COLORS.text, fontVariant: ["tabular-nums"] },
  unit: { ...TYPOGRAPHY.body, color: COLORS.text },
  detail: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
});
