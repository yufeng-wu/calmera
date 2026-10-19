import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect } from "expo-router";
import Constants from "expo-constants";
import { FoodEntryItem, closeOpenMealActions } from "@/components/FoodEntryItem";
import { COLORS } from "@/constants/colors";

const fixtures = [
  { id: "calmera-swipe-matcha", foodName: "Iced Matcha With Oat Milk", calories: 180, protein: 4, carbs: 26, fat: 7, localTime: "11:40" },
  { id: "calmera-swipe-banana", foodName: "Banana · synthetic test", calories: 105, protein: 1, carbs: 27, fat: 0, localTime: "11:45" },
  { id: "calmera-swipe-bowl", foodName: "Rice Bowl · synthetic test", calories: 460, protein: 22, carbs: 62, fat: 14, localTime: "12:00" },
];
export default function MealSwipeCheck() {
  const [state, setState] = useState("closed");
  const [event, setEvent] = useState("None");
  const [offset, setOffset] = useState(0);
  const [metrics, setMetrics] = useState({});
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/dashboard" />;
  return <ScrollView onScrollBeginDrag={closeOpenMealActions} directionalLockEnabled alwaysBounceHorizontal={false} onScroll={({ nativeEvent }) => setOffset(Math.round(nativeEvent.contentOffset.y))} scrollEventThrottle={100}
    contentContainerStyle={{ padding: 16, paddingBottom: 60, backgroundColor: COLORS.background, flexGrow: 1 }}>
    <View style={{ gap: 12, paddingVertical: 18 }}>
      <Text allowFontScaling={false} style={{ fontSize: 22, fontWeight: "600", color: COLORS.text }}>Meal swipe check</Text>
      <Text allowFontScaling={false}>Actual FoodEntryItem component · synthetic fixtures only · no database access.</Text>
      <Text allowFontScaling={false}>Swipe state: {state} · Last action: {event} · Scroll offset: {offset}</Text>
      <Text allowFontScaling={false}>Native controls: {metrics.buttonWidth ?? "—"} × {metrics.buttonHeight ?? "—"} pt · label={metrics.labelSize ?? "—"} · symbol={metrics.symbolSize ?? "—"} · glass={metrics.usesNativeGlass ?? "—"} · opaque={metrics.opaqueFallback ?? "—"}</Text>
      <Text allowFontScaling={false}>Drag a card left about 30 points and release. On Mac Simulator, click and hold while dragging. Tap a closed card for macros.</Text>
    </View>
    {fixtures.map(item => <FoodEntryItem key={item.id} item={item} onSwipeStateChange={setState}
      onActionMetrics={value => setMetrics(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value)}
      onEdit={() => setEvent("Edit callback")}
      onDelete={() => Alert.alert("Delete Entry", "Synthetic interaction check. No record will be deleted.", [
        { text: "Cancel", style: "cancel", onPress: () => setEvent("Delete cancelled") },
        { text: "Delete", style: "destructive", onPress: () => setEvent("Delete callback; no database mutation") },
      ])} />)}
    <Pressable onPress={() => setEvent("Scroll check ready")} style={{ paddingVertical: 16 }}><Text allowFontScaling={false}>Scroll test area</Text></Pressable>
    {Array.from({ length: 12 }, (_, i) => <View key={i} style={{ height: 90, padding: 24, backgroundColor: i % 2 ? "#F1E8DF" : "#F8EFE8" }}>
      <Text allowFontScaling={false}>{i === 11 ? "Last synthetic row" : `Synthetic scroll row ${i + 1}`}</Text>
    </View>)}
  </ScrollView>;
}
