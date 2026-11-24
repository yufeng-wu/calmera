import { StyleSheet, View } from "react-native";
import { styles } from "@/assets/styles/home.styles";
import { COLORS } from "@/constants/colors";

export default function NutritionSummarySkeleton({ loading = true }) {
  return <View style={[styles.balanceCard, local.card]} accessible accessibilityLabel={loading ? "Getting nutrition summary" : "Nutrition summary unavailable"}>
    <View style={[local.bar, { width: 72, height: 12 }]} />
    <View style={[local.bar, { width: 180, height: 26 }]} />
    <View style={local.macros}>{[0, 1, 2].map((index) => <View key={index} style={[local.bar, { flex: 1, height: 22 }]} />)}</View>
  </View>;
}
const local = StyleSheet.create({
  card: { minHeight: 142, gap: 12 },
  bar: { backgroundColor: COLORS.border, opacity: 0.4, borderRadius: 6 },
  macros: { flexDirection: "row", gap: 18, marginTop: 4 },
});
