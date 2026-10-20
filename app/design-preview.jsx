import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RAINBOW_COLORS } from "@/constants/colors";
import { styles as home } from "@/assets/styles/home.styles";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem } from "@/components/FoodEntryItem";
import AddMealMenu from "@/components/AddMealMenu";

// Test-build-only preview, using fixed data and the restored production styles.
const meals = [
  { id: "preview-banana", foodName: "Banana", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, localTime: "09:00:00" },
  { id: "preview-toast", foodName: "Avocado toast", calories: 280, protein: 8, carbs: 32, fat: 14, localTime: "09:00:00" },
];
const previewOnly = () => Alert.alert("Preview only", "Synthetic examples. No account data is loaded or saved.");

export default function DesignPreview() {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState("Dashboard");
  const router = useRouter();
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/" />;
  const navigate = (path) => { setExpanded(false); router.push(path); };
  return <View style={styles.page}>
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 116 }}>
        {tab === "Dashboard" ? <>
          <View style={home.headerContainer}>
            <LinearGradient colors={RAINBOW_COLORS} start={{ x: 1, y: 1 }} end={{ x: 0, y: 0 }} style={home.premiumButton}>
              <Pressable onPress={previewOnly} style={{ paddingHorizontal: 10, paddingVertical: 8 }}><Text style={home.premiumButtonText}>ChatGPT</Text></Pressable>
            </LinearGradient>
            <View style={home.header}><View style={home.headerLeft}>
              <View style={home.welcomeContainer}><Text style={home.welcomeText}>Welcome back,</Text><Text style={home.usernameText}>foodwrap test</Text></View>
              <Image source={require("../assets/images/logo.png")} style={home.headerLogo} contentFit="contain" />
            </View></View>
            <Text style={home.dateText}> Sunday, October 18</Text>
            <NutritionSummaryCard onEditGoals={previewOnly} summary={{ calories: 385, protein: 9.3, carbs: 59, fat: 14.4 }} goals={{ calorieGoal: 2000, proteinGoal: 100, carbsGoal: 250, fatGoal: 65 }} />
          </View>
          <View style={home.transactionsContainer}>
            <Text style={home.mealGroupTitle}>Breakfast</Text>
            {meals.map((meal) => <FoodEntryItem key={meal.id} item={meal} onEdit={previewOnly} onDelete={previewOnly} />)}
            <Text style={styles.note}>Layout preview · synthetic examples only</Text>
          </View>
        </> : <View style={{ padding: 24 }}><Text style={styles.title}>{tab}</Text><Text style={styles.note}>Synthetic preview only.</Text></View>}
      </ScrollView>
      {tab === "Dashboard" && <AddMealMenu expanded={expanded} onToggle={() => setExpanded(!expanded)} onClose={() => setExpanded(false)}
        onText={() => navigate("/create")} onPhoto={() => navigate("/photo-log")}
        onVoicePress={previewOnly} onVoiceLongPress={() => {}} onVoicePressOut={() => {}}
        recording={false} analyzing={false} voiceWidth={120} seconds={0} />}
    </View>
    <View style={styles.tabs}>{[["Dashboard", "grid"], ["History", "calendar"], ["Settings", "settings"]].map(([name, icon]) =>
      <Pressable key={name} onPress={() => { setExpanded(false); setTab(name); }} accessibilityRole="tab" accessibilityState={{ selected: tab === name }} style={styles.tab}>
        <Ionicons name={icon} size={24} color={tab === name ? COLORS.primary : "#8E8E93"} /><Text style={[styles.tabLabel, { color: tab === name ? COLORS.primary : "#8E8E93" }]}>{name}</Text>
      </Pressable>)}</View>
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  note: { fontSize: 12, color: COLORS.textLight, marginVertical: 20, textAlign: "center" },
  title: { fontSize: 18, fontWeight: "600", color: COLORS.text, textAlign: "center" },
  tabs: { height: 84, paddingTop: 8, paddingBottom: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#D8D8D8", backgroundColor: COLORS.white, flexDirection: "row" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  tabLabel: { fontSize: 10, marginBottom: 4 },
});
