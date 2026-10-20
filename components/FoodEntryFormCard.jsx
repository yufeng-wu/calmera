import { TYPOGRAPHY } from "@/constants/typography";
import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Keyboard,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { FormCard, GlassButton } from "@/components/GlassForm";

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

const FormField = React.forwardRef(function FormField({ label, symbol, suffix, style, inputStyle, ...inputProps }, ref) {
  return (
    <View style={[form.field, style]}>
      <Text style={form.fieldLabel}>{label}</Text>
      <View style={form.fieldBody}>
        {symbol && (
          <Ionicons
            name={symbol}
            size={20}
            color={COLORS.primary}
            style={form.fieldIcon}
            accessible={false}
          />
        )}
        <TextInput
          ref={ref}
          {...inputProps}
          accessibilityLabel={inputProps.accessibilityLabel || label}
          placeholderTextColor={COLORS.textLight}
          style={[form.input, inputStyle]}
        />
        {suffix && <Text style={form.suffix}>{suffix}</Text>}
      </View>
    </View>
  );
});

// State remains in each create/edit screen. Optional props preserve those callers.
export const FoodEntryFormCard = ({
  foodName,
  setFoodName,
  quantity,
  setQuantity,
  gramsOnly = false,
  calories,
  setCalories,
  protein,
  setProtein,
  carbs,
  setCarbs,
  fat,
  setFat,
  mealType,
  setMealType,
  showMealType = true,
  showEstimateButton = true,
  onEstimateMacros,
  isEstimating = false,
  busy = false,
  estimateDisabled = false,
  showMacros = true,
  onEnterMacros,
}) => {
  const { fontScale } = useWindowDimensions();
  const stackedMacros = fontScale >= 1.3;
  const amountInput = React.useRef(null);
  const formBusy = busy || isEstimating;

  return (
    <View style={form.container}>
      {showMealType && (
        <FormCard style={form.card}>
          <Text style={form.sectionTitle}>Meal</Text>
          <View style={form.mealOptions} accessibilityRole="radiogroup">
            {MEAL_TYPES.map((type) => (
              <Pressable
                key={type}
                accessibilityRole="radio"
                accessibilityState={{ checked: mealType === type, disabled: formBusy }}
                disabled={formBusy}
                accessibilityLabel={type}
                onPress={() => setMealType?.(type)}
                style={({ pressed }) => [
                  form.mealOption,
                  fontScale >= 1.5 && form.mealOptionStacked,
                  mealType === type && form.mealOptionSelected,
                  pressed && form.mealOptionPressed,
                ]}
              >
                <Text style={[
                  form.mealOptionText,
                  mealType === type && form.mealOptionTextSelected,
                ]}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
        </FormCard>
      )}

      <FormCard style={form.card}>
        <FormField
          label="Food"
          symbol="restaurant-outline"
          placeholder="What did you eat?"
          value={foodName}
          onChangeText={setFoodName}
          editable={!formBusy}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => amountInput.current?.focus()}
        />
        <View style={form.separator} />
        <FormField
          ref={amountInput}
          label="Amount"
          symbol="cube-outline"
          placeholder={gramsOnly ? "Weight in grams" : "e.g. 150 g or 2 slices"}
          keyboardType={gramsOnly ? "numeric" : "default"}
          value={gramsOnly && quantity ? String(quantity) : quantity}
          suffix={gramsOnly ? "g" : undefined}
          editable={!formBusy}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          onChangeText={(text) => {
            setQuantity(gramsOnly ? text.replace(/[^0-9]/g, "") : text);
          }}
        />
      </FormCard>

      {showEstimateButton && onEstimateMacros && (
        <View style={form.estimateSection}>
          <GlassButton
            title={isEstimating ? "Estimating…" : "Estimate with ChatGPT"}
            symbol="sparkles"
            role="accent"
            style={form.estimateButton}
            loading={isEstimating}
            disabled={formBusy || estimateDisabled}
            onPress={() => {
              Keyboard.dismiss();
              onEstimateMacros();
            }}
          />
          {!showMacros && onEnterMacros && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enter nutrition macros manually"
              style={form.manualButton}
              onPress={onEnterMacros}
              disabled={formBusy}
            >
              <Text style={form.manualButtonText}>Enter macros manually</Text>
            </Pressable>
          )}
        </View>
      )}

      {showMacros && (
        <FormCard style={form.card}>
          <Text style={form.sectionTitle}>Nutrition</Text>
          <Text style={form.helperText}>Review or enter your estimates.</Text>
          <View style={[form.macroGrid, stackedMacros && form.macroGridStacked]}>
            {[
              { label: "Calories", suffix: "kcal", value: calories, setter: setCalories },
              { label: "Protein", suffix: "g", value: protein, setter: setProtein },
              { label: "Carbs", suffix: "g", value: carbs, setter: setCarbs },
              { label: "Fat", suffix: "g", value: fat, setter: setFat },
            ].map(({ label, suffix, value, setter }) => (
              <FormField
                key={label}
                label={label}
                suffix={suffix}
                value={value}
                onChangeText={setter}
                editable={!formBusy}
                placeholder="0"
                keyboardType="decimal-pad"
                accessibilityLabel={`${label}, ${suffix}`}
                style={[form.macroField, stackedMacros && form.macroFieldStacked]}
                inputStyle={form.macroInput}
              />
            ))}
          </View>
        </FormCard>
      )}
    </View>
  );
};

const form = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 12, gap: 18 },
  card: { padding: 18, borderRadius: 24 },
  sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text, marginBottom: 14},
  mealOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mealOption: {
    flexBasis: "47%", flexGrow: 1, minHeight: 46, borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 12, justifyContent: "center", alignItems: "center",
    backgroundColor: "#F8F3EF",
  },
  mealOptionStacked: { flexBasis: "100%", width: "100%" },
  mealOptionSelected: { backgroundColor: "#EFE1D6" },
  mealOptionPressed: { backgroundColor: "#E5D3C5" },
  mealOptionText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text},
  mealOptionTextSelected: { color: COLORS.primary, fontWeight: "600" },
  field: { minWidth: 0 },
  fieldLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textLight, marginBottom: 5},
  fieldBody: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  fieldIcon: { marginRight: 12 },
  input: { ...TYPOGRAPHY.input, flex: 1, minWidth: 0, paddingVertical: 9, paddingHorizontal: 0, color: COLORS.text},
  suffix: { ...TYPOGRAPHY.caption, color: COLORS.textLight, marginLeft: 6},
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: "#EAE2DB", marginVertical: 14 },
  estimateSection: { gap: 4 },
  estimateButton: { minHeight: 50 },
  manualButton: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  manualButtonText: { ...TYPOGRAPHY.button, color: COLORS.primary, textAlign: "center"},
  helperText: { ...TYPOGRAPHY.caption, color: COLORS.textLight, marginTop: -7, marginBottom: 16},
  macroGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 14 },
  macroGridStacked: { flexDirection: "column" },
  macroField: { flexBasis: "45%", flexGrow: 1, backgroundColor: "#F8F3EF", borderRadius: 16, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 3 },
  macroFieldStacked: { flexBasis: "auto", width: "100%" },
  macroInput: { ...TYPOGRAPHY.value, fontVariant: ["tabular-nums"]},
});
