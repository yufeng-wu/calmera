import { TYPOGRAPHY } from "@/constants/typography";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

export const SCALE_OPTIONS = [
  { key: "integer", title: "Integer only", description: "No decimal places (e.g., 256g)", img: require("@/assets/images/0-decimal.png") },
  { key: "1-decimal", title: "1 decimal place", description: "Shows one digit after the decimal (e.g., 256.1g)", img: require("@/assets/images/1-decimal.png") },
  { key: "2-decimal", title: "2 decimal places", description: "Shows two digits after the decimal (e.g., 256.13g)", img: require("@/assets/images/2-decimal.png") },
];
export default function ScaleOptions({ selected, onSelect, disabled = false }) {
  const { fontScale } = useWindowDimensions();
  return <View accessibilityRole="radiogroup" style={styles.list}>
    {SCALE_OPTIONS.map(option => <Pressable key={option.key} onPress={() => onSelect(option.key)} disabled={disabled}
      accessibilityRole="radio" accessibilityLabel={`${option.title}. ${option.description}`}
      accessibilityState={{ checked: selected === option.key, disabled }}
      style={({ pressed }) => [styles.option, selected === option.key && styles.selected, pressed && styles.pressed]}>
      <Image source={option.img} style={[styles.image, fontScale > 1.5 && styles.smallImage]} resizeMode="contain" accessibilityIgnoresInvertColors accessible={false} />
      <View style={styles.copy}><Text style={styles.title}>{option.title}</Text><Text style={styles.description}>{option.description}</Text></View>
      <Ionicons name={selected === option.key ? "checkmark-circle" : "ellipse-outline"} size={23}
        color={selected === option.key ? COLORS.primary : COLORS.textLight} />
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  list: { gap: 12 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.card, padding: 16,
    borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: "#EAE1D7", minHeight: 104 },
  selected: { borderColor: COLORS.primary, backgroundColor: "#FFFDF9" },
  pressed: { backgroundColor: "#F5EEE8" },
  image: { width: 72, height: 72, borderRadius: 12, backgroundColor: COLORS.white },
  smallImage: { width: 48, height: 56 },
  copy: { flex: 1, gap: 5 },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text},
  description: { ...TYPOGRAPHY.caption, color: COLORS.textLight},
});
