import { ScrollView, StyleSheet, Text } from "react-native";
import { Redirect, useRouter } from "expo-router";
import Constants from "expo-constants";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { GlassButton } from "@/components/GlassForm";
import { COLORS } from "@/constants/colors";

// Development-build navigation to the actual forms, using isolated local fixtures.
export default function FormStyleCheck() {
  const router = useRouter();
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/dashboard" />;
  const goals = () => router.push("/update-goals?calmeraFixture=ui-goals");
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Form interaction check</Text>
    <Text style={styles.note}>Actual foodwrap forms · synthetic fixtures · no profile, photo library, inference or database access.</Text>
    <Text style={styles.note}>Long press this summary and select Edit goals to check the native menu-to-screen transition.</Text>
    <NutritionSummaryCard summary={{ calories: 550, protein: 32, carbs: 73, fat: 14.5 }}
      goals={{ calorieGoal: 2000, proteinGoal: 150, carbsGoal: 200, fatGoal: 50 }} onEditGoals={goals} />
    <GlassButton title="Open Goals" symbol="slider.horizontal.3" onPress={goals} />
    <GlassButton title="Check Goals loading" symbol="arrow.clockwise" onPress={() => router.push("/update-goals?calmeraFixture=ui-goals-load")} />
    <GlassButton title="Check Goals retry" symbol="arrow.clockwise" onPress={() => router.push("/update-goals?calmeraFixture=ui-goals-error")} />
    <GlassButton title="Check Goals save navigation" symbol="checkmark" onPress={() => router.push("/update-goals?calmeraFixture=ui-goals-save")} />
    <GlassButton title="Check Goals save failure" symbol="checkmark" onPress={() => router.push("/update-goals?calmeraFixture=ui-goals-save-error")} />
    <GlassButton title="Check Back during loading" symbol="chevron.left" onPress={() => router.push("/update-goals?calmeraFixture=ui-goals-slow")} />
    <GlassButton title="Open Manual" symbol="pencil" onPress={() => router.push("/create?calmeraFixture=ui-manual")} />
    <GlassButton title="Open Photo — empty" symbol="camera" onPress={() => router.push("/photo-log?calmeraFixture=ui-photo-empty")} />
    <GlassButton title="Open Photo — selected" symbol="photo" onPress={() => router.push("/photo-log?calmeraFixture=ui-photo-preview")} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 18, backgroundColor: COLORS.background },
  title: { fontSize: 22, color: COLORS.text, fontWeight: "600" },
  note: { fontSize: 14, lineHeight: 20, color: COLORS.textLight },
});
