import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { Redirect } from "expo-router";
import Constants from "expo-constants";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { COLORS } from "@/constants/colors";

export default function SummaryMenuCheck() {
  const [selections, setSelections] = useState(0);
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/dashboard" />;
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 20, backgroundColor: COLORS.background, flexGrow: 1 }}>
    <Text style={{ fontSize: 22, fontWeight: "600", color: COLORS.text }}>Summary long-press check</Text>
    <Text>Actual summary component · synthetic numbers · no database access.</Text>
    <Text>Long press the card. Choose Edit goals, or tap outside to dismiss.</Text>
    <Text>Edit goals selections: {selections}</Text>
    <NutritionSummaryCard summary={{ calories: 385, protein: 9.3, carbs: 59, fat: 14.4 }}
      goals={{ calorieGoal: 2000, proteinGoal: 100, carbsGoal: 250, fatGoal: 65 }}
      onEditGoals={() => setSelections(value => value + 1)} />
  </ScrollView>;
}
