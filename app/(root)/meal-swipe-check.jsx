import { useCallback, useRef, useState } from "react";
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
      <Text allowFontScaling={false}>Native controls: {metrics.buttonWidth ?? "—"} × {metrics.buttonHeight ?? "—"} pt · label={metrics.labelSize ?? "—"} · symbol={metrics.symbolSize ?? "—"} · glass={metrics.usesNativeGlass ?? "—"} · opaque={metrics.opaqueFallback ?? "—"} · progress={metrics.revealProgress ?? "—"} · intermediate steps={observedProgress.current.size}</Text>
      <Text allowFontScaling={false}>Drag a card left about 30 points and release. On Mac Simulator, click and hold while dragging. Tap a closed card for macros.</Text>
    </View>
    {fixtures.map((item, index) => <FoodEntryItem key={item.id} item={item} onSwipeStateChange={setState}
      onActionMetrics={index === 0 ? recordMetrics : undefined}
      onEdit={markEdited} onDelete={confirmDelete} />)}
    <Pressable onPress={() => setEvent("Scroll check ready")} style={{ paddingVertical: 16 }}><Text allowFontScaling={false}>Scroll test area</Text></Pressable>
    {Array.from({ length: 12 }, (_, i) => <View key={i} style={{ height: 90, padding: 24, backgroundColor: i % 2 ? "#F1E8DF" : "#F8EFE8" }}>
      <Text allowFontScaling={false}>{i === 11 ? "Last synthetic row" : `Synthetic scroll row ${i + 1}`}</Text>
    </View>)}
  </ScrollView>;
}
