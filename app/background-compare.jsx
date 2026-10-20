import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Redirect } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles as home } from "@/assets/styles/home.styles";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem, closeOpenMealActions } from "@/components/FoodEntryItem";
import { GlassButton } from "@/components/GlassForm";
import AddMealMenu from "@/components/AddMealMenu";
import { useTheme } from "@/context/ThemeContext";
import { SystemTabsInteractionCheck } from "@/components/SystemTabBar";
import { APPEARANCE_THEMES } from "@/constants/appearance.mjs";

// Compare only the canvas. Production palette, cards, typography and native
// controls are unchanged. These invented examples cannot read/write records.
const MEALS = [
  { id: "background-oats", mealType: "Breakfast", foodName: "Oatmeal With Blueberries", calories: 320, protein: 12, carbs: 52, fat: 8, localTime: "08:30:00" },
  { id: "background-salmon", mealType: "Lunch", foodName: "Salmon Rice Bowl", calories: 540, protein: 36, carbs: 58, fat: 18, localTime: "12:30:00" },
];
const summary = { calories: 860, protein: 48, carbs: 110, fat: 26 };
const goals = { calorieGoal: 2000, proteinGoal: 150, carbsGoal: 200, fatGoal: 50 };
const previewOnly = () => Alert.alert("Color comparison", "These are example meals. No account data is loaded or saved.");
const noAction = () => {};

export default function BackgroundCompare() {
  const { themeId: variant, selectTheme, ready } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const barHeight = 64 + insets.bottom;
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/dashboard" />;
  const selected = APPEARANCE_THEMES.find(item => item.id === variant);
  const select = value => { closeOpenMealActions(); selectTheme(value).catch(() => {}); };
  return <View style={styles.page}>
    <View style={styles.comparison}>
      <View style={styles.choices}>
        {APPEARANCE_THEMES.map(item => <GlassButton key={item.id} title={item.label} accessibilityLabel={`Show ${item.label} background`}
          role={variant === item.id ? "accent" : "default"} disabled={!ready} onPress={() => select(item.id)} style={[styles.choice, fontScale > 1.35 && { flexBasis: "100%" }]} />)}
      </View>
      <Text style={styles.note}>{selected.description} · example meals</Text>
    </View>
    <ScrollView style={home.scrollView} onScrollBeginDrag={closeOpenMealActions}
      contentContainerStyle={{ paddingBottom: 116 + barHeight }} scrollIndicatorInsets={{ bottom: barHeight }}>
      <View style={[home.headerContainer, { paddingTop: 12 }]}>
        <Text style={home.todayWordmark} accessibilityRole="header">foodwrap.</Text>
        <Text style={home.dateText}>Monday, October 19</Text>
        <NutritionSummaryCard summary={summary} goals={goals} onEditGoals={previewOnly} />
      </View>
      <View style={home.transactionsContainer}>
        {MEALS.map(item => <View key={item.id} style={home.mealGroupContainer}>
          <Text style={home.mealGroupTitle}>{item.mealType}</Text>
          <FoodEntryItem item={item} onEdit={previewOnly} onDelete={previewOnly} />
        </View>)}
      </View>
    </ScrollView>
    <AddMealMenu bottomInset={barHeight} expanded={expanded} onToggle={() => setExpanded(value => !value)}
      onClose={() => setExpanded(false)} onPhoto={previewOnly} onText={previewOnly}
      onVoicePress={previewOnly} onVoiceLongPress={noAction} onVoicePressOut={noAction}
      recording={false} analyzing={false} voiceWidth={120} seconds={0} />
    <View pointerEvents="none" style={styles.tabOverlay}>
      <SystemTabsInteractionCheck selectedIndex={0} onSelect={noAction} bottomInset={insets.bottom} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1 },
  comparison: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2, gap: 7 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  choice: { flexGrow: 1, flexBasis: "30%", minHeight: 44 },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  tabOverlay: { position: "absolute", bottom: 0, left: 0, right: 0 },
});
