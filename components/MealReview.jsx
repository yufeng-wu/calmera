import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Image, Keyboard, LayoutAnimation, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, FormCard, GlassButton } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { FOOD_ICON_CATALOG, getFoodIcon } from "@/lib/foodIcons.mjs";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { MEAL_TYPES, MAX_MEAL_FOODS, addReviewFood, hasIncompleteFood, reviewTotals, setReviewField, validateMealReview } from "@/lib/mealReview.mjs";

const number = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
const nutrients = [["Calories", "calories", "kcal"], ["Protein", "protein", "g"], ["Carbs", "carbs", "g"], ["Fat", "fat", "g"]];
const amount = value => value.replace(/\s*\(([^)]+)\)/g, " · $1");

export default function MealReview({ photo, text, review, setReview, busy, estimating, selecting,
  mealSaved, uncertain, onBack, onSave, onChangeInput, onReestimate, onViewHistory }) {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const large = fontScale >= 1.5;
  const { emojiFor } = useFoodIcons();
  const [expandedId, setExpandedId] = useState(null);
  const [iconFoodId, setIconFoodId] = useState(null);
  const [removed, setRemoved] = useState(null);
  const [validation, setValidation] = useState(null);
  const [categoryDraft, setCategoryDraft] = useState(null);
  const categorySubmitted = useRef(false);
  const scroll = useRef(null);
  const revealId = useRef(null);
  const draft = useRef(review);
  draft.current = review;
  const entrance = useRef(new Animated.Value(reducedMotion ? 0 : 14)).current;
  useEffect(() => {
    const animation = Animated.timing(entrance, { toValue: 0, duration: reducedMotion ? 0 : 220, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [entrance, reducedMotion]);
  const locked = busy || selecting || mealSaved || uncertain || Boolean(categoryDraft);
  const totals = reviewTotals(review);
  const animate = () => {
    if (!reducedMotion) LayoutAnimation.configureNext({ duration: 200, update: { type: "easeInEaseOut" } });
  };
  const update = transform => {
    if (locked) return;
    const next = transform(draft.current);
    draft.current = next;
    setReview(next);
    setValidation(null);
    return next;
  };
  const field = (id, name) => value => update(current => setReviewField(current, id, name, value));
  const toggle = id => {
    if (locked) return;
    Keyboard.dismiss(); animate(); setExpandedId(current => current === id ? null : id);
  };
  const addFood = () => {
    if (locked || hasIncompleteFood(draft.current) || draft.current.entries.length >= MAX_MEAL_FOODS) return;
    animate();
    const next = update(addReviewFood);
    const id = next.entries.at(-1).id;
    revealId.current = id;
    setExpandedId(id);
  };
  const removeFood = id => {
    if (locked) return;
    const index = draft.current.entries.findIndex(entry => entry.id === id);
    if (index < 0) return;
    setRemoved({ entry: draft.current.entries[index], index });
    Keyboard.dismiss(); animate();
    update(current => ({ ...current, entries: current.entries.filter(entry => entry.id !== id) }));
    setExpandedId(null);
  };
  const undoRemoval = () => {
    if (locked || !removed || draft.current.entries.length >= MAX_MEAL_FOODS) return;
    animate();
    update(current => {
      const entries = [...current.entries];
      entries.splice(Math.min(removed.index, entries.length), 0, removed.entry);
      return { ...current, entries };
    });
    setExpandedId(removed.entry.id); setRemoved(null);
  };
  const chooseCategory = () => {
    if (locked) return;
    try {
      const snapshot = validateMealReview(draft.current);
      Keyboard.dismiss(); categorySubmitted.current = false; setCategoryDraft(snapshot);
    } catch (error) {
      animate(); setExpandedId(error.foodId || null);
      setValidation({ id: error.foodId, message: error.message });
      Alert.alert("Check this food", error.message);
    }
  };
  const saveCategory = mealType => {
    if (!categoryDraft || categorySubmitted.current) return;
    categorySubmitted.current = true;
    const snapshot = categoryDraft;
    setCategoryDraft(null);
    onSave(mealType, snapshot);
  };
  const revealNewFood = (_, height) => {
    if (!revealId.current) return;
    revealId.current = null;
    if (scroll.current?.scrollToEnd) scroll.current.scrollToEnd({ animated: !reducedMotion });
    else scroll.current?.scrollToPosition?.(0, height, !reducedMotion);
  };
  const closeIcons = () => setIconFoodId(null);
  const iconEntry = review.entries.find(entry => entry.id === iconFoodId);
  const selectedIcon = iconEntry?.iconId || getFoodIcon(iconEntry?.foodName).id;

  return <Animated.View style={{ flex: 1, transform: [{ translateY: entrance }] }}>
    <FormScreen>
      <FormHeader title="Review" onBack={onBack} backDisabled={busy || selecting || Boolean(categoryDraft)} />
      <FormScrollView ref={scroll} keyboardAware enableOnAndroid extraScrollHeight={20} enableResetScrollToCoords={false}
        onContentSizeChange={revealNewFood} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {photo ? <View style={[styles.photoRow, large && styles.stacked]}>
          <Image source={{ uri: photo.dataURL }} style={styles.thumbnail} accessibilityLabel="Meal photo to review" />
          <GlassButton title="Change photo" onPress={onChangeInput} disabled={locked} style={styles.changeInput} />
        </View> : <View style={[styles.textSource, large && styles.stacked]}>
          <Text style={[styles.caption, { flex: 1 }]} numberOfLines={2}>{text}</Text>
          <GlassButton title="Edit text" onPress={onChangeInput} disabled={locked} style={{ minWidth: Math.max(96, 96 * fontScale) }} />
        </View>}
        <FormCard>
          <View style={styles.totalHeading}>
            <Text style={styles.heading}>Estimated total</Text>
            <Text style={styles.detectedCount}>{review.entries.length} {review.entries.length === 1 ? "food" : "foods"} detected</Text>
          </View>
          <Text style={styles.calories}>{number(totals.calories)} <Text style={styles.calorieUnit}>kcal</Text></Text>
          <View style={styles.macros}>{nutrients.slice(1).map(([label, key, unit]) =>
            <View key={key} style={[styles.macro, large && { flexBasis: "100%" }]}><Text style={styles.caption}>{label}</Text><Text style={styles.value}>{number(totals[key])} {unit}</Text></View>)}</View>
        </FormCard>
        <Text style={styles.heading}>Breakdown</Text>
        {!!review.entries.length && <FormCard style={styles.foodList}>
          {review.entries.map((entry, index) => {
            const expanded = expandedId === entry.id;
            return <View key={entry.id} style={index > 0 && styles.divider}>
              <View style={styles.foodHeading}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Change emoji for ${entry.foodName || "new food"}`}
                  disabled={locked} onPress={() => setIconFoodId(entry.id)} style={styles.iconButton}>
                  <Text style={styles.emoji} allowFontScaling={false}>{emojiFor(entry)}</Text>
                </Pressable>
                {expanded ? <View style={styles.foodCopy}>
                  <TextInput testID={`review-food-name-${entry.id}`} accessibilityLabel="Food name" placeholder="What did you eat?" placeholderTextColor={COLORS.textLight}
                    value={entry.foodName} onChangeText={field(entry.id, "foodName")} editable={!locked} maxLength={255}
                    multiline style={[styles.input, styles.nameInput]} />
                  <TextInput testID={`review-amount-${entry.id}`} accessibilityLabel="Amount" placeholder="e.g. 1 bowl" placeholderTextColor={COLORS.textLight}
                    value={String(entry.quantity)} onChangeText={field(entry.id, "quantity")} editable={!locked} maxLength={255}
                    multiline style={styles.input} />
                </View> : <Pressable onPress={() => toggle(entry.id)} disabled={locked} style={styles.foodCopy}
                  accessibilityRole="button" accessibilityLabel={`Edit ${entry.foodName || "new food"}`} accessibilityState={{ expanded: false, disabled: locked }}>
                  <Text style={styles.foodName}>{entry.foodName || "New food"}</Text>
                  <Text style={styles.caption}>{amount(entry.quantity) || "Add an amount"}</Text>
                </Pressable>}
                <Pressable onPress={() => toggle(entry.id)} disabled={locked} style={styles.iconButton}
                  accessibilityRole="button" accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${entry.foodName || "new food"}`}
                  accessibilityState={{ expanded, disabled: locked }}>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textLight} />
                </Pressable>
              </View>
              {expanded && <View style={styles.details}>
                <View style={styles.nutrients}>{nutrients.map(([label, key, unit]) => <View key={key} style={[styles.nutrient, large && styles.largeNutrient, fontScale >= 2.3 && { flexBasis: "100%" }]}>
                  <Text style={styles.caption}>{label}</Text>
                  <View style={styles.nutrientValue}>
                    <TextInput accessibilityLabel={label} value={String(entry[key])} onChangeText={field(entry.id, key)}
                      editable={!locked} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textLight}
                      selectTextOnFocus style={styles.nutrientInput} maxLength={12} />
                    <Text style={styles.caption}>{unit}</Text>
                  </View>
                </View>)}</View>
                {validation?.id === entry.id && <Text accessibilityRole="alert" style={styles.error}>{validation.message}</Text>}
                <View style={styles.itemActions}>
                  <GlassButton title="Re-estimate" symbol="sparkles" onPress={() => { Keyboard.dismiss(); onReestimate(entry.id); }}
                    disabled={locked || !entry.foodName.trim() || !entry.quantity.trim()} loading={estimating === entry.id} style={{ flex: 1 }} />
                  <Pressable onPress={() => removeFood(entry.id)} disabled={locked} style={styles.remove}
                    accessibilityRole="button" accessibilityLabel={`Remove ${entry.foodName || "new food"}`}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.expense} />
                  </Pressable>
                </View>
              </View>}
            </View>;
          })}
        </FormCard>}
        {removed && <View style={styles.undoRow}><Text style={[styles.caption, { flex: 1 }]}>{removed.entry.foodName || "Food"} removed</Text>
          <GlassButton title="Undo" onPress={undoRemoval} disabled={locked || review.entries.length >= MAX_MEAL_FOODS} style={{ minWidth: Math.max(96, 96 * fontScale) }} /></View>}
        <GlassButton title="Add food" symbol="plus" onPress={addFood}
          disabled={locked || hasIncompleteFood(review) || review.entries.length >= MAX_MEAL_FOODS} />
        {uncertain && <FormCard><Text style={styles.heading}>Check History before trying again</Text><Text style={styles.caption}>Some foods may already have been saved. Check History before logging this meal again.</Text>
          <GlassButton title="View History" symbol="clock" onPress={onViewHistory} /></FormCard>}
        {mealSaved && <FormCard><Text style={styles.heading}>Meal saved</Text><GlassButton title="Go back" onPress={onBack} /></FormCard>}
      </FormScrollView>
      <View style={[styles.saveBar, { paddingBottom: Math.max(bottom, 16) }]}>
        <GlassButton title={mealSaved ? "Go back" : busy ? estimating ? "Updating nutrition…" : "Saving meal…" : "Save meal"}
          symbol={mealSaved ? "chevron.left" : "checkmark"} role="accent" onPress={mealSaved ? onBack : chooseCategory}
          loading={busy && !mealSaved} disabled={busy || selecting || uncertain || Boolean(categoryDraft) || (!mealSaved && !review.entries.length)} />
      </View>
      <Modal visible={Boolean(categoryDraft)} transparent animationType={reducedMotion ? "none" : "slide"} onRequestClose={() => setCategoryDraft(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCategoryDraft(null)} accessibilityLabel="Cancel meal category selection" accessibilityRole="button" />
          <ScrollView style={styles.sheet} contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(bottom, 20) }]} accessibilityViewIsModal>
            <Text style={styles.heading} accessibilityRole="header">Save meal as</Text>
            {MEAL_TYPES.map(mealType => <GlassButton key={mealType} title={mealType} onPress={() => saveCategory(mealType)} />)}
            <GlassButton title="Cancel" onPress={() => setCategoryDraft(null)} />
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={Boolean(iconFoodId)} transparent animationType={reducedMotion ? "none" : "slide"} onRequestClose={closeIcons}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeIcons} accessibilityLabel="Close emoji picker" accessibilityRole="button" />
          <ScrollView style={styles.sheet} contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(bottom, 20) }]} accessibilityViewIsModal>
            <Text style={styles.heading} accessibilityRole="header">Choose a food emoji</Text>
            <View style={styles.iconGrid}>{FOOD_ICON_CATALOG.map(icon => <Pressable key={icon.id} disabled={locked}
              onPress={() => { field(iconFoodId, "iconId")(icon.id); closeIcons(); }}
              accessibilityRole="button" accessibilityLabel={icon.label} accessibilityState={{ selected: icon.id === selectedIcon, disabled: locked }}
              style={[styles.iconChoice, icon.id === selectedIcon && styles.selectedIcon]}>
              <Text allowFontScaling={false} style={styles.emoji}>{icon.emoji}</Text>
            </Pressable>)}</View>
            <GlassButton title="Cancel" onPress={closeIcons} />
          </ScrollView>
        </View>
      </Modal>
    </FormScreen>
  </Animated.View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 12, paddingBottom: 20, gap: 16 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  thumbnail: { width: 64, height: 64, borderRadius: 16, backgroundColor: "#F6F1EC" },
  changeInput: { flex: 1 }, textSource: { flexDirection: "row", alignItems: "center", gap: 12 },
  stacked: { flexDirection: "column", alignItems: "stretch" },
  heading: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  totalHeading: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  detectedCount: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary, marginLeft: "auto", textAlign: "right" },
  calories: { ...TYPOGRAPHY.authTitle, color: COLORS.text, fontVariant: ["tabular-nums"] },
  calorieUnit: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  macros: { flexDirection: "row", flexWrap: "wrap", gap: 16 }, macro: { flexGrow: 1, gap: 3 },
  value: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
  foodList: { padding: 0, gap: 0, overflow: "hidden" },
  foodHeading: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  foodCopy: { flex: 1, gap: 3, minHeight: 44, justifyContent: "center" },
  foodName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  input: { ...TYPOGRAPHY.input, color: COLORS.text, minHeight: 44, padding: 10, borderRadius: 12, backgroundColor: "#F6F1EC" },
  nameInput: { fontWeight: "500" },
  nutrients: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  nutrient: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 6, gap: 2, borderRadius: 12, backgroundColor: "#F6F1EC" },
  largeNutrient: { flexBasis: "45%", flexGrow: 1 },
  nutrientValue: { flexDirection: "row", alignItems: "center", gap: 2 },
  nutrientInput: { ...TYPOGRAPHY.bodyMedium, flex: 1, minWidth: 0, color: COLORS.text, minHeight: 44, paddingVertical: 4, paddingHorizontal: 0, fontVariant: ["tabular-nums"] },
  emoji: { fontSize: 25, textAlign: "center" },
  iconButton: { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EAE2DB" },
  details: { padding: 12, paddingTop: 0, gap: 12 },
  itemActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  remove: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  error: { ...TYPOGRAPHY.caption, color: COLORS.expense },
  undoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  saveBar: { paddingTop: 12, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EAE2DB", backgroundColor: COLORS.background },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.32)" },
  sheet: { flexGrow: 0, flexShrink: 1, maxHeight: "85%", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", backgroundColor: COLORS.card },
  sheetContent: { padding: 20, gap: 12 },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectedIcon: { borderWidth: 2, borderColor: COLORS.primary },
  iconChoice: { minWidth: 52, minHeight: 52, flexGrow: 1, flexBasis: "15%", justifyContent: "center", alignItems: "center", borderRadius: 16, backgroundColor: "#F6F1EC" },
});
