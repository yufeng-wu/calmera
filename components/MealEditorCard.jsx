import { useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassButton } from "@/components/GlassForm";
import SegmentedControl from "@/components/SegmentedControl";
import NutrientValue from "@/components/NutrientValue";
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

function NutrientTile({ label, unit, value, order, pulse, focused, stacked, editable, inputRef, onPress, onChangeText, onFocus, onBlur }) {
  return <Pressable accessible={false} onPress={onPress}
    style={[styles.tile, stacked && styles.tileStacked, focused && styles.focusedTile]}>
    <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
    <NutrientValue ref={inputRef} value={value} unit={unit} order={order}
      pulse={pulse && { id: pulse.id, from: pulse.from[label.toLowerCase()] }}
      accessibilityLabel={`${label}, ${unit === "g" ? "grams" : "kilocalories"}`} editable={editable}
      onChangeText={onChangeText} onFocus={onFocus} onBlur={onBlur}
      style={styles.valueRow} valueStyle={styles.value} unitStyle={styles.unit} />
  </Pressable>;
}

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
  fieldLabel: { ...TYPOGRAPHY.caption, fontSize: 12, color: COLORS.textLight, paddingTop: 17 },
  fieldLabelStacked: { paddingTop: 12 },
  inputStacked: { paddingTop: 2 },
  fieldDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#E2D7CD" },
  input: { ...TYPOGRAPHY.bodyMedium, fontSize: 15, lineHeight: 21, flex: 1, color: COLORS.text, minHeight: 54, paddingVertical: 16, paddingHorizontal: 0 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexBasis: "47%", flexGrow: 1, minWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderRadius: 18, borderWidth: 1, borderColor: "transparent", backgroundColor: TILE },
  tileStacked: { flexBasis: "100%" },
  focusedTile: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  tileLabel: { fontSize: 12, lineHeight: 17, color: COLORS.textLight },
  valueRow: { paddingTop: 4 },
  value: { fontSize: 20 },
  unit: { fontSize: 13, marginLeft: 3 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  reestimate: { flex: 1, height: 50, minHeight: 50 },
  remove: { width: 50, height: 50, minHeight: 50, paddingHorizontal: 0 },
});
