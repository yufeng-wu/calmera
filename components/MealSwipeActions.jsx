import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";
import { COLORS } from "@/constants/colors";

export const MEAL_EFFECT_OUTSET = 40;

const NativeActions = Platform.OS === "ios" ? requireNativeViewManager("CalmeraChatGPT", "MealActions") : null;

export default function MealSwipeActions({ width, visible, onEdit, onDelete, onMetrics }) {
  const railWidth = width * 2 + 20;
  const contentWidth = width * 2 + 8;
  // Give UIKit's glass/shadow a real native canvas, rather than relying on
  // overflow outside the Expo view's exact button-sized compositing bounds.
  // The host includes the same bleed inset as Swipeable; buttons sit inside it.
  const nativeStyle = { position: "absolute", top: 0, bottom: 0,
    left: 12 - 2 * MEAL_EFFECT_OUTSET, width: contentWidth + 2 * MEAL_EFFECT_OUTSET };
  const fallbackStyle = { width: contentWidth, flex: 1,
    marginVertical: MEAL_EFFECT_OUTSET, marginLeft: 12 - MEAL_EFFECT_OUTSET };
  return <View pointerEvents="box-none" style={{ width: railWidth }}>
    {NativeActions ? <NativeActions style={nativeStyle}
      buttonWidth={width} effectOutset={MEAL_EFFECT_OUTSET} actionsVisible={visible}
      onAction={({ nativeEvent }) => { if (nativeEvent.action === "edit") onEdit(); else if (nativeEvent.action === "delete") onDelete(); }}
      onMetrics={onMetrics ? ({ nativeEvent }) => onMetrics(nativeEvent) : undefined} />
      : <View style={[styles.rail, fallbackStyle]} accessibilityElementsHidden={!visible}
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
