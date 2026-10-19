import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";
import { COLORS } from "@/constants/colors";

export const MEAL_EFFECT_OUTSET = 20;

const NativeActions = Platform.OS === "ios" ? requireNativeViewManager("CalmeraChatGPT", "MealActions") : null;

export default function MealSwipeActions({ width, visible, onEdit, onDelete, onMetrics }) {
  const railWidth = width * 2 + 20;
  const contentWidth = width * 2 + 8;
  // The swipe wrapper has shadow bleed room. Offset controls back to the
  // original row edge, keeping the card-to-button gap at 12 pt.
  const contentStyle = { width: contentWidth, flex: 1, marginLeft: 12 - MEAL_EFFECT_OUTSET };
  // Swipeable's absolute action area includes its 20pt material/shadow inset.
  // Removing that inset gives both buttons the card's exact current height,
  // including wrapped food names, expanded nutrition and larger text sizes.
  return <View style={{ width: railWidth, marginVertical: MEAL_EFFECT_OUTSET }}>
    {NativeActions ? <NativeActions style={contentStyle}
      buttonWidth={width} actionsVisible={visible}
      onAction={({ nativeEvent }) => { if (nativeEvent.action === "edit") onEdit(); else if (nativeEvent.action === "delete") onDelete(); }}
      onMetrics={onMetrics ? ({ nativeEvent }) => onMetrics(nativeEvent) : undefined} />
      : <View style={[styles.rail, contentStyle]} accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}>
        {[{ label: "Edit", color: COLORS.primary, action: onEdit },
          { label: "Delete", color: COLORS.expense, action: onDelete }].map(item =>
          <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label} meal`}
            onPress={item.action} style={({ pressed }) => [styles.action, { width, alignSelf: "stretch", borderRadius: 28 }, pressed && styles.pressed]}>
            <Text style={[styles.label, { color: item.color }]}>{item.label}</Text>
          </Pressable>)}
      </View>}
  </View>;
}

const styles = StyleSheet.create({
  rail: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  action: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.card, borderColor: "#E8DFD6", borderWidth: 1 },
  label: { fontSize: 14, fontWeight: "500", textAlign: "center" },
  pressed: { opacity: 0.75 },
});
