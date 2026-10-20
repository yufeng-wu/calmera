import { SURFACES } from "@/constants/surfaces";
import { TYPOGRAPHY } from "@/constants/typography";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

export default function SettingsRow({ title, subtitle, icon, onPress, selected = false,
  destructive = false, disabled = false, divider = false, showAccessory = true, accessibilityRole = "button", accessibilityValue }) {
  const color = destructive ? COLORS.expense : COLORS.primary;
  const interactive = typeof onPress === "function";
  const Row = interactive ? Pressable : View;
  const rowStyles = [styles.row, divider && styles.divider];
  return <Row accessible accessibilityRole={interactive ? accessibilityRole : "text"}
    accessibilityLabel={accessibilityValue ? title : [title, subtitle].filter(Boolean).join(". ")}
    accessibilityValue={accessibilityValue}
    accessibilityState={interactive ? { disabled, ...(accessibilityRole === "radio" ? { checked: selected } : {}) } : undefined}
    {...(interactive ? { disabled, onPress } : {})}
    style={interactive ? ({ pressed }) => [...rowStyles, pressed && styles.pressed] : rowStyles}>
    {!!icon && <View style={styles.icon}><Ionicons name={icon} size={21} color={color} /></View>}
    <View style={styles.copy}>
      <Text style={[styles.title, destructive && { color: COLORS.expense }]}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    {interactive && showAccessory && <Ionicons name={accessibilityRole === "radio" ? (selected ? "checkmark-circle" : "ellipse-outline") : "chevron-forward"}
      size={accessibilityRole === "radio" ? 22 : 17} color={selected ? COLORS.primary : COLORS.textLight} />}
  </Row>;
}
const styles = StyleSheet.create({
  row: { minHeight: 62, paddingVertical: 16, paddingHorizontal: 18, gap: 13, flexDirection: "row", alignItems: "center" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.separator },
  pressed: { backgroundColor: SURFACES.pressed },
  icon: { width: 30, minHeight: 30, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  title: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text},
  subtitle: { ...TYPOGRAPHY.caption, color: COLORS.textLight},
});
