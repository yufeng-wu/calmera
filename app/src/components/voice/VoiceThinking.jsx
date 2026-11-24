import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import CitrusBuddy, { BUDDY_SIZE } from "@/components/brand/CitrusBuddy";
import { Ionicons } from "@expo/vector-icons";
import { modelChipLabel } from "@/lib/meals/mealLogPresentation.mjs";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { VOICE_STEPS, stageCopy, voiceStep } from "@/lib/voice/voiceLog.mjs";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 136;
const STROKE = 5;
const RADIUS = (RING - STROKE) / 2 - 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TANGERINE = "#E87524";
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

// While ChatGPT works, the orange waits inside its rind, drawn as one travelling arc (Orbit).
// When the estimate lands the arc closes into a full ring, the orange breathes once and a halo
// leaves it (the Done beat). Stage copy names the model doing the work.
export default function VoiceThinking({ stage, model, provider, transcript, done }) {
  const reducedMotion = useReducedMotion();
  const spin = useSharedValue(0);
  const arc = useSharedValue(0.26);
  const breath = useSharedValue(1);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || done) return undefined;
    spin.value = withRepeat(withTiming(spin.value + 360, { duration: 1300, easing: Easing.linear }), -1, false);
    // The arc lengthens and shortens as it travels, like a rind being peeled round.
    arc.value = withRepeat(withSequence(withTiming(0.42, { duration: 900, easing: EASE }), withTiming(0.22, { duration: 900, easing: EASE })), -1, false);
    return () => { cancelAnimation(spin); cancelAnimation(arc); };
  }, [reducedMotion, done, spin, arc]);

  useEffect(() => {
    if (!done) return;
    cancelAnimation(spin);
    cancelAnimation(arc);
    arc.value = reducedMotion ? 1 : withTiming(1, { duration: 420, easing: EASE });
    if (reducedMotion) return;
    breath.value = withDelay(380, withSequence(withTiming(1.08, { duration: 200, easing: EASE }), withTiming(1, { duration: 320, easing: EASE })));
    halo.value = withDelay(420, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [done, reducedMotion, spin, arc, breath, halo]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value - 90}deg` }] }));
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - arc.value) }));
  const buddyStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - halo.value), transform: [{ scale: 1 + 0.4 * halo.value }] }));

  const current = done ? "completed" : stage;
  const copy = stageCopy(current, model || "the AI");
  const step = voiceStep(current, done);
  return <View style={styles.wrap} accessibilityLiveRegion="polite" accessibilityLabel={`${copy.title}. ${copy.detail}`}>
    {/* Held invisible until the connection is known, so a Claude key never flashes ChatGPT. */}
    <View style={[styles.chip, !model && styles.chipPending]}>
      <Ionicons name="sparkles" size={15} color="#D9772B" />
      <Text style={styles.chipText} numberOfLines={1}>{modelChipLabel(provider, model)}</Text>
    </View>
    <View style={styles.stage}>
      <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
      <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke="#F3E2D4" strokeWidth={STROKE} fill="none" />
          <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke={TANGERINE} strokeWidth={STROKE} fill="none"
            strokeLinecap="round" strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`} animatedProps={arcProps} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.buddy, buddyStyle]}>
        <CitrusBuddy mood={done ? "happy" : "awake"} arrive={!reducedMotion} />
      </Animated.View>
    </View>
    <Animated.View key={current} entering={reducedMotion ? undefined : FadeInDown.duration(260).easing(EASE).withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })}
      exiting={reducedMotion ? undefined : FadeOut.duration(120)} style={styles.copy}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.detail}>{copy.detail}</Text>
    </Animated.View>
    <View style={styles.steps} accessible={false}>
      {VOICE_STEPS.map((label, index) => <View key={label} style={styles.step}>
        <View style={[styles.track, index < step && styles.trackDone]}>
          {index === step && !done && <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(200)} style={styles.trackActive} />}
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.stepLabel, index <= step && styles.stepLabelOn]}>{label}</Text>
      </View>)}
    </View>
    {!!transcript && <Text style={styles.quote} numberOfLines={2}>“{transcript}”</Text>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 24 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 8, paddingRight: 12, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.72)" },
  chipPending: { opacity: 0 },
  chipText: { ...TYPOGRAPHY.captionMedium, color: COLORS.text },
  stage: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: RING - 8, height: RING - 8, borderRadius: RING, borderWidth: 3, borderColor: TANGERINE },
  buddy: { width: BUDDY_SIZE, height: BUDDY_SIZE },
  copy: { alignItems: "center", gap: 2, minHeight: 46 },
  title: { ...TYPOGRAPHY.sectionTitle, fontSize: 18, lineHeight: 24, color: COLORS.text, textAlign: "center" },
  detail: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  steps: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
  step: { flex: 1, gap: 6, alignItems: "center" },
  track: { height: 4, borderRadius: 2, alignSelf: "stretch", backgroundColor: "#EADBCF", overflow: "hidden" },
  trackDone: { backgroundColor: TANGERINE },
  trackActive: { ...StyleSheet.absoluteFillObject, width: "55%", borderRadius: 2, backgroundColor: "#F3A66A" },
  stepLabel: { fontSize: 11, lineHeight: 14, fontWeight: "500", color: "#B8A496" },
  stepLabelOn: { color: COLORS.text },
  quote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center", fontStyle: "italic", marginTop: 4 },
});
