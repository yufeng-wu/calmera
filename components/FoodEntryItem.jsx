import { View, Text, Pressable, StyleSheet, useWindowDimensions, AccessibilityInfo, Platform } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, useReducedMotion, ReduceMotion, useAnimatedReaction, runOnJS } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { styles } from "../assets/styles/home.styles";
import { COLORS } from "../constants/colors";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { formatTime } from "../lib/utils";
import MealSwipeActions, { MEAL_EFFECT_OUTSET, MealActionRail } from "./MealSwipeActions";
import SwipeRow from "./SwipeRow";
import { PHASE, scrollCloses } from "../lib/swipeRow.mjs";

// Only a UI controller reference is shared. Opening another row closes the old one.
let activeRow = null;
let activePhase = null;
const SPRING = { mass: 0.9, stiffness: 310, damping: 34, overshootClamping: false };
// A swipe takes over after 10 pt to the left, or 12 pt to the right on an open row.
const SWIPE_STARTS = [-10, 12];

export function closeOpenMealActions() {
  activeRow?.current?.close();
  activeRow = null;
  activePhase = null;
}

// For a page that starts to scroll. A scroll can begin under the very finger that is swiping a row open, and the
// news of it can arrive after that finger has lifted: closing then would shut the row the touch just opened.
export function closeSettledMealActions() {
  if (scrollCloses(activePhase?.current)) closeOpenMealActions();
}

