import { View, Text, Pressable, StyleSheet, LayoutAnimation, UIManager, Platform, useWindowDimensions, AccessibilityInfo } from "react-native";
import Animated, { Layout, FadeIn, FadeOut, useReducedMotion, ReduceMotion } from "react-native-reanimated";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { styles } from "../assets/styles/home.styles";
import { COLORS } from "../constants/colors";
import { getFoodEmoji } from "@/lib/foodIcons.mjs";
import { formatTime } from "../lib/utils";
import MealSwipeActions, { MEAL_EFFECT_OUTSET } from "./MealSwipeActions";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

// Only a UI controller reference is shared. Opening another row closes the old one.
let activeRow = null;
const SPRING = { mass: 0.9, stiffness: 310, damping: 34, overshootClamping: false };

export function closeOpenMealActions() {
  activeRow?.current?.close();
  activeRow = null;
}

export const FoodEntryItem = ({ item, onDelete, onEdit, enableLayout = true, onSwipeStateChange, onActionMetrics }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  useEffect(() => {
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => listener.remove();
  }, []);
  const { fontScale, width: screenWidth } = useWindowDimensions();
  const actionScale = Math.max(1, fontScale);
  const actionWidth = Math.min(Math.ceil(60 * actionScale), Math.max(60, (screenWidth - 52) / 2));
  const actionHeight = Math.ceil(52 * actionScale);
  const swipeSpring = useMemo(() => ({ ...SPRING, overshootClamping: reducedMotion,
    reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.System }), [reducedMotion]);
  const router = useRouter();
  const swipeable = useRef(null);
  const isOpen = useRef(false);
  useEffect(() => {
    // A changed text size or rotation changes the action width. Close once,
    // then let the next gesture measure the new rail instead of keeping a stale offset.
    swipeable.current?.reset();
    isOpen.current = false;
    setActionsVisible(false);
    if (activeRow === swipeable) activeRow = null;
  }, [actionWidth, actionHeight]);
  const { foodName = item.food_name, calories, protein, carbs, fat, localTime = item.local_time } = item;
  const macros = `Protein ${Number(protein)}g   Carbs ${Number(carbs)}g   Fat ${Number(fat)}g`;

  const close = useCallback(() => {
    swipeable.current?.close();
    if (activeRow === swipeable) activeRow = null;
  }, []);
  useFocusEffect(useCallback(() => () => {
    // Tab changes dismiss controls; reset avoids a stale open row on return.
    swipeable.current?.reset();
    isOpen.current = false;
    setActionsVisible(false);
    if (activeRow === swipeable) activeRow = null;
  }, []));
  const claimRow = () => {
    if (activeRow && activeRow !== swipeable) activeRow.current?.close();
    activeRow = swipeable;
  };
  const revealActions = () => { claimRow(); swipeable.current?.openRight(); };
  const edit = () => { close(); if (onEdit) onEdit(item); else router.push(`/edit/${item.id}`); };
  const remove = () => { close(); onDelete?.(item.id); };
  const toggleExpand = () => {
    if (isOpen.current) { close(); return; }
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(value => !value);
  };
  const accessibilityAction = ({ nativeEvent: { actionName } }) => {
    if (actionName === "edit") edit();
    else if (actionName === "delete") remove();
    else if (actionName === "showActions") revealActions();
    else toggleExpand();
  };

  return <Animated.View style={swipeStyles.row}
    layout={enableLayout && !reducedMotion ? Layout.springify().damping(18) : undefined}>
    <Swipeable ref={swipeable} pointerEvents="box-none" friction={1} rightThreshold={22}
      dragOffsetFromLeftEdge={12} dragOffsetFromRightEdge={10}
      overshootLeft={false} overshootRight={!reducedMotion} overshootFriction={9}
      enableTrackpadTwoFingerGesture animationOptions={swipeSpring}
      containerStyle={swipeStyles.swipeable}
      onSwipeableOpenStartDrag={() => { claimRow(); onSwipeStateChange?.("dragging"); }}
      onSwipeableWillOpen={() => {
        claimRow(); isOpen.current = true; setActionsVisible(true);
        onSwipeStateChange?.("opening");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      }}
      onSwipeableWillClose={() => onSwipeStateChange?.("closing")}
      onSwipeableOpen={() => onSwipeStateChange?.("open")}
      onSwipeableClose={() => {
        isOpen.current = false; setActionsVisible(false);
        if (activeRow === swipeable) activeRow = null;
        onSwipeStateChange?.("closed");
      }}
      renderRightActions={() => <MealSwipeActions width={actionWidth} height={actionHeight}
        visible={actionsVisible} onEdit={edit} onDelete={remove} onMetrics={onActionMetrics} />}>
      <Pressable style={({ pressed }) => [styles.foodEntryCard, swipeStyles.card, { minHeight: Math.max(70, actionHeight + 18) }, pressed && swipeStyles.pressedCard]}
        onPress={toggleExpand} onLongPress={revealActions} delayLongPress={450}
        accessibilityRole="button" accessibilityState={{ expanded: isExpanded }}
        accessibilityValue={{ text: isExpanded ? macros : "" }}
        accessibilityLabel={`${foodName}, ${parseFloat(calories).toFixed(0)} calories, ${formatTime(localTime)}`}
        accessibilityHint="Tap for nutrition details. Swipe left or hold for meal actions."
        accessibilityActions={[{ name: "activate", label: isExpanded ? "Hide nutrition" : "Show nutrition" },
          { name: "showActions", label: "Show meal actions" }, { name: "edit", label: "Edit meal" }, { name: "delete", label: "Delete meal" }]}
        onAccessibilityAction={accessibilityAction}>
        <View style={styles.transactionContent}>
          <View style={styles.categoryIconContainer}>
            <Text style={{ fontSize: 25 }} allowFontScaling={false} accessible={false}>{getFoodEmoji(foodName)}</Text>
          </View>
          <View style={styles.transactionLeft}><Text style={styles.transactionTitle}>{foodName}</Text></View>
          <View style={styles.transactionRight}>
            <Text style={[styles.transactionAmount, { color: COLORS.primary }]}>{parseFloat(calories).toFixed(0)} kcal</Text>
            <Text style={styles.transactionDate}>{formatTime(localTime)}</Text>
          </View>
          <View style={styles.indicatorContainer}>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textLight} />
          </View>
        </View>
        {isExpanded && <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(130)}
          exiting={reducedMotion ? undefined : FadeOut.duration(120)} style={styles.expandedContent}>
          <Text style={styles.macrosText}>{macros}</Text>
        </Animated.View>}
      </Pressable>
    </Swipeable>
  </Animated.View>;
};

const swipeStyles = StyleSheet.create({
  row: { marginBottom: 10 },
  swipeable: { overflow: "visible", padding: MEAL_EFFECT_OUTSET,
    marginVertical: -MEAL_EFFECT_OUTSET, marginHorizontal: -MEAL_EFFECT_OUTSET },
  card: { marginBottom: 0, minHeight: 70 },
  pressedCard: { opacity: 0.94 },
});
