import { forwardRef, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { Easing, interpolateColor, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

const COUNT_MS = 520;
const STAGGER_MS = 70;
const easeOut = progress => 1 - (1 - progress) ** 3;
const decimals = value => (String(value).split(".")[1] || "").length;

// An editable nutrient number with its unit, shared by Review and Edit Meal.
// The field spans the whole row and never resizes, so typed digits stay put; an
// invisible copy of the number sits under it only to place the unit after the last digit.
// When an estimate lands (pulse.id changes) and the value moved, the number counts from
// pulse.from to the new value while its digits glow tangerine; order staggers the tiles.
export default forwardRef(function NutrientValue({ value, unit, pulse, order = 0, style, valueStyle, unitStyle, ...inputProps }, ref) {
  const reducedMotion = useReducedMotion();
  const glow = useSharedValue(0);
  const [shown, setShown] = useState(null);
  useEffect(() => {
    const from = Number(pulse?.from);
    const to = Number(value);
    if (!pulse || pulse.from == null || pulse.from === "" || !Number.isFinite(from) || !Number.isFinite(to) || from === to) return;
    const delay = order * STAGGER_MS;
    const places = Math.max(decimals(pulse.from), decimals(value));
    const began = Date.now() + delay;
    let frame;
    // The glowing copy stays until its glow has faded, then the field returns.
    setShown(reducedMotion ? String(value) : from.toFixed(places).replace(/\.0+$/, ""));
    glow.value = withDelay(delay, withSequence(withTiming(1, { duration: 160 }),
      withDelay(reducedMotion ? 300 : COUNT_MS, withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) },
        finished => { if (finished) runOnJS(setShown)(null); }))));
    if (reducedMotion) return () => setShown(null);
    const step = () => {
      const progress = Math.min(1, Math.max(0, (Date.now() - began) / COUNT_MS));
      setShown(progress < 1 ? (from + (to - from) * easeOut(progress)).toFixed(places) : String(value));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(frame); setShown(null); };
    // Runs once per landed estimate; value is read as of that estimate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse?.id]);
  const glowStyle = useAnimatedStyle(() => ({
    color: interpolateColor(glow.value, [0, 1], [COLORS.text, COLORS.primary]),
    textShadowColor: interpolateColor(glow.value, [0, 1], ["rgba(240,140,60,0)", "rgba(240,140,60,0.55)"]),
  }));
  return <View style={style}>
    <View style={styles.row}>
      <Animated.Text style={[styles.value, valueStyle, shown != null ? [styles.glowing, glowStyle] : styles.sizer]} numberOfLines={1}
        accessible={false} importantForAccessibility="no">{shown ?? (String(value) || "0")}</Animated.Text>
      <Text style={[styles.unit, unitStyle]} accessible={false} importantForAccessibility="no">{unit}</Text>
      {shown == null && <TextInput ref={ref} value={String(value)} keyboardType="decimal-pad" placeholder="0"
        placeholderTextColor={COLORS.textLight} selectTextOnFocus maxLength={7}
        selectionColor={COLORS.primary} cursorColor={COLORS.primary} {...inputProps}
        style={[styles.value, valueStyle, styles.input]} />}
    </View>
  </View>;
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline" },
  value: { padding: 0, fontWeight: "600", fontVariant: ["tabular-nums"], color: COLORS.text },
  // Slack for the caret, so the unit never touches it.
  sizer: { opacity: 0, paddingRight: 3 },
  glowing: { paddingRight: 3, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  input: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  unit: { color: COLORS.textLight },
});
