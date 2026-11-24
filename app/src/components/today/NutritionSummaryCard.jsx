import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { styles } from "./home.styles";
import { COLORS, RAINBOW_COLORS, CALORIE_PROGRESS_COLOR } from "../../constants/colors";
import ProgressRing from "./ProgressRing";
import SummaryGoalsMenu from "./SummaryGoalsMenu";
import { useRouter } from "expo-router";

export const NutritionSummaryCard = ({ summary = {}, goals = {}, onEditGoals, palette }) => {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.4;
  // Extract consumed values (fallback to 0 if not provided)
  const calories = Number(
    summary.calories ?? summary.dailyTotals?.calories ?? 0
  );
  const protein = Number(summary.protein ?? summary.dailyTotals?.protein ?? 0);
  const carbs = Number(summary.carbs ?? summary.dailyTotals?.carbs ?? 0);
  const fat = Number(summary.fat ?? summary.dailyTotals?.fat ?? 0);

  // Extract goal values (fallback to undefined if not provided)
  const calorieGoal = goals.calorieGoal ?? goals.calorie_goal ?? goals.calories;
  const proteinGoal = goals.proteinGoal ?? goals.protein_goal ?? goals.protein;
  const carbsGoal = goals.carbsGoal ?? goals.carbs_goal ?? goals.carbs;
  const fatGoal = goals.fatGoal ?? goals.fat_goal ?? goals.fat;

  // Determine if the calorie goal is exceeded (for status indicator) and choose ring color
  const exceeded = calorieGoal !== undefined && calories > calorieGoal;
  const calorieRingColor = exceeded ? COLORS.expense : CALORIE_PROGRESS_COLOR;

  // Format calories and macros to smaller strings to avoid line wrapping
  const round = (num, decimals = 1) => {
    if (num === undefined || num === null) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  };

  const formatCalories = (value, goal) => {
    const consumed = Math.round(value);
    if (goal !== undefined) {
      const target = Math.round(goal);
      return `${consumed} / ${target} kcal`;
    }
    return `${consumed} kcal`;
  };

  const formatMacro = (value, goal, unit) => {
    const consumed = round(value, 1);
    if (goal !== undefined) {
      const target = round(goal, 1);
      return `${consumed} / ${target}${unit}`;
    }
    return `${consumed}${unit}`;
  };

  const editGoals = () => onEditGoals ? onEditGoals() : router.push("/update-goals");
  const accessibilitySummary = `Nutrition summary. Calories ${formatCalories(calories, calorieGoal)}. Protein ${formatMacro(protein, proteinGoal, " grams")}. Carbs ${formatMacro(carbs, carbsGoal, " grams")}. Fat ${formatMacro(fat, fatGoal, " grams")}.`;

  return (
    <View style={[styles.balanceCard, palette && { backgroundColor: palette.card, borderColor: palette.border }]} accessible accessibilityRole="summary"
      accessibilityLabel={accessibilitySummary}
      accessibilityHint="Long press for Edit goals."
      accessibilityActions={[{ name: "editGoals", label: "Edit goals" }]}
      onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === "editGoals") editGoals(); }}>
      {/* Calories row: left stack, right ring */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingBottom: 2,
            }}
          >
            <Text style={[styles.balanceTitle, palette && { color: palette.textLight }]}>Calories </Text>
            <ProgressRing
              size={18}
              strokeWidth={3.8}
              value={calories}
              goal={calorieGoal}
              color={calorieRingColor}
            />
            {/* {calorieGoal !== undefined && calories > 0 && (
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 10,
                  backgroundColor: calorieRingColor,
                  marginLeft: 6,
                }}
              />
            )} */}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[styles.balanceAmount, palette && { color: palette.text }]}>
              {formatCalories(calories, calorieGoal)}
            </Text>
          </View>
        </View>
      </View>

      {/* Macro breakdown */}
      <View style={[styles.balanceStats, largeText && responsive.macroRows]}>
        {/* Protein */}
        <View style={[styles.balanceStatItem, largeText && responsive.macroRow]}>
          <View style={[{ flexDirection: "row", alignItems: "flex-start" }, largeText && responsive.labelRow]}>
            <Text style={[styles.balanceStatLabel, largeText && responsive.label, palette && { color: palette.textLight }]}>Protein </Text>
            <ProgressRing
              size={18}
              strokeWidth={3.8}
              value={protein}
              goal={proteinGoal}
              color={RAINBOW_COLORS[1]}
              style={{ marginLeft: 6 }}
            />
          </View>
          <Text style={[styles.balanceStatAmount, largeText && responsive.amount, palette && { color: palette.macroText }]}>
            {formatMacro(protein, proteinGoal, " g")}
          </Text>
        </View>

        <View style={[styles.statDivider, largeText && responsive.hiddenDivider, palette && { borderColor: palette.divider }]} />

        {/* Carbs */}
        <View style={[styles.balanceStatItem, largeText && responsive.macroRow]}>
          <View style={[{ flexDirection: "row", alignItems: "flex-start" }, largeText && responsive.labelRow]}>
            <Text style={[styles.balanceStatLabel, largeText && responsive.label, palette && { color: palette.textLight }]}>Carbs </Text>
            <ProgressRing
              size={18}
              strokeWidth={3.8}
              value={carbs}
              goal={carbsGoal}
              color={RAINBOW_COLORS[2]}
              style={{ marginLeft: 6 }}
            />
          </View>
          <Text style={[styles.balanceStatAmount, largeText && responsive.amount, palette && { color: palette.macroText }]}>
            {formatMacro(carbs, carbsGoal, " g")}
          </Text>
        </View>

        <View style={[styles.statDivider, largeText && responsive.hiddenDivider, palette && { borderColor: palette.divider }]} />

        {/* Fat */}
        <View style={[styles.balanceStatItem, largeText && responsive.macroRow]}>
          <View style={[{ flexDirection: "row", alignItems: "flex-start" }, largeText && responsive.labelRow]}>
            <Text style={[styles.balanceStatLabel, largeText && responsive.label, palette && { color: palette.textLight }]}>Fat </Text>
            <ProgressRing
              size={18}
              strokeWidth={3.8}
              value={fat}
              goal={fatGoal}
              color={RAINBOW_COLORS[3]}
              style={{ marginLeft: 6 }}
            />
          </View>
          <Text style={[styles.balanceStatAmount, largeText && responsive.amount, palette && { color: palette.macroText }]}>
            {formatMacro(fat, fatGoal, " g")}
          </Text>
        </View>
      </View>
      <SummaryGoalsMenu onEditGoals={editGoals} />
    </View>
  );
};

// Larger Dynamic Type needs the full card width for each label/value pair.
// Keep the normal three-column layout and every existing font style unchanged.
const responsive = StyleSheet.create({
  macroRows: { flexDirection: "column", gap: 12 },
  macroRow: { flex: 0, width: "100%", flexDirection: "row", flexWrap: "wrap",
    alignItems: "center", columnGap: 12, rowGap: 4 },
  labelRow: { alignItems: "center", maxWidth: "100%", flexShrink: 1 },
  label: { marginBottom: 0, flexShrink: 1 },
  amount: { maxWidth: "100%", flexShrink: 1, marginLeft: "auto", textAlign: "right" },
  hiddenDivider: { display: "none" },
});
