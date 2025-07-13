import { View, Text } from "react-native";
import { styles } from "../assets/styles/home.styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "../constants/colors";

export const NutritionSummaryCard = ({ summary = {}, goals = {} }) => {
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

  // Determine if the calorie goal is exceeded (for status indicator)
  const exceeded = calorieGoal !== undefined && calories > calorieGoal;

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

  return (
    <View style={styles.balanceCard}>
      {/* Calories */}
      <Text style={styles.balanceTitle}>Calories</Text>
      {/* Calories value with status indicator */}
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}
      >
        <Text style={[styles.balanceAmount, { marginBottom: 0 }]}>
          {formatCalories(calories, calorieGoal)}
        </Text>
        {calorieGoal !== undefined && calories > 0 && (
          <Ionicons
            name={exceeded ? "arrow-up" : "checkmark"}
            size={20}
            color={exceeded ? COLORS.expense : COLORS.income}
            style={{ marginLeft: 6 }}
          />
        )}
      </View>

      {/* Macro breakdown */}
      <View style={styles.balanceStats}>
        {/* Protein */}
        <View style={styles.balanceStatItem}>
          <Text style={styles.balanceStatLabel}>Protein</Text>
          <Text style={styles.balanceStatAmount}>
            {formatMacro(protein, proteinGoal, " g")}
          </Text>
        </View>

        <View style={styles.statDivider} />

        {/* Carbs */}
        <View style={styles.balanceStatItem}>
          <Text style={styles.balanceStatLabel}>Carbs</Text>
          <Text style={styles.balanceStatAmount}>
            {formatMacro(carbs, carbsGoal, " g")}
          </Text>
        </View>

        <View style={styles.statDivider} />

        {/* Fat */}
        <View style={styles.balanceStatItem}>
          <Text style={styles.balanceStatLabel}>Fat</Text>
          <Text style={styles.balanceStatAmount}>
            {formatMacro(fat, fatGoal, " g")}
          </Text>
        </View>
      </View>
    </View>
  );
};
