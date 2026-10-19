import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "@/constants/colors";

export const MEAL_EFFECT_OUTSET = 20;

const NativeActions = Platform.OS === "ios" ? requireNativeViewManager("CalmeraChatGPT", "MealActions") : null;

export default function MealSwipeActions({ width, height, visible, onEdit, onDelete, onMetrics }) {
  const railWidth = width * 2 + 20;
  const contentWidth = width * 2 + 8;
  // The swipe wrapper has shadow bleed room. Offset controls back to the
  // original row edge, keeping the card-to-button gap at 12 pt.
  const contentStyle = { width: contentWidth, height, marginLeft: 12 - MEAL_EFFECT_OUTSET };
  return <View style={{ width: railWidth, justifyContent: "center" }}>
    {NativeActions ? <NativeActions style={contentStyle}
      buttonWidth={width} buttonHeight={height} actionsVisible={visible}
      onAction={({ nativeEvent }) => { if (nativeEvent.action === "edit") onEdit(); else if (nativeEvent.action === "delete") onDelete(); }}
      onMetrics={onMetrics ? ({ nativeEvent }) => onMetrics(nativeEvent) : undefined} />
      : <View style={[styles.rail, contentStyle]} accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}>
        {[{ label: "Edit", icon: "pencil-outline", color: COLORS.primary, action: onEdit },
          { label: "Delete", icon: "trash-outline", color: COLORS.expense, action: onDelete }].map(item =>
          <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label} meal`}
            onPress={item.action} style={({ pressed }) => [styles.action, { width, height, borderRadius: Math.min(width, height) / 2 }, pressed && styles.pressed]}>
            <Ionicons name={item.icon} size={19} color={item.color} accessible={false} />
            <Text style={[styles.label, { color: item.color }]}>{item.label}</Text>
          </Pressable>)}
      </View>}
  </View>;
}

const styles = StyleSheet.create({
  rail: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: { alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: "#FFFCF8", borderColor: "#E8DFD6", borderWidth: 1 },
  label: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  pressed: { opacity: 0.75 },
});
