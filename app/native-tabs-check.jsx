import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Redirect } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SystemTabsInteractionCheck } from "@/components/SystemTabBar";
import { COLORS } from "@/constants/colors";
import AddMealMenu, { ADD_MENU_OPTION_WIDTH } from "@/components/AddMealMenu";

export default function NativeTabsCheck() {
  const [selected, setSelected] = useState(2);
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
        <Text>Selected: {["Today", "History", "Settings"][selected]} · Events: {changes}</Text>
        <Text>No account data is loaded.</Text>
        <Text>Menu widths: photo={optionWidths.photo ?? "—"} text={optionWidths.text ?? "—"} voice={optionWidths.voice ?? "—"}</Text>
        <Text>Spacing: {JSON.stringify(optionSpacing)}</Text>
        <Text>Voice events: {voiceEvents}</Text>
        <Text>Menu state: processing={menuMetrics.processing ?? 0} addTitleVisible={menuMetrics.addTitleVisible ?? 0}</Text>
        <Text>Voice return: samples={menuMetrics.voiceReturnSamples ?? 0} · bad frames={menuMetrics.voiceReturnBadSamples ?? 0} · max anchor drift={Number(menuMetrics.voiceReturnMaxAnchorError ?? 0).toFixed(2)} pt · start width={Number(menuMetrics.voiceReturnStartWidth ?? 0).toFixed(1)} pt</Text>
        <Text>Scroll offset: {offset} · Touches: {touches} · Moves: {moves}</Text>
        <Pressable onPress={() => setShowBar(!showBar)} style={{ padding: 12 }}><Text>Toggle native bar: {showBar ? "visible" : "hidden"}</Text></Pressable>
        <Pressable onPress={() => scroll.current?.scrollToEnd({ animated: false })} style={{ padding: 12 }}><Text>Check last row</Text></Pressable>
      </View>
      {Array.from({ length: 12 }, (_, index) => <View key={index} style={{ minHeight: 100, padding: 24, backgroundColor: index % 2 ? "#E8EDE4" : "#EFE0D4", borderBottomWidth: 1, borderColor: "#FFFFFF" }}>
        <Text style={{ fontSize: 18, color: COLORS.text }}>{index === 11 ? "LAST ROW — fully reachable" : `Layout test row ${index + 1}`}</Text>
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
      onMenuMetrics={(next) => setMenuMetrics((previous) => previous.processing === next.processing && previous.addTitleVisible === next.addTitleVisible && previous.voiceReturnSamples === next.voiceReturnSamples ? previous : next)}
      onOptionSpacing={(name, left, right) => setOptionSpacing((previous) => previous[name]?.[0] === left && previous[name]?.[1] === right ? previous : { ...previous, [name]: [left, right] })}
      onOptionLayout={(name, width) => setOptionWidths((previous) => previous[name] === width ? previous : { ...previous, [name]: width })} />
    {showBar && <SystemTabsInteractionCheck selectedIndex={selected} bottomInset={insets.bottom}
      style={{ position: "absolute", bottom: 0 }}
      onSelect={({ nativeEvent }) => { setSelected(nativeEvent.index); setChanges((value) => value + 1); }} />}
  </View>;
}
