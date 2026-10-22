import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useSharedValue, withTiming } from "react-native-reanimated";
import MealSwipeActions, { MEAL_EFFECT_OUTSET } from "@/components/MealSwipeActions";
import Constants from "expo-constants";
import { FoodEntryItem, closeOpenMealActions } from "@/components/FoodEntryItem";
import { COLORS } from "@/constants/colors";

const fixtures = [
  { id: "calmera-swipe-matcha", foodName: "Iced Matcha With Oat Milk", calories: 180, protein: 4, carbs: 26, fat: 7, localTime: "11:40" },
  { id: "calmera-swipe-banana", foodName: "Banana · synthetic test", calories: 105, protein: 1, carbs: 27, fat: 0, localTime: "11:45" },
  { id: "calmera-swipe-bowl", foodName: "Rice Bowl · synthetic test", calories: 460, protein: 22, carbs: 62, fat: 14, localTime: "12:00" },
];
const noAction = () => {};

function GlassMotionReview() {
  const progress = useSharedValue(0);
  const [metrics, setMetrics] = useState({});
  const record = useCallback(value => setMetrics(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value), []);
  return <View style={{ flex: 1, padding: 24, paddingTop: 50, gap: 20, backgroundColor: COLORS.background }}>
    <Text style={{ fontSize: 22, color: COLORS.text }}>Native glass motion review</Text>
    <Text>Actual MealSwipeActions · controlled progress · no records or network.</Text>
    <Text>Progress: {metrics.revealProgress ?? 0} · rendered width: {metrics.renderedWidth ?? 0} · shared container: {metrics.sharedGlassContainer ?? 0}</Text>
    <View style={{ height: 70 + 2 * MEAL_EFFECT_OUTSET, flexDirection: "row", justifyContent: "flex-end" }}>
      <MealSwipeActions width={72} progress={progress} visible={false}
        onEdit={noAction} onDelete={noAction} onMetrics={record} />
    </View>
    {[0, 0.25, 0.5, 0.75, 1].map(value => <Pressable key={value} accessibilityRole="button"
      accessibilityLabel={`Set reveal ${Math.round(value * 100)} percent`}
      onPress={() => { progress.value = withTiming(value, { duration: 600 }); }}
      style={{ padding: 14, backgroundColor: "#F5F5F5", borderRadius: 16 }}>
      <Text>{Math.round(value * 100)}%</Text>
    </Pressable>)}
  </View>;
}

