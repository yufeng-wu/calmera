import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Redirect } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SystemTabsInteractionCheck } from "@/components/SystemTabBar";
import { COLORS } from "@/constants/colors";
import AddMealMenu, { ADD_MENU_OPTION_WIDTH } from "@/components/AddMealMenu";

export default function NativeTabsCheck() {
  const [selected, setSelected] = useState(1);
  const [changes, setChanges] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [offset, setOffset] = useState(0);
  const [optionWidths, setOptionWidths] = useState({});
  const [optionSpacing, setOptionSpacing] = useState({});
  const [voiceEvents, setVoiceEvents] = useState("");
  const [mockRecording, setMockRecording] = useState(false);
  const [mockProcessing, setMockProcessing] = useState(false);
  const [menuMetrics, setMenuMetrics] = useState({});
  const mockTimer = useRef(null);
  const stressTimers = useRef([]);
  const [stress, setStress] = useState("Not run");
  const [whiteBackdrop, setWhiteBackdrop] = useState(true);
  useEffect(() => () => {
    clearTimeout(mockTimer.current);
    stressTimers.current.forEach(clearTimeout);
  }, []);
  const runStress = () => {
    stressTimers.current.forEach(clearTimeout);
    setStress("Running 20 interrupted open/close cycles…");
    for (let step = 0; step < 40; step += 1) {
      stressTimers.current.push(setTimeout(() => setExpanded(step % 2 === 0), step * 90));
    }
    stressTimers.current.push(setTimeout(() => setExpanded(true), 4200));
    stressTimers.current.push(setTimeout(() => setStress("20 cycles complete · ends open"), 4900));
  };
  const [showBar, setShowBar] = useState(true);
  const [touches, setTouches] = useState(0);
  const [moves, setMoves] = useState(0);
  const scroll = useRef(null);
  const insets = useSafeAreaInsets();
  const barHeight = 64 + insets.bottom;
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/" />;
  return <View style={{ flex: 1, backgroundColor: COLORS.background }}>
    <ScrollView ref={scroll} onTouchStart={() => setTouches((value) => value + 1)} onTouchMove={() => setMoves((value) => value + 1)} style={{ flex: 1 }} onScroll={({ nativeEvent }) => setOffset(Math.round(nativeEvent.contentOffset.y))} scrollEventThrottle={100} contentContainerStyle={{ paddingBottom: barHeight + 116 }} scrollIndicatorInsets={{ bottom: barHeight }}>
      <View style={{ padding: 24, gap: 12 }}>
        <Text style={{ color: COLORS.text, fontSize: 20 }}>Native tab layout check</Text>
        <Text>Selected: {["Today", "Settings"][selected]} · Events: {changes}</Text>
        <Text>No account data is loaded.</Text>
        <Text>Menu widths: photo={optionWidths.photo ?? "—"} text={optionWidths.text ?? "—"} voice={optionWidths.voice ?? "—"}</Text>
        <Text>Spacing: {JSON.stringify(optionSpacing)}</Text>
        <Text>Voice events: {voiceEvents}</Text>
        <Text>Menu state: processing={menuMetrics.processing ?? 0} addTitleVisible={menuMetrics.addTitleVisible ?? 0}</Text>
        <Text>Glass: native trigger={menuMetrics.triggerNativeGlass ?? 0} · visible={menuMetrics.visibleSurfaces ?? 0} · missing={menuMetrics.missingMaterials ?? 0} · non-glass={menuMetrics.nonGlassMaterials ?? 0}</Text>
        <Text>Clipping: surfaces={menuMetrics.clippedSurfaces ?? 0} · host={menuMetrics.effectHostClipped ?? 0} · trigger material assignments={menuMetrics.triggerMaterialAssignments ?? 0}</Text>
        <Text>Animation: {menuMetrics.settledGeneration ?? 0}/{menuMetrics.animationGeneration ?? 0} settled · trigger {Number(menuMetrics.triggerWidth ?? 0).toFixed(0)}×{Number(menuMetrics.triggerHeight ?? 0).toFixed(0)}</Text>
        <Text>Stress: {stress}</Text>
        <Text>Voice return: samples={menuMetrics.voiceReturnSamples ?? 0} · bad frames={menuMetrics.voiceReturnBadSamples ?? 0} · max anchor drift={Number(menuMetrics.voiceReturnMaxAnchorError ?? 0).toFixed(2)} pt · start width={Number(menuMetrics.voiceReturnStartWidth ?? 0).toFixed(1)} pt</Text>
        <Text>Scroll offset: {offset} · Touches: {touches} · Moves: {moves}</Text>
        <Pressable accessibilityRole="button" onPress={runStress} style={{ padding: 12 }}><Text>Stress menu: 20 cycles</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setWhiteBackdrop(value => !value)} style={{ padding: 12 }}><Text>Backdrop: {whiteBackdrop ? "white" : "content"}</Text></Pressable>
        <Pressable onPress={() => setShowBar(!showBar)} style={{ padding: 12 }}><Text>Toggle native bar: {showBar ? "visible" : "hidden"}</Text></Pressable>
        <Pressable onPress={() => scroll.current?.scrollToEnd({ animated: false })} style={{ padding: 12 }}><Text>Check last row</Text></Pressable>
      </View>
      {Array.from({ length: 12 }, (_, index) => <View key={index} style={{ minHeight: 100, padding: 24, backgroundColor: whiteBackdrop ? "#FFFFFF" : index % 2 ? "#E8EDE4" : "#EFE0D4", borderBottomWidth: 1, borderColor: "#FFFFFF" }}>
        {!whiteBackdrop && <>
          <Text style={{ fontSize: 18, color: COLORS.text }}>{index === 11 ? "LAST ROW — fully reachable" : `Layout test row ${index + 1}`}</Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: COLORS.text }}>Synthetic content behind native glass. Meal details · 450 kcal · protein 20 g · text stays scrollable beneath the floating controls.</Text>
        </>}
      </View>)}
    </ScrollView>
    <AddMealMenu bottomInset={barHeight} expanded={expanded} onToggle={() => setExpanded(!expanded)} onClose={() => setExpanded(false)}
      onText={() => {}} onPhoto={() => {}} onVoicePress={() => setVoiceEvents((value) => value + " tap")} onVoiceLongPress={() => { setVoiceEvents((value) => value + " start"); setMockRecording(true); }}
      onVoicePressOut={() => {
        setVoiceEvents((value) => value + " end"); setMockRecording(false); setMockProcessing(true);
        clearTimeout(mockTimer.current);
        mockTimer.current = setTimeout(() => { setMockProcessing(false); setExpanded(false); }, 4000);
      }}
      recording={mockRecording} analyzing={mockProcessing} voiceWidth={ADD_MENU_OPTION_WIDTH} seconds={7}
      onMenuMetrics={(next) => setMenuMetrics((previous) => previous.processing === next.processing && previous.addTitleVisible === next.addTitleVisible && previous.voiceReturnSamples === next.voiceReturnSamples && previous.animationGeneration === next.animationGeneration && previous.settledGeneration === next.settledGeneration ? previous : next)}
      onOptionSpacing={(name, left, right) => {
        const spacing = [Math.round(left * 10) / 10, Math.round(right * 10) / 10];
        setOptionSpacing(previous => previous[name]?.[0] === spacing[0] && previous[name]?.[1] === spacing[1]
          ? previous : { ...previous, [name]: spacing });
      }}
      onOptionLayout={(name, width) => setOptionWidths((previous) => previous[name] === width ? previous : { ...previous, [name]: width })} />
    {showBar && <SystemTabsInteractionCheck selectedIndex={selected} bottomInset={insets.bottom}
      style={{ position: "absolute", bottom: 0 }}
      onSelect={({ nativeEvent }) => { setSelected(nativeEvent.index); setChanges((value) => value + 1); }} />}
  </View>;
}
