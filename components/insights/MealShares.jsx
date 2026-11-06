import { StyleSheet, Text, View } from "react-native";
import { MEAL_COLORS } from "@/constants/colors";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

const MEAL_LABELS = { Breakfast: "Breakfast", Lunch: "Lunch", Dinner: "Dinner", Snack: "Snacks" };

// Which shade is which meal, in the same order as the bar's slices.
export function MealKey({ meals }) {
  return <View style={styles.key} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
    {meals.map(({ meal }) => <View key={meal} style={styles.keyItem}>
      <View style={[styles.keyDot, { backgroundColor: MEAL_COLORS[meal] }]} />
      <Text style={styles.keyText}>{MEAL_LABELS[meal]}</Text>
    </View>)}
  </View>;
}

// One nutrient as a whole bar, sliced by meal from breakfast to snacks.
export function MealBar({ meals, field, height = 8 }) {
  const slices = meals.filter((row) => (row[field] ?? 0) > 0);
  return <View style={[styles.bar, !slices.length && { height, borderRadius: height / 2, backgroundColor: COLORS.track }]}>
    {slices.map((row) => <View key={row.meal} style={{ flex: row[field], height, borderRadius: height / 2, backgroundColor: MEAL_COLORS[row.meal] }} />)}
  </View>;
}

export const describeShares = (title, meals, field) =>
  `${title}: ${meals.filter((row) => row[field] != null).map((row) => `${MEAL_LABELS[row.meal]} ${row[field]}%`).join(", ")}.`;

const styles = StyleSheet.create({
  key: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 2 },
  keyItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  keyDot: { width: 8, height: 8, borderRadius: 4 },
  keyText: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  bar: { flex: 1, flexDirection: "row", gap: 2 },
});
