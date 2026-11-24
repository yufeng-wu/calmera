import { Alert, Platform, Pressable, StyleSheet } from "react-native";
import { requireCalmeraNativeView } from "../../../modules/calmera-native";

const NativeGoalsMenu = Platform.OS === "ios" ? requireCalmeraNativeView("GoalsMenu") : null;

export default function SummaryGoalsMenu({ onEditGoals }) {
  if (NativeGoalsMenu) return <NativeGoalsMenu style={StyleSheet.absoluteFill} onEditGoals={onEditGoals} />;
  return <Pressable style={StyleSheet.absoluteFill} accessible={false}
    onLongPress={() => Alert.alert("Nutrition goals", undefined, [
      { text: "Edit goals", onPress: onEditGoals }, { text: "Cancel", style: "cancel" },
    ])} delayLongPress={450} />;
}
