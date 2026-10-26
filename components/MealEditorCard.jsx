import { useEffect, useRef, useState } from "react";
import Animated, { Easing, interpolateColor, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassButton } from "@/components/GlassForm";
import SegmentedControl from "@/components/SegmentedControl";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { SURFACES } from "@/constants/surfaces";
import { TYPOGRAPHY } from "@/constants/typography";
import { MEAL_TYPES } from "@/lib/mealReview.mjs";

const NUTRIENTS = [["Calories", "calories", "kcal"], ["Protein", "protein", "g"], ["Carbs", "carbs", "g"], ["Fat", "fat", "g"]];
const TILE = "#F6F1EC";
// SF Symbols for each meal, in MEAL_TYPES order.
const MEAL_SYMBOLS = ["sunrise.fill", "sun.max.fill", "moon.stars.fill", "cup.and.saucer.fill"];

// The edit page holds a single food, so it uses Review's pieces (emoji tile, Name/Amount
// group, nutrient tiles, Re-estimate + Delete) at a roomier scale than Review's compact rows.
export default function MealEditorCard({ values, onChange, icon, onChangeIcon, mealType, setMealType,
  onEstimate, estimating = false, estimateDisabled = false, estimatePulse, onDelete, deleting = false, busy = false }) {
  const { fontScale } = useWindowDimensions();
  const large = fontScale >= 1.5;
  const [focused, setFocused] = useState(null);
  const inputs = useRef({});
  const locked = busy || estimating;
  const labelWidth = { width: 72 * Math.min(fontScale, 1.3) };

  const textField = (key, label, placeholder, next) => <Pressable accessible={false} onPress={() => inputs.current[key]?.focus()}
    style={[styles.fieldRow, large && styles.fieldRowStacked]}>
    <Text style={[styles.fieldLabel, large ? styles.fieldLabelStacked : labelWidth]}>{label}</Text>
    <TextInput ref={ref => { inputs.current[key] = ref; }} accessibilityLabel={label} placeholder={placeholder}
      placeholderTextColor={COLORS.textLight} value={values[key]} onChangeText={text => onChange(key, text)}
      editable={!locked} maxLength={255} multiline scrollEnabled={false} submitBehavior="blurAndSubmit"
      returnKeyType={next ? "next" : "done"} onSubmitEditing={() => next ? inputs.current[next]?.focus() : Keyboard.dismiss()}
      selectionColor={COLORS.primary} cursorColor={COLORS.primary} style={[styles.input, large && styles.inputStacked]} />
  </Pressable>;

  return <View style={styles.container}>
    <SegmentedControl options={MEAL_TYPES} symbols={MEAL_SYMBOLS} value={mealType} onChange={setMealType} disabled={locked} accessibilityLabel="Meal" />

    <View style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Change icon for ${values.foodName || "this food"}`}
          accessibilityValue={{ text: icon.label }} disabled={locked} onPress={() => { Keyboard.dismiss(); onChangeIcon(); }}
          style={({ pressed }) => [styles.emojiTile, pressed && styles.emojiPressed]}>
          <Text style={styles.emoji} allowFontScaling={false}>{icon.emoji}</Text>
          <View style={styles.emojiBadge} accessible={false}><Ionicons name="pencil" size={12} color={COLORS.white} /></View>
        </Pressable>

        <View style={styles.fieldGroup}>
          {textField("foodName", "Name", "What did you eat?", "quantity")}
          <View style={styles.fieldDivider} />
          {textField("quantity", "Amount", "e.g. 1 bowl")}
        </View>

        <View style={styles.grid}>{NUTRIENTS.map(([label, key, unit], index) =>
          <NutrientTile key={key} label={label} unit={unit} value={values[key]} order={index} pulse={estimatePulse}
            focused={focused === key} stacked={large} editable={!locked} inputRef={ref => { inputs.current[key] = ref; }}
            onPress={() => inputs.current[key]?.focus()} onChangeText={text => onChange(key, text)}
            onFocus={() => setFocused(key)} onBlur={() => setFocused(current => current === key ? null : current)} />)}</View>

        <View style={styles.actions}>
          <GlassButton title={estimating ? "Estimating…" : "Re-estimate"} symbol="sparkles" loading={estimating}
            disabled={busy || estimateDisabled} onPress={() => { Keyboard.dismiss(); onEstimate(); }} style={styles.reestimate} />
          <GlassButton symbol="trash" role="destructive" accessibilityLabel="Delete meal" onPress={onDelete}
            disabled={locked} loading={deleting} style={styles.remove} />
        </View>
    </View>
  </View>;
}

const COUNT_MS = 520;
const STAGGER_MS = 70;
const easeOut = progress => 1 - (1 - progress) ** 3;
const decimals = value => (String(value).split(".")[1] || "").length;

// When an estimate lands (pulse changes), a tile whose value moved counts from its
// old number to the new one while the digits glow tangerine, one tile after another.
function NutrientTile({ label, unit, value, order, pulse, focused, stacked, editable, inputRef, onPress, onChangeText, onFocus, onBlur }) {
  const reducedMotion = useReducedMotion();
  const glow = useSharedValue(0);
  const [shown, setShown] = useState(null);
  useEffect(() => {
    const from = Number(pulse?.from?.[pulseKey(label)]);
    const to = Number(value);
    if (!pulse || !Number.isFinite(from) || !Number.isFinite(to) || from === to) return;
    const delay = order * STAGGER_MS;
    const places = Math.max(decimals(pulse.from[pulseKey(label)]), decimals(value));
    const began = Date.now() + delay;
    let frame;
    // The glowing copy stays until its glow has faded, then the field returns.
    setShown(reducedMotion ? String(value) : from.toFixed(places).replace(/\.0+$/, ""));
    glow.value = withDelay(delay, withSequence(withTiming(1, { duration: 160 }),
      withDelay(reducedMotion ? 300 : COUNT_MS, withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) },
        finished => { if (finished) runOnJS(setShown)(null); }))));
    if (reducedMotion) return;
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
  return <Pressable accessible={false} onPress={onPress}
    style={[styles.tile, stacked && styles.tileStacked, focused && styles.focusedTile]}>
    <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
    {/* The field spans the whole row and never resizes, so typed digits stay put. An invisible
        copy of the number sits under it only to place the unit right after the last digit. */}
    <View style={styles.valueRow}>
      <Animated.Text style={[styles.value, shown != null ? [styles.glowing, glowStyle] : styles.sizer]} numberOfLines={1}
        accessible={false} importantForAccessibility="no">{shown ?? (String(value) || "0")}</Animated.Text>
      <Text style={styles.unit} accessible={false} importantForAccessibility="no">{unit}</Text>
      {shown == null && <TextInput ref={inputRef} accessibilityLabel={`${label}, ${unit === "g" ? "grams" : "kilocalories"}`}
        value={String(value)} onChangeText={onChangeText} editable={editable} keyboardType="decimal-pad"
        placeholder="0" placeholderTextColor={COLORS.textLight} selectTextOnFocus maxLength={7}
        selectionColor={COLORS.primary} cursorColor={COLORS.primary} onFocus={onFocus} onBlur={onBlur}
        style={[styles.value, styles.valueInput]} />}
    </View>
  </Pressable>;
}
const pulseKey = label => label.toLowerCase();

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 20 },
  card: { borderRadius: 28, backgroundColor: SURFACES.content, ...SURFACES.edge, padding: 20, paddingTop: 24, gap: 20 },
  emojiTile: { alignSelf: "center", width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: TILE },
  emojiPressed: { backgroundColor: "#EDE3DA" },
  emoji: { fontSize: 48, lineHeight: 58, textAlign: "center" },
  emojiBadge: { position: "absolute", right: -4, bottom: -4, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.primary, borderWidth: 2.5, borderColor: SURFACES.content },
  fieldGroup: { borderRadius: 18, backgroundColor: TILE, paddingHorizontal: 16 },
  // Labels sit on the first line of a value that wraps, not its middle.
  fieldRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, minHeight: 54 },
  fieldRowStacked: { flexDirection: "column", alignItems: "stretch", gap: 0 },
  fieldLabel: { ...TYPOGRAPHY.caption, fontSize: 13, color: COLORS.textLight, paddingTop: 18 },
  fieldLabelStacked: { paddingTop: 12 },
  inputStacked: { paddingTop: 2 },
  fieldDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#E2D7CD" },
  input: { ...TYPOGRAPHY.bodyMedium, fontSize: 16, lineHeight: 22, flex: 1, color: COLORS.text, minHeight: 54, paddingVertical: 16, paddingHorizontal: 0 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexBasis: "47%", flexGrow: 1, minWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderRadius: 18, borderWidth: 1, borderColor: "transparent", backgroundColor: TILE },
  tileStacked: { flexBasis: "100%" },
  focusedTile: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  glowing: { paddingRight: 3, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  tileLabel: { fontSize: 13, lineHeight: 18, color: COLORS.textLight },
  valueRow: { flexDirection: "row", alignItems: "baseline", paddingTop: 4 },
  value: { padding: 0, fontSize: 22, fontWeight: "600", fontVariant: ["tabular-nums"], color: COLORS.text },
  // Slack for the caret, so the unit never touches it.
  sizer: { opacity: 0, paddingRight: 3 },
  valueInput: { position: "absolute", top: 4, left: 0, right: 0, bottom: 0 },
  unit: { fontSize: 14, color: COLORS.textLight, marginLeft: 3 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  reestimate: { flex: 1, height: 50, minHeight: 50 },
  remove: { width: 50, height: 50, minHeight: 50, paddingHorizontal: 0 },
});
