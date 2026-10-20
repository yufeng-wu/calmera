import { View, Text, Pressable, StyleSheet, useWindowDimensions, AccessibilityInfo } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, useReducedMotion, ReduceMotion, useAnimatedReaction, runOnJS } from "react-native-reanimated";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { styles } from "../assets/styles/home.styles";
import { COLORS } from "../constants/colors";
import { getFoodEmoji } from "@/lib/foodIcons.mjs";
import { formatTime } from "../lib/utils";
import MealSwipeActions, { MEAL_EFFECT_OUTSET } from "./MealSwipeActions";

// Only a UI controller reference is shared. Opening another row closes the old one.
let activeRow = null;
const SPRING = { mass: 0.9, stiffness: 310, damping: 34, overshootClamping: false };

export function closeOpenMealActions() {
  activeRow?.current?.close();
  activeRow = null;
}

export const FoodEntryItem = memo(function FoodEntryItem({ item, onDelete, onEdit, onSwipeStateChange, onActionMetrics, onDetailsMetrics }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  useEffect(() => {
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => listener.remove();
  }, []);
  const { fontScale, width: screenWidth } = useWindowDimensions();
  const veryLargeText = fontScale > 2.3;
  const actionScale = Math.max(1, fontScale);
  const actionWidth = Math.min(Math.ceil(72 * actionScale), Math.max(72, (screenWidth - 52) / 2));
  // The details remain measured while closed, so the first tap and Dynamic Type
  // changes animate the actual content height instead of guessing a fixed size.
  const [detailsHeight, setDetailsHeight] = useState(0);
  const expansion = useSharedValue(0);
  const measuredDetailsHeight = useSharedValue(0);
  const renderedDetailsHeight = useSharedValue(0);
  useEffect(() => {
    const timing = {
      duration: reducedMotion ? 0 : 260,
      easing: Easing.out(Easing.cubic),
      reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.System,
    };
    measuredDetailsHeight.value = detailsHeight;
    // Retarget from the currently displayed pixel height. Multiplying a newly
    // measured height by an already-open progress value jumps on text reflow.
    renderedDetailsHeight.value = withTiming(isExpanded ? detailsHeight : 0, timing);
    expansion.value = withTiming(isExpanded ? 1 : 0, timing);
  }, [detailsHeight, isExpanded, reducedMotion, expansion, measuredDetailsHeight, renderedDetailsHeight]);
  // The actual rendered style and optional diagnostics share the same UI value.
  const detailsStyle = useAnimatedStyle(() => ({
    height: renderedDetailsHeight.value,
    opacity: expansion.value,
  }));
  useAnimatedReaction(() => onDetailsMetrics ? {
    height: renderedDetailsHeight.value, target: measuredDetailsHeight.value,
    progress: expansion.value, expanded: isExpanded ? 1 : 0, reduceMotion: reducedMotion ? 1 : 0,
  } : null, (value, previous) => {
    if (!value || !onDetailsMetrics) return;
    if (previous && Math.abs(value.height - previous.height) < 0.01
      && Math.abs(value.target - previous.target) < 0.01
      && Math.abs(value.progress - previous.progress) < 0.001
      && value.expanded === previous.expanded && value.reduceMotion === previous.reduceMotion) return;
    // No per-frame JS events in production: only the synthetic fixture opts in.
    runOnJS(onDetailsMetrics)(value);
  }, [onDetailsMetrics, isExpanded, reducedMotion]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expansion.value * 180}deg` }],
  }));
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
  }, [actionWidth]);
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
    setIsExpanded(value => !value);
  };
  const accessibilityAction = ({ nativeEvent: { actionName } }) => {
    if (actionName === "edit") edit();
    else if (actionName === "delete") remove();
    else if (actionName === "showActions") revealActions();
    else toggleExpand();
  };

  return <View style={swipeStyles.row}>
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
      renderRightActions={(progress) => <MealSwipeActions width={actionWidth} progress={progress}
        visible={actionsVisible} onEdit={edit} onDelete={remove} onMetrics={onActionMetrics} />}>
      <Pressable style={({ pressed }) => [styles.foodEntryCard, swipeStyles.card, pressed && swipeStyles.pressedCard]}
        onPress={toggleExpand} onLongPress={revealActions} delayLongPress={450}
        accessibilityRole="button" accessibilityState={{ expanded: isExpanded }}
        accessibilityValue={{ text: isExpanded ? macros : "" }}
        accessibilityLabel={`${foodName}, ${parseFloat(calories).toFixed(0)} calories, ${formatTime(localTime)}`}
        accessibilityHint="Tap for nutrition details. Swipe left or hold for meal actions."
        accessibilityActions={[{ name: "activate", label: isExpanded ? "Hide nutrition" : "Show nutrition" },
          { name: "showActions", label: "Show meal actions" }, { name: "edit", label: "Edit meal" }, { name: "delete", label: "Delete meal" }]}
        onAccessibilityAction={accessibilityAction}>
        <View style={[styles.transactionContent, veryLargeText && swipeStyles.largeTextContent]}>
          <View style={styles.categoryIconContainer}>
            <Text style={{ fontSize: 25 }} allowFontScaling={false} accessible={false}>{getFoodEmoji(foodName)}</Text>
          </View>
          <View style={[styles.transactionLeft, veryLargeText && swipeStyles.largeTextTitle]}><Text style={styles.transactionTitle}>{foodName}</Text></View>
          <View style={[styles.transactionRight, veryLargeText && swipeStyles.largeTextMetadata]}>
            <Text style={[styles.transactionAmount, { color: COLORS.primary }]}>{parseFloat(calories).toFixed(0)} kcal</Text>
            <Text style={styles.transactionDate}>{formatTime(localTime)}</Text>
          </View>
          <View style={[styles.indicatorContainer, veryLargeText && swipeStyles.largeTextIndicator]}>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </Animated.View>
          </View>
        </View>
        <Animated.View style={[swipeStyles.detailsClip, detailsStyle]} pointerEvents="none"
          accessibilityElementsHidden={!isExpanded}
          importantForAccessibility={isExpanded ? "auto" : "no-hide-descendants"}>
          <View style={[styles.expandedContent, swipeStyles.detailsContent]}
            onLayout={({ nativeEvent }) => setDetailsHeight(previous =>
              Math.abs(previous - nativeEvent.layout.height) > 0.5 ? nativeEvent.layout.height : previous)}>
            <Text style={[styles.macrosText, swipeStyles.detailsText]}>{macros}</Text>
          </View>
        </Animated.View>
      </Pressable>
    </Swipeable>
  </View>;
});

const swipeStyles = StyleSheet.create({
  row: { marginBottom: 10 },
  swipeable: { overflow: "visible", padding: MEAL_EFFECT_OUTSET,
    marginVertical: -MEAL_EFFECT_OUTSET, marginHorizontal: -MEAL_EFFECT_OUTSET },
  card: { marginBottom: 0, minHeight: 70 },
  pressedCard: { opacity: 0.94 },
  // Keep the same text hosts, but let metadata take its own row rather than
  // squeezing the title between the badge and a scaled right-hand column.
  largeTextContent: { flexWrap: "wrap", alignItems: "flex-start" },
  largeTextTitle: { minWidth: 0, paddingRight: 30 },
  largeTextMetadata: { flexBasis: "100%", alignItems: "flex-start", paddingLeft: 52, paddingRight: 30, marginTop: 8 },
  largeTextIndicator: { position: "absolute", top: 25, right: 15 },
  detailsClip: { overflow: "hidden" },
  detailsText: { flex: 1 },
  detailsContent: { position: "absolute", top: 0, left: 0, right: 0 },
});
