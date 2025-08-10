import { View, Text } from "react-native";
import { styles } from "../assets/styles/home.styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS, RAINBOW_COLORS } from "../constants/colors";
import ProgressRing from "./ProgressRing";

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

  // Determine if the calorie goal is exceeded (for status indicator) and choose ring color
  const exceeded = calorieGoal !== undefined && calories > calorieGoal;
  const calorieRingColor = exceeded ? COLORS.expense : COLORS.income;

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
            <Text style={styles.balanceTitle}>Calories </Text>
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
                  backgroundColor: exceeded ? COLORS.expense : COLORS.income,
                  marginLeft: 6,
                }}
              />
            )} */}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.balanceAmount}>
              {formatCalories(calories, calorieGoal)}
            </Text>
          </View>
        </View>
      </View>

      {/* Macro breakdown */}
      <View style={styles.balanceStats}>
        {/* Protein */}
        <View style={styles.balanceStatItem}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Text style={styles.balanceStatLabel}>Protein </Text>
            <ProgressRing
              size={18}
              strokeWidth={3.8}
              value={protein}
              goal={proteinGoal}
              color={RAINBOW_COLORS[1]}
              style={{ marginLeft: 6 }}
            />
          </View>
          <Text style={styles.balanceStatAmount}>
            {formatMacro(protein, proteinGoal, " g")}
          </Text>
        </View>

        <View style={styles.statDivider} />

        {/* Carbs */}
        <View style={styles.balanceStatItem}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Text style={styles.balanceStatLabel}>Carbs </Text>
            <ProgressRing
              size={18}
              strokeWidth={3.8}
              value={carbs}
              goal={carbsGoal}
              color={RAINBOW_COLORS[2]}
              style={{ marginLeft: 6 }}
            />
          </View>
          <Text style={styles.balanceStatAmount}>
            {formatMacro(carbs, carbsGoal, " g")}
          </Text>
        </View>

        <View style={styles.statDivider} />

        {/* Fat */}
        <View style={styles.balanceStatItem}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Text style={styles.balanceStatLabel}>Fat </Text>
            <ProgressRing
              size={18}
              strokeWidth={3.8}
              value={fat}
              goal={fatGoal}
              color={RAINBOW_COLORS[3]}
              style={{ marginLeft: 6 }}
            />
          </View>
          <Text style={styles.balanceStatAmount}>
            {formatMacro(fat, fatGoal, " g")}
          </Text>
        </View>
      </View>
    </View>
  );
};
