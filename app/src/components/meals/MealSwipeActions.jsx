import { memo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { requireCalmeraNativeView } from "../../../modules/calmera-chatgpt";
import Animated, { useAnimatedProps, useAnimatedReaction, useAnimatedStyle } from "react-native-reanimated";
import { COLORS } from "@/constants/colors";

export const MEAL_EFFECT_OUTSET = 40;

const NativeActions = Platform.OS === "ios" ? requireCalmeraNativeView("MealActions") : null;

const AnimatedNativeActions = NativeActions ? Animated.createAnimatedComponent(NativeActions) : null;
Animated.addWhitelistedNativeProps({ revealProgress: true });

// The swipe row's action wrapper hides/clips its entire compositing tree.
// Reserve the rail's width there, but draw iOS glass in a sibling with full alpha.
export function MealActionRail({ translation, reveal, width }) {
  useAnimatedReaction(() => Math.max(0, Math.min(1, -translation.value / width)),
    value => { reveal.value = value; }, [translation, reveal, width]);
  return <View pointerEvents="none" style={{ width }} />;
}

function MealSwipeActions({ width, progress, visible, onDelete, onMetrics, overlay = false, previewPalette }) {
  const animatedProps = useAnimatedProps(() => ({
    revealProgress: Math.max(0, Math.min(1, progress.value)),
  }));
  const fallbackReveal = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - Math.max(0, Math.min(1, progress.value))) * (width + 12) }],
  }));
  // Only Delete lives on the swipe rail; Edit sits in the expanded card.
  const railWidth = width + 12;
  const contentWidth = width;
  // Give UIKit's glass/shadow a real native canvas, rather than relying on
  // overflow outside the Expo view's exact button-sized compositing bounds.
  // The host includes the same bleed inset as Swipeable; buttons sit inside it.
  const nativeStyle = overlay ? { position: "absolute", top: -MEAL_EFFECT_OUTSET, bottom: -MEAL_EFFECT_OUTSET,
    right: -MEAL_EFFECT_OUTSET, width: contentWidth + 2 * MEAL_EFFECT_OUTSET }
    : { position: "absolute", top: 0, bottom: 0,
      left: 12 - 2 * MEAL_EFFECT_OUTSET, width: contentWidth + 2 * MEAL_EFFECT_OUTSET };
  const fallbackStyle = { width: contentWidth, flex: 1,
    marginVertical: MEAL_EFFECT_OUTSET, marginLeft: 12 - MEAL_EFFECT_OUTSET };
  return <View pointerEvents="box-none" style={overlay ? StyleSheet.absoluteFill : { width: railWidth }}>
    {AnimatedNativeActions ? <AnimatedNativeActions style={nativeStyle} animatedProps={animatedProps}
      previewPalette={previewPalette || "tangerine"} buttonWidth={width} effectOutset={MEAL_EFFECT_OUTSET} actionsVisible={visible} reportMetrics={Boolean(onMetrics)}
      onAction={({ nativeEvent }) => { if (nativeEvent.action === "delete") onDelete(); }}
      onMetrics={onMetrics ? ({ nativeEvent }) => onMetrics(nativeEvent) : undefined} />
      : <Animated.View style={[styles.rail, fallbackStyle, fallbackReveal]} accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}>
        {[{ label: "Delete", color: COLORS.expense, action: onDelete }].map(item =>
          <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label} meal`}
            onPress={item.action} style={({ pressed }) => [styles.action, { width, alignSelf: "stretch", borderRadius: 28 }, pressed && styles.pressed]}>
            <Text style={[styles.label, { color: item.color }]}>{item.label}</Text>
          </Pressable>)}
      </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  rail: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  action: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.card, borderColor: "#E8DFD6", borderWidth: 1 },
  label: { fontSize: 14, fontWeight: "500", textAlign: "center" },
  pressed: { opacity: 0.75 },
});

export default memo(MealSwipeActions);
