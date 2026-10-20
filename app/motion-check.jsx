import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";
import { Redirect, useRouter } from "expo-router";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormHeader, GlassButton, FormScreen, FormScrollView } from "@/components/GlassForm";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

const NativeMenu = Platform.OS === "ios" ? requireNativeViewManager("CalmeraChatGPT", "ActionMenu") : null;
const initial = { expanded: false, recording: false, analyzing: false, seconds: 5, extraInset: 0, width: 120 };

// UI state only: no microphone, account, photo, inference or data-store imports.
export default function MotionCheck() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(initial);
  const [metrics, setMetrics] = useState({});
  const [edgeStatus, setEdgeStatus] = useState({});
  const [result, setResult] = useState("Not run");
  const timers = useRef([]);
  const scenario = useRef(false);
  const observed = useRef(false);
  const previousVoiceWidth = useRef(0);
  const latestMetrics = useRef({});
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true || !NativeMenu) return <Redirect href="/" />;
  const baseline = 64 + insets.bottom;
  const run = () => {
    clear(); scenario.current = true; observed.current = false; previousVoiceWidth.current = 0;
    setResult("Running synthetic hold → inset/width change → Processing… → Add");
    setMenu({ ...initial, expanded: true, recording: true });
    timers.current.push(setTimeout(() => setMenu(value => ({ ...value, extraInset: 64, width: 148, seconds: 6 })), 900));
    timers.current.push(setTimeout(() => setMenu(value => ({ ...value, recording: false, analyzing: true })), 2400));
    timers.current.push(setTimeout(() => setMenu(value => ({ ...value, analyzing: false, expanded: false })), 5000));
    timers.current.push(setTimeout(() => { scenario.current = false; const final = latestMetrics.current;
      const completed = observed.current && final.addTitleVisible === 1 && final.processing === 0
        && final.menuExpanded === 0 && final.missingMaterials === 0 && final.voiceReturnBadSamples === 0
        && final.settledGeneration === final.animationGeneration;
      setResult(completed
        ? "Passed: recording geometry survived layout changes; Processing and Add settled correctly."
        : "Needs review: layout continuity or final animation settlement did not pass."); }, 5900));
  };
  const report = ({ nativeEvent: value }) => {
    latestMetrics.current = value;
    setMetrics(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value);
    if (scenario.current && value.menuBottomInset === baseline && value.menuOptionWidth === 120) previousVoiceWidth.current = value.voice;
    if (scenario.current && value.menuBottomInset === baseline + 64 && value.menuOptionWidth === 148
      && (value.voiceGrowing === 1 || value.reduceMotion === 1) && value.voice >= previousVoiceWidth.current && value.missingMaterials === 0) observed.current = true;
  };
  const action = ({ nativeEvent: { action: name } }) => {
    if (name === "toggle") setMenu(value => ({ ...value, expanded: !value.expanded }));
    if (name === "close") setMenu(value => ({ ...value, expanded: false }));
  };
  return <FormScreen style={styles.page} onEdgeStatus={({ nativeEvent }) => setEdgeStatus(nativeEvent)}>
    <FormHeader title="Motion check" onBack={() => router.replace("/ui-gallery")} />
    <FormScrollView contentContainerStyle={styles.content}>
      <Text style={styles.caption}>Native header edge: bound {edgeStatus.bound || 0} · overlap {Math.round(edgeStatus.overlap || 0)} pt</Text>
      <Text style={styles.body}>Actual native Add menu. All recording and processing states are synthetic.</Text>
      <GlassButton title="Run recording layout check" onPress={run} />
      <GlassButton title="Toggle collapsed inset" onPress={() => { clear(); scenario.current = false; setMenu(value => ({ ...initial, extraInset: value.extraInset ? 0 : 64 })); }} />
      <Text accessibilityLiveRegion="polite" style={styles.body}>{result}</Text>
      <Text style={styles.caption}>Inset {metrics.menuBottomInset} · width {metrics.menuOptionWidth} · trigger top {Math.round(metrics.triggerTop || 0)}</Text>
      <Text style={styles.caption}>Growing {metrics.voiceGrowing || 0} · processing {metrics.processing || 0} · title {metrics.addTitleVisible || 0}</Text>
      <Text style={styles.caption}>Missing materials {metrics.missingMaterials || 0} · clipped {metrics.clippedSurfaces || 0} · assignments {metrics.triggerMaterialAssignments || 0}</Text>
      <Text style={styles.caption}>Voice return: {metrics.voiceReturnSamples || 0} frames · bad {metrics.voiceReturnBadSamples || 0} · drift {Number(metrics.voiceReturnMaxAnchorError || 0).toFixed(2)} pt</Text>
      <Text style={styles.caption}>Reduce Motion {metrics.reduceMotion || 0}. Geometry must stay anchored as layout changes.</Text>
    </FormScrollView>
    <NativeMenu style={StyleSheet.absoluteFill} expanded={menu.expanded} recording={menu.recording} analyzing={menu.analyzing}
      seconds={menu.seconds} bottomInset={baseline + menu.extraInset} optionWidth={menu.width}
      motionDiagnostics onAction={action} onMetrics={report} />
  </FormScreen>;
}
const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 20, gap: 14, paddingBottom: 380 },
  body: { ...TYPOGRAPHY.body, color: COLORS.text }, caption: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
});