export const FoodEntryItem = memo(function FoodEntryItem({ item, onDelete, onEdit, onSwipeStateChange, onActionMetrics, onDetailsMetrics, palette }) {
  const { iconFor } = useFoodIcons();
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  // The glass Delete is created at the row's first reveal, not with the row. A day's first meals arrive inside a list
  // that fades in, and a glass view created under that fade stays flat for good (bare red text): re-applying the
  // effect, or rebuilding the glass inside the same native view, doesn't bring it back. A reveal starts from a hidden
  // droplet, so the frame it takes to mount can't be seen.
  const [actionsMounted, setActionsMounted] = useState(false);
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
  const expandedNow = useRef(false);
  const animateDetails = useCallback((open, height) => {
    const timing = {
      duration: reducedMotion ? 0 : 260,
      easing: Easing.out(Easing.cubic),
      reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.System,
    };
    measuredDetailsHeight.value = height;
    // Retarget from the currently displayed pixel height. Multiplying a newly
    // measured height by an already-open progress value jumps on text reflow.
    renderedDetailsHeight.value = withTiming(open ? height : 0, timing);
    expansion.value = withTiming(open ? 1 : 0, timing);
  }, [reducedMotion, expansion, measuredDetailsHeight, renderedDetailsHeight]);
  // Only for a new measurement. A tap starts its own animation at once, without waiting on a render.
  useEffect(() => { animateDetails(expandedNow.current, detailsHeight); }, [detailsHeight, animateDetails]);
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
  const phase = useRef(PHASE.closed);
  const isOpen = useRef(false);
  const pendingEdit = useRef(null);
  const navigatingToEdit = useRef(false);
  const nativeReveal = useSharedValue(0);
  const nativeActions = Platform.OS === "ios";
  useEffect(() => {
    // A changed text size or rotation changes the action width. Close once,
    // then let the next gesture measure the new rail instead of keeping a stale offset.
    pendingEdit.current = null;
    swipeable.current?.reset();
    nativeReveal.value = 0;
    isOpen.current = false;
    phase.current = PHASE.closed;
    setActionsVisible(false);
    if (activeRow === swipeable) activeRow = null;
  }, [actionWidth, nativeReveal]);
  const { foodName = item.food_name, calories, protein, carbs, fat, localTime = item.local_time } = item;
  const macros = `Protein ${Number(protein)}g   Carbs ${Number(carbs)}g   Fat ${Number(fat)}g`;

  const close = useCallback(() => {
    swipeable.current?.close();
    if (activeRow === swipeable) activeRow = null;
  }, []);
  useFocusEffect(useCallback(() => {
    navigatingToEdit.current = false;
    return () => {
      pendingEdit.current = null;
      // Tab changes dismiss controls; reset avoids a stale open row on return.
      swipeable.current?.reset();
      nativeReveal.value = 0;
      isOpen.current = false;
      phase.current = PHASE.closed;
      setActionsVisible(false);
      if (activeRow === swipeable) activeRow = null;
    };
  }, [nativeReveal]));
  const claimRow = () => {
    if (activeRow && activeRow !== swipeable) activeRow.current?.close();
    activeRow = swipeable;
    activePhase = phase;
  };
  const revealActions = () => { setActionsMounted(true); claimRow(); swipeable.current?.open(); };
  const edit = () => {
    if (pendingEdit.current || navigatingToEdit.current) return;
    const openEditor = () => {
      if (onEdit) return onEdit(item);
      navigatingToEdit.current = true;
      try { router.push(`/edit/${item.id}`); }
      catch (error) { navigatingToEdit.current = false; throw error; }
    };
    if (isOpen.current && swipeable.current) {
      // Finish the row's close before starting the native push. Blurring the
      // list mid-spring resets its translation and flashes the action rail.
      pendingEdit.current = openEditor;
      close();
    } else openEditor();
  };
  const remove = () => { close(); onDelete?.(item.id); };
  const toggleExpand = () => {
    // The lift that ends a swipe can arrive here as a press, after the swipe has opened the row.
    if (swipeable.current && !swipeable.current.pressIsTap()) return;
    if (isOpen.current) { close(); return; }
    expandedNow.current = !expandedNow.current;
    animateDetails(expandedNow.current, detailsHeight);
    setIsExpanded(expandedNow.current);
  };
  const accessibilityAction = ({ nativeEvent: { actionName } }) => {
    if (actionName === "edit") edit();
    else if (actionName === "delete") remove();
    else if (actionName === "showActions") revealActions();
    else toggleExpand();
  };

  return <View style={swipeStyles.row}>
    {nativeActions && actionsMounted && <View pointerEvents="box-none" style={swipeStyles.actionOverlay}>
      <MealSwipeActions overlay width={actionWidth} progress={nativeReveal} visible={actionsVisible}
        onDelete={remove} onMetrics={onActionMetrics} previewPalette={palette?.id} />
    </View>}
    <SwipeRow ref={swipeable} pointerEvents="box-none" width={actionWidth + 12} threshold={22} activeOffset={SWIPE_STARTS}
      overshoot={!reducedMotion} overshootFriction={9} trackpad spring={swipeSpring}
      containerStyle={swipeStyles.swipeable}
      onStartDrag={() => { phase.current = PHASE.dragging; setActionsMounted(true); pendingEdit.current = null; claimRow(); onSwipeStateChange?.("dragging"); }}
      onWillOpen={() => {
        phase.current = PHASE.opening;
        setActionsMounted(true); claimRow(); isOpen.current = true; setActionsVisible(true);
        onSwipeStateChange?.("opening");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      }}
      onWillClose={() => { phase.current = PHASE.closing; onSwipeStateChange?.("closing"); }}
      onOpen={() => { phase.current = PHASE.open; onSwipeStateChange?.("open"); }}
      onClose={() => {
        phase.current = PHASE.closed;
        isOpen.current = false; setActionsVisible(false);
        if (activeRow === swipeable) activeRow = null;
        onSwipeStateChange?.("closed");
        const openEditor = pendingEdit.current;
        pendingEdit.current = null;
        openEditor?.();
      }}
      renderActions={(progress, translation) => nativeActions
        ? <MealActionRail translation={translation} reveal={nativeReveal} width={actionWidth + 12} />
        : <MealSwipeActions width={actionWidth} progress={progress}
          visible={actionsVisible} onDelete={remove} onMetrics={onActionMetrics} previewPalette={palette?.id} />}>
      <Pressable style={({ pressed }) => [styles.foodEntryCard, swipeStyles.card, palette && { backgroundColor: palette.card, borderColor: palette.border }, pressed && swipeStyles.pressedCard]}
        onPress={toggleExpand} onLongPress={revealActions} delayLongPress={450}
        accessibilityRole="button" accessibilityState={{ expanded: isExpanded }}
        accessibilityValue={{ text: isExpanded ? macros : "" }}
        accessibilityLabel={`${foodName}, ${parseFloat(calories).toFixed(0)} calories, ${formatTime(localTime)}`}
        accessibilityHint="Tap for nutrition details and Edit. Swipe left or hold to delete."
        accessibilityActions={[{ name: "activate", label: isExpanded ? "Hide nutrition" : "Show nutrition" },
          { name: "showActions", label: "Show delete" }, { name: "edit", label: "Edit meal" }, { name: "delete", label: "Delete meal" }]}
        onAccessibilityAction={accessibilityAction}>
        <View style={[styles.transactionContent, veryLargeText && swipeStyles.largeTextContent]}>
          <View style={[styles.categoryIconContainer, palette && { backgroundColor: palette.badge }]}>
            <Text style={{ fontSize: 25 }} allowFontScaling={false} accessible={false}>{iconFor(item).emoji}</Text>
          </View>
          <View style={[styles.transactionLeft, veryLargeText && swipeStyles.largeTextTitle]}><Text style={[styles.transactionTitle, palette && { color: palette.text }]}>{foodName}</Text></View>
          <View style={[styles.transactionRight, veryLargeText && swipeStyles.largeTextMetadata]}>
            <Text style={[styles.transactionAmount, { color: palette?.primary || COLORS.primary }]}>{parseFloat(calories).toFixed(0)} kcal</Text>
            <Text style={[styles.transactionDate, palette && { color: palette.textLight }]}>{formatTime(localTime)}</Text>
          </View>
          <View style={[styles.indicatorContainer, veryLargeText && swipeStyles.largeTextIndicator]}>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={20} color={palette?.textLight || COLORS.textLight} />
            </Animated.View>
          </View>
        </View>
        <Animated.View style={[swipeStyles.detailsClip, detailsStyle]} pointerEvents={isExpanded ? "box-none" : "none"}
          accessibilityElementsHidden={!isExpanded}
          importantForAccessibility={isExpanded ? "auto" : "no-hide-descendants"}>
          <View style={[styles.expandedContent, swipeStyles.detailsContent]}
            onLayout={({ nativeEvent }) => setDetailsHeight(previous =>
              Math.abs(previous - nativeEvent.layout.height) > 0.5 ? nativeEvent.layout.height : previous)}>
            <Text style={[styles.macrosText, swipeStyles.detailsText, palette && { color: palette.textLight }]}>{macros}</Text>
            <Pressable onPress={edit} hitSlop={14} accessibilityRole="button" accessibilityLabel="Edit meal"
              style={({ pressed }) => [swipeStyles.editButton, pressed && swipeStyles.pressedEdit]}>
              <Ionicons name="create-outline" size={15} color={palette?.textLight || COLORS.textLight} />
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </SwipeRow>
  </View>;
});

const swipeStyles = StyleSheet.create({
  row: { marginBottom: 8 },
  actionOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  swipeable: { overflow: "visible", padding: MEAL_EFFECT_OUTSET,
    marginVertical: -MEAL_EFFECT_OUTSET, marginHorizontal: -MEAL_EFFECT_OUTSET },
  card: { marginBottom: 0, minHeight: 64 },
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
  // Same height as the macros line, so the open card is no taller; hitSlop keeps it tappable.
  // As wide as the chevron's slot, so the pencil centers under it.
  editButton: { width: 20, marginLeft: 12, alignItems: "center" },
  pressedEdit: { opacity: 0.6 },
});
