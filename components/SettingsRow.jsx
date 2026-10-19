import { TYPOGRAPHY } from "@/constants/typography";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

export default function SettingsRow({ title, subtitle, icon, onPress, selected = false,
  destructive = false, disabled = false, divider = false, accessibilityRole = "button" }) {
  const color = destructive ? COLORS.expense : COLORS.primary;
  return <Pressable accessibilityRole={accessibilityRole} accessibilityLabel={title}
    accessibilityState={{ disabled, ...(accessibilityRole === "radio" ? { checked: selected } : {}) }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
    {!!icon && <View style={styles.icon}><Ionicons name={icon} size={21} color={color} /></View>}
    <View style={styles.copy}>
      <Text style={[styles.title, destructive && { color: COLORS.expense }]}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    <Ionicons name={accessibilityRole === "radio" ? (selected ? "checkmark-circle" : "ellipse-outline") : "chevron-forward"}
      size={accessibilityRole === "radio" ? 22 : 17} color={selected ? COLORS.primary : COLORS.textLight} />
  </Pressable>;
}
const styles = StyleSheet.create({
  row: { minHeight: 62, paddingVertical: 16, paddingHorizontal: 18, gap: 13, flexDirection: "row", alignItems: "center" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EBE3DB" },
  pressed: { backgroundColor: "#F6F0EA" },
  icon: { width: 30, minHeight: 30, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  title: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text},
  subtitle: { ...TYPOGRAPHY.caption, color: COLORS.textLight},
});
