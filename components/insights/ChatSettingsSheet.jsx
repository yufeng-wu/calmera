import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import GlassSurface from "@/components/GlassSurface";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { EFFORTS } from "@/lib/insights/harness.mjs";
import { PressScale } from "./NativeControls";

const LEVELS = Object.keys(EFFORTS);
const TRACK = 264, KNOB = 40, PAD = 6;
const stop = (index) => PAD + index * ((TRACK - KNOB - PAD * 2) / (LEVELS.length - 1));
const SPRING = { damping: 17, stiffness: 220 };

// Thinking level as a sliding switch, like ChatGPT's effort control.
function EffortSlider({ value, onChange }) {
  const index = Math.max(0, LEVELS.indexOf(value));
  const x = useSharedValue(stop(index));
  useEffect(() => { x.value = withSpring(stop(index), SPRING); }, [index, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fill = useAnimatedStyle(() => ({ width: x.value + KNOB + PAD }));
  return <View>
    <Text style={styles.effortLabel}>{EFFORTS[value] || EFFORTS.medium}</Text>
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fill]} />
      {LEVELS.map((level, position) => <Pressable key={level} accessibilityRole="button" accessibilityLabel={`${EFFORTS[level]} thinking`}
        accessibilityState={{ selected: position === index }} onPress={() => onChange(level)}
        style={[styles.stop, { left: stop(position) }]}>
        <View style={[styles.dot, position <= index && styles.dotOn]} />
      </Pressable>)}
      <Animated.View pointerEvents="none" style={[styles.knob, knob]} />
    </View>
    <View style={styles.stopLabels}>
      {LEVELS.map((level) => <Text key={level} style={styles.stopLabel}>{EFFORTS[level]}</Text>)}
    </View>
  </View>;
}

// One place for the model and how hard it thinks. Opens as a glass sheet.
export default function ChatSettingsSheet({ visible, onClose, prefs, savePrefs, loadModels }) {
  const [catalog, setCatalog] = useState({ models: [], current: null });
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Header and slider take ~290pt; the model list scrolls within what's left.
  const listHeight = Math.max(120, Math.min(236, height * 0.82 - 290 - insets.top - insets.bottom));
  useEffect(() => { if (visible) loadModels?.().then(setCatalog).catch(() => {}); }, [visible, loadModels, prefs.chatModel]);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
    {visible && <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill}>
        <Pressable accessibilityLabel="Close" style={styles.scrim} onPress={onClose} />
      </Animated.View>
      <Animated.View entering={SlideInDown.springify().damping(19).stiffness(180)} exiting={SlideOutDown.duration(180)} style={[styles.sheet, { marginBottom: insets.bottom + 8 }]}>
        <GlassSurface style={styles.glass} />
        <View style={styles.grabber} />
        <Text style={styles.heading}>Thinking</Text>
        <EffortSlider value={prefs.effort} onChange={(effort) => savePrefs({ effort })} />
        <Text style={[styles.heading, styles.spaced]}>Model</Text>
        <ScrollView style={[styles.models, { maxHeight: listHeight }]} contentContainerStyle={styles.modelList}>
          {catalog.models.length ? catalog.models.map((model) => {
            const selected = model.slug === catalog.current;
            return <PressScale key={model.slug} accessibilityRole="radio" accessibilityState={{ checked: selected }} scaleTo={0.98}
              onPress={() => savePrefs({ chatModel: model.slug })} style={[styles.model, selected && styles.modelSelected]}>
              <Text style={[styles.modelName, selected && styles.modelNameSelected]}>{model.display_name || model.slug}</Text>
              {selected && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
            </PressScale>;
          }) : <Text style={styles.empty}>Connect ChatGPT in Settings to choose a model.</Text>}
        </ScrollView>
      </Animated.View>
    </View>}
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { flex: 1, backgroundColor: "rgba(40,28,20,0.18)" },
  sheet: { marginHorizontal: 10, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 18, borderRadius: 32 },
  glass: { borderRadius: 32 },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: "rgba(74,52,40,0.18)", marginBottom: 14 },
  heading: { ...TYPOGRAPHY.eyebrow, color: COLORS.textLight, marginBottom: 8 },
  spaced: { marginTop: 22 },
  effortLabel: { fontSize: 22, fontWeight: "700", color: COLORS.text, textAlign: "center", marginBottom: 12 },
  track: { width: TRACK, height: KNOB + PAD * 2, borderRadius: (KNOB + PAD * 2) / 2, alignSelf: "center", backgroundColor: "rgba(74,52,40,0.08)", overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: (KNOB + PAD * 2) / 2, backgroundColor: COLORS.primary },
  stop: { position: "absolute", top: PAD, width: KNOB, height: KNOB, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(74,52,40,0.28)" },
  dotOn: { backgroundColor: "rgba(255,255,255,0.7)" },
  knob: { position: "absolute", top: PAD, left: 0, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: "#FFFFFF",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  stopLabels: { width: TRACK, alignSelf: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingHorizontal: 4 },
  stopLabel: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  models: { flexGrow: 0 },
  modelList: { gap: 6 },
  model: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.55)" },
  modelSelected: { backgroundColor: "rgba(255,255,255,0.95)" },
  modelName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  modelNameSelected: { fontWeight: "600" },
  empty: { ...TYPOGRAPHY.body, color: COLORS.textLight },
});
