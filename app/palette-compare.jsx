import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PALETTE_PROPOSALS } from "@/constants/paletteProposals.mjs";
import { TYPOGRAPHY } from "@/constants/typography";
import { styles as home } from "@/assets/styles/home.styles";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem, closeOpenMealActions } from "@/components/FoodEntryItem";
import AddMealMenu from "@/components/AddMealMenu";
import { SystemTabsInteractionCheck } from "@/components/SystemTabBar";

const MEALS = [
  { id: "palette-yogurt", mealType: "Breakfast", foodName: "Greek Yogurt", calories: 230, protein: 18, carbs: 30, fat: 7, localTime: "09:10:00" },
  { id: "palette-harvest", mealType: "Lunch", foodName: "Chicken Harvest Bowl", calories: 480, protein: 32, carbs: 55, fat: 15, localTime: "12:35:00" },
  { id: "palette-salmon", mealType: "Dinner", foodName: "Miso Salmon", calories: 510, protein: 38, carbs: 40, fat: 20, localTime: "18:45:00" },
];
const summary = { calories: 1220, protein: 88, carbs: 125, fat: 42 };
const goals = { calorieGoal: 2000, proteinGoal: 150, carbsGoal: 200, fatGoal: 50 };
const previewOnly = () => Alert.alert("Palette preview", "These are example meals. No records or preferences are changed.");
const noAction = () => {};

export default function PaletteCompare() {
  const { variant } = useLocalSearchParams();
  const [id, setId] = useState(variant === "basil" ? "basil" : "tangerine");
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  const palette = PALETTE_PROPOSALS.find(item => item.id === id);
  const barHeight = 64 + insets.bottom;
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/" />;
  const choose = next => { closeOpenMealActions(); setExpanded(false); setId(next); };
  return <View style={[styles.page, { paddingTop: insets.top, backgroundColor: palette.canvas }]}>
    <View style={styles.review}>
      <Text style={[styles.eyebrow, { color: palette.textLight }]}>PALETTE PREVIEW</Text>
      <View style={styles.choices}>
        {PALETTE_PROPOSALS.map(item => <Pressable key={item.id} accessibilityRole="radio"
          accessibilityLabel={`${item.name} palette`} accessibilityState={{ checked: id === item.id }}
          onPress={() => choose(item.id)} style={({ pressed }) => [styles.choice,
            { backgroundColor: item.id === id ? palette.badge : palette.card, borderColor: palette.border },
            pressed && { opacity: 0.8 }]}>
          <View style={[styles.swatch, { backgroundColor: item.primary }]} />
          <Text style={[styles.choiceText, { color: palette.text }]}>{item.name}</Text>
        </Pressable>)}
      </View>
      <Text style={[styles.caption, { color: palette.textLight }]}>{palette.description} · example meals</Text>
    </View>
    <ScrollView onScrollBeginDrag={closeOpenMealActions} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 116 + barHeight }}>
      <View style={[home.headerContainer, { paddingTop: 12 }]}>
        <Text style={[home.todayWordmark, { color: palette.primary }]} accessibilityRole="header">foodwrap.</Text>
        <Text style={[home.dateText, { color: palette.text }]}>Tuesday, October 20</Text>
        <NutritionSummaryCard summary={summary} goals={goals} onEditGoals={previewOnly} palette={palette} />
      </View>
      <View style={home.transactionsContainer}>
        {MEALS.map(item => <View key={`${palette.id}:${item.id}`} style={home.mealGroupContainer}>
          <Text style={[home.mealGroupTitle, { color: palette.text }]}>{item.mealType}</Text>
          <FoodEntryItem item={item} onEdit={previewOnly} onDelete={previewOnly} palette={palette} />
        </View>)}
      </View>
    </ScrollView>
    <AddMealMenu previewPalette={palette.id} bottomInset={barHeight} expanded={expanded}
      onToggle={() => setExpanded(value => !value)} onClose={() => setExpanded(false)}
      onPhoto={previewOnly} onText={previewOnly} onVoicePress={previewOnly}
      onVoiceLongPress={noAction} onVoicePressOut={noAction} recording={false} seconds={0}
      analyzing={false} voiceWidth={120} />
    <View pointerEvents="none" style={styles.tabs}>
      <SystemTabsInteractionCheck selectedIndex={0} onSelect={noAction} bottomInset={insets.bottom} previewPalette={palette.id} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1 },
  review: { paddingHorizontal: 16, paddingTop: 8, gap: 9 },
  eyebrow: { ...TYPOGRAPHY.eyebrow },
  choices: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 0.5,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 8 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  choiceText: { ...TYPOGRAPHY.bodyMedium },
  caption: { ...TYPOGRAPHY.caption },
  tabs: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