export default function MealSwipeCheck() {
  const { motion } = useLocalSearchParams();
  const [state, setState] = useState("closed");
  const [event, setEvent] = useState("None");
  const [offset, setOffset] = useState(0);
  const [metrics, setMetrics] = useState({});
  const [narrowDetails, setNarrowDetails] = useState(false);
  const [detailsResult, setDetailsResult] = useState("Expand the first card, then run its width reflow check.");
  const latestDetails = useRef(null);
  const detailProbe = useRef(null);
  const detailTimer = useRef(null);
  useEffect(() => () => clearTimeout(detailTimer.current), []);
  const recordDetails = useCallback(value => {
    latestDetails.current = value;
    const probe = detailProbe.current;
    if (!probe) return;
    if (probe.target == null && Math.abs(value.target - probe.oldTarget) > 0.5) {
      probe.target = value.target;
      probe.firstHeight = value.height;
    }
    if (probe.target == null) return;
    probe.samples += 1;
    if (value.height > Math.min(probe.oldHeight, probe.target) + 0.5
      && value.height < Math.max(probe.oldHeight, probe.target) - 0.5) probe.intermediate += 1;
  }, []);
  const runDetailsReflow = () => {
    if (detailProbe.current) return;
    const before = latestDetails.current;
    if (!before || before.expanded !== 1 || before.progress < 0.999 || before.height < 1) {
      setDetailsResult("Tap the first card to expand its macros, wait for it to settle, then run this check.");
      return;
    }
    closeOpenMealActions();
    const probe = { oldHeight: before.height, oldTarget: before.target, target: null,
      firstHeight: null, samples: 0, intermediate: 0, reduceMotion: before.reduceMotion };
    detailProbe.current = probe;
    setDetailsResult("Running first-card reflow: numeric UI-height samples only.");
    setNarrowDetails(value => !value);
    detailTimer.current = setTimeout(() => {
      if (detailProbe.current !== probe) return;
      detailProbe.current = null;
      const final = latestDetails.current;
      const fmt = value => value == null ? "—" : Number(value).toFixed(2);
      const settled = probe.target != null && final?.expanded === 1
        && Math.abs(final.height - probe.target) <= 0.5;
      const verdict = !settled ? "Needs review: target did not change/settle, or interaction interrupted."
        : probe.reduceMotion ? "Reduced Motion: immediate height settlement is expected."
          : probe.intermediate > 0 ? "Intermediate UI heights observed."
            : "Height snap observed: remeasure reached its new height without intermediate samples.";
      setDetailsResult(`${verdict} Old stable ${fmt(probe.oldHeight)} · target ${fmt(probe.target)} · first height ${fmt(probe.firstHeight)} · intermediate ${probe.intermediate} · samples ${probe.samples} · final ${fmt(final?.height)} pt.`);
    }, 1000);
  };
  const observedProgress = useRef(new Set());
  const recordMetrics = useCallback(value => {
    if (value.revealProgress > 0 && value.revealProgress < 1) observedProgress.current.add(value.revealProgress);
    setMetrics(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value);
  }, []);
  const markEdited = useCallback(() => setEvent("Edit callback"), []);
  const confirmDelete = useCallback(() => Alert.alert("Delete Entry", "Synthetic interaction check. No record will be deleted.", [
    { text: "Cancel", style: "cancel", onPress: () => setEvent("Delete cancelled") },
    { text: "Delete", style: "destructive", onPress: () => setEvent("Delete callback; no database mutation") },
  ]), []);
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/dashboard" />;
  if (motion === "1") return <GlassMotionReview />;
  return <ScrollView onScrollBeginDrag={closeOpenMealActions} directionalLockEnabled alwaysBounceHorizontal={false} onScroll={({ nativeEvent }) => setOffset(Math.round(nativeEvent.contentOffset.y))} scrollEventThrottle={100}
    contentContainerStyle={{ padding: 16, paddingBottom: 60, backgroundColor: COLORS.background, flexGrow: 1 }}>
    <View style={{ gap: 12, paddingVertical: 18 }}>
      <Text allowFontScaling={false} style={{ fontSize: 22, fontWeight: "600", color: COLORS.text }}>Meal swipe check</Text>
      <Text allowFontScaling={false}>Actual FoodEntryItem component · synthetic fixtures only · no database access.</Text>
      <Text allowFontScaling={false}>Swipe state: {state} · Last action: {event} · Scroll offset: {offset}</Text>
      <Text allowFontScaling={false}>Native controls: {metrics.buttonWidth ?? "—"} × {metrics.buttonHeight ?? "—"} pt · label={metrics.labelSize ?? "—"} · symbol={metrics.symbolSize ?? "—"} · glass={metrics.usesNativeGlass ?? "—"} · opaque={metrics.opaqueFallback ?? "—"} · progress={metrics.revealProgress ?? "—"} · intermediate steps={observedProgress.current.size} · assigned={metrics.materialAssignedCount ?? "—"} · visible={metrics.visibleMaterialCount ?? "—"}</Text>
      <Text allowFontScaling={false}>Drag a card left about 30 points and release. On Mac Simulator, click and hold while dragging. Tap a closed card for macros.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Run first card width reflow check"
        onPress={runDetailsReflow} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text allowFontScaling={false}>{narrowDetails ? "Restore first card to full width and measure" : "Narrow first card to 180 pt and measure"}</Text>
      </Pressable>
      <Text allowFontScaling={false} accessibilityLiveRegion="polite">{detailsResult}</Text>
    </View>
    {fixtures.map((item, index) => <View key={item.id}
      style={{ width: index === 0 && narrowDetails ? 180 : "100%", maxWidth: "100%", alignSelf: "flex-start" }}>
      <FoodEntryItem item={item} onSwipeStateChange={setState}
        onActionMetrics={index === 0 ? recordMetrics : undefined}
        onDetailsMetrics={index === 0 ? recordDetails : undefined}
        onEdit={markEdited} onDelete={confirmDelete} />
    </View>)}
    <Pressable onPress={() => setEvent("Scroll check ready")} style={{ paddingVertical: 16 }}><Text allowFontScaling={false}>Scroll test area</Text></Pressable>
    {Array.from({ length: 12 }, (_, i) => <View key={i} style={{ height: 90, padding: 24, backgroundColor: i % 2 ? "#F1E8DF" : "#F8EFE8" }}>
      <Text allowFontScaling={false}>{i === 11 ? "Last synthetic row" : `Synthetic scroll row ${i + 1}`}</Text>
    </View>)}
  </ScrollView>;
}
