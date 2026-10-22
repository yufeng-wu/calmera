import { useEffect, useId, useRef, useState } from "react";
import { Alert, Animated, Image, InputAccessoryView, Keyboard, LayoutAnimation, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
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
  const { bottom, top } = useSafeAreaInsets();
  const { fontScale, width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const large = fontScale >= 1.5;
  // Match four columns to available width and the current system text scale.
  const stackedNutrients = large || (width - 2 * (20 + 12) - 3 * 6) / 4 < 72 * fontScale;
  const { emojiFor } = useFoodIcons();
  const [expandedId, setExpandedId] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const accessoryId = useId();
  const inputs = useRef({});
  const foodListY = useRef(null);
  const foodRowsY = useRef({});
  const headerHeight = useRef(top + 64);
  const revealFrame = useRef(null);
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
  const hasAddedFoods = review.entries.some(entry => entry.origin === "added");
  const fields = ["foodName", "quantity", "calories", "protein", "carbs", "fat"];
  const activeIndex = focusedField ? fields.indexOf(focusedField.name) : -1;
  const focusAdjacent = offset => {
    if (!focusedField || locked) return;
    const name = fields[activeIndex + offset];
    inputs.current[`${focusedField.id}:${name}`]?.focus();
  };
  const inputProps = (id, name) => ({
    ref: node => { inputs.current[`${id}:${name}`] = node; },
    inputAccessoryViewID: Platform.OS === "ios" ? accessoryId : undefined,
    onFocus: () => setFocusedField({ id, name }),
    onBlur: () => setFocusedField(current => current?.id === id && current?.name === name ? null : current),
    returnKeyType: name === "fat" ? "done" : "next",
    submitBehavior: "submit",
    onSubmitEditing: () => {
      const next = fields[fields.indexOf(name) + 1];
      if (next) inputs.current[`${id}:${next}`]?.focus();
      else Keyboard.dismiss();
    },
  });
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
  const revealNewFood = () => {
    const id = revealId.current;
    if (!id || foodListY.current == null || foodRowsY.current[id] == null) return;
    revealId.current = null;
    const y = Math.max(0, foodListY.current + foodRowsY.current[id] - headerHeight.current - 8);
    if (scroll.current?.scrollToPosition) scroll.current.scrollToPosition(0, y, !reducedMotion);
    else scroll.current?.scrollTo?.({ y, animated: !reducedMotion });
    revealFrame.current = requestAnimationFrame(() => inputs.current[`${id}:foodName`]?.focus());
  };
  useEffect(() => () => {
    if (revealFrame.current != null) cancelAnimationFrame(revealFrame.current);
  }, []);
  const closeIcons = () => setIconFoodId(null);
  const iconEntry = review.entries.find(entry => entry.id === iconFoodId);
  const selectedIcon = iconEntry?.iconId || getFoodIcon(iconEntry?.foodName).id;

  return <Animated.View style={{ flex: 1, transform: [{ translateY: entrance }] }}>
    <FormScreen onHeaderHeightChange={value => { headerHeight.current = value; }}>
      <FormHeader title="Review" onBack={onBack} backDisabled={busy || selecting || Boolean(categoryDraft)} />
      <FormScrollView ref={scroll} keyboardAware enableOnAndroid extraScrollHeight={20} enableResetScrollToCoords={false}
        onContentSizeChange={revealNewFood} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {photo ? <View style={[styles.photoRow, large && styles.stacked]}>
          <Pressable accessibilityRole="button" accessibilityLabel="View meal photo" onPress={() => { Keyboard.dismiss(); setPhotoPreview(true); }} style={styles.thumbnail}>
            <Image source={{ uri: photo.dataURL }} style={styles.thumbnail} accessibilityLabel="Meal photo to review" />
            <View style={styles.zoomBadge}><Ionicons name="expand-outline" size={13} color={COLORS.text} /></View>
          </Pressable>
          <GlassButton title="Change photo" onPress={onChangeInput} disabled={locked} style={styles.changeInput} />
        </View> : <View style={[styles.textSource, large && styles.stacked]}>
          <Text style={[styles.caption, !large && { flex: 1 }]} numberOfLines={2}>{text}</Text>
          <GlassButton title="Edit text" onPress={onChangeInput} disabled={locked} style={{ minWidth: large ? 96 : Math.max(96, 96 * fontScale) }} />
        </View>}
        <FormCard>
          <View style={styles.totalHeading}>
            <Text style={styles.heading}>Estimated total</Text>
            <Text style={styles.detectedCount}>{review.entries.length} {review.entries.length === 1 ? "food" : "foods"}{hasAddedFoods ? "" : " detected"}</Text>
          </View>
          <Text style={styles.calories}>{number(totals.calories)} <Text style={styles.calorieUnit}>kcal</Text></Text>
          <View style={styles.macros}>{nutrients.slice(1).map(([label, key, unit]) =>
            <View key={key} style={[styles.macro, large && { flexBasis: "100%" }]}><Text style={styles.caption}>{label}</Text><Text style={styles.value}>{number(totals[key])} {unit}</Text></View>)}</View>
        </FormCard>
        <Text style={styles.heading}>Breakdown</Text>
        {!!review.entries.length && <View onLayout={event => { foodListY.current = event.nativeEvent.layout.y; revealNewFood(); }}>
          <FormCard style={styles.foodList}>
          {review.entries.map((entry, index) => {
            const expanded = expandedId === entry.id;
            return <View key={entry.id} onLayout={event => { foodRowsY.current[entry.id] = event.nativeEvent.layout.y; revealNewFood(); }} style={index > 0 && styles.divider}>
              <View style={styles.foodHeading}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Change emoji for ${entry.foodName || "new food"}`}
                  disabled={locked} onPress={() => { Keyboard.dismiss(); setIconFoodId(entry.id); }} style={styles.iconButton}>
                  <Text style={styles.emoji} allowFontScaling={false}>{emojiFor(entry)}</Text>
                </Pressable>
                {expanded ? <View style={styles.foodCopy}>
                  <TextInput {...inputProps(entry.id, "foodName")} testID={`review-food-name-${entry.id}`} accessibilityLabel="Food name" placeholder="What did you eat?" placeholderTextColor={COLORS.textLight}
                    value={entry.foodName} onChangeText={field(entry.id, "foodName")} editable={!locked} maxLength={255}
                    multiline style={[styles.input, styles.nameInput]} />
                  <TextInput {...inputProps(entry.id, "quantity")} testID={`review-amount-${entry.id}`} accessibilityLabel="Amount" placeholder="e.g. 1 bowl" placeholderTextColor={COLORS.textLight}
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
                <View style={styles.nutrients}>{nutrients.map(([label, key, unit]) => <View key={key} style={[styles.nutrient, focusedField?.id === entry.id && focusedField?.name === key && styles.focusedNutrient, stackedNutrients && styles.largeNutrient, fontScale >= 2.3 && { flexBasis: "100%" }]}>
                  <Text style={styles.caption}>{label}</Text>
                  <View style={styles.nutrientValue}>
                    <TextInput {...inputProps(entry.id, key)} accessibilityLabel={label} value={String(entry[key])} onChangeText={field(entry.id, key)}
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
          </FormCard>
        </View>}
        {removed && <View style={[styles.undoRow, large && styles.stacked]}><Text style={[styles.caption, !large && { flex: 1 }]}>{removed.entry.foodName || "Food"} removed</Text>
          <GlassButton title="Undo" onPress={undoRemoval} disabled={locked || review.entries.length >= MAX_MEAL_FOODS} style={{ minWidth: large ? 96 : Math.max(96, 96 * fontScale) }} /></View>}
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
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.sheetHeader}>
              <Text style={[styles.heading, { flex: 1 }]} accessibilityRole="header">Choose a food emoji</Text>
              <GlassButton symbol="xmark" accessibilityLabel="Close emoji picker" onPress={closeIcons} style={{ width: 44 }} />
            </View>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(bottom, 20) }]}>
              <View style={styles.iconGrid}>{FOOD_ICON_CATALOG.map(icon => <Pressable key={icon.id} disabled={locked}
                onPress={() => { field(iconFoodId, "iconId")(icon.id); closeIcons(); }}
                accessibilityRole="button" accessibilityLabel={icon.label} accessibilityState={{ selected: icon.id === selectedIcon, disabled: locked }}
                style={[styles.iconChoice, icon.id === selectedIcon && styles.selectedIcon]}>
                <Text allowFontScaling={false} style={styles.emoji}>{icon.emoji}</Text>
              </Pressable>)}</View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={photoPreview} animationType={reducedMotion ? "none" : "slide"} onRequestClose={() => setPhotoPreview(false)}>
        <View style={[styles.photoPreview, { paddingTop: top, paddingBottom: bottom }]}>
          <StatusBar barStyle="light-content" />
          <View style={styles.photoPreviewHeader}><Text style={[styles.heading, { color: "white", flex: 1 }]}>Meal photo</Text>
            <GlassButton title="Close" symbol="xmark" onPress={() => setPhotoPreview(false)} style={{ minWidth: 96 }} />
          </View>
          <ScrollView maximumZoomScale={4} minimumZoomScale={1} centerContent style={{ flex: 1 }}>
            {photo && <Image source={{ uri: photo.dataURL }} accessible accessibilityRole="image" accessibilityLabel="Full meal photo" resizeMode="contain"
              style={{ width, height: Math.max(200, height - top - bottom - 80) }} />}
          </ScrollView>
        </View>
      </Modal>
      {Platform.OS === "ios" && <InputAccessoryView nativeID={accessoryId} backgroundColor={COLORS.card}>
        <View style={styles.keyboardBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous field" onPress={() => focusAdjacent(-1)}
            disabled={locked || activeIndex <= 0} style={[styles.keyboardAction, (locked || activeIndex <= 0) && styles.toolDisabled]}>
            <Ionicons name="chevron-up" size={22} color={COLORS.primary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next field" onPress={() => focusAdjacent(1)}
            disabled={locked || activeIndex < 0 || activeIndex >= fields.length - 1}
            style={[styles.keyboardAction, (locked || activeIndex < 0 || activeIndex >= fields.length - 1) && styles.toolDisabled]}>
            <Ionicons name="chevron-down" size={22} color={COLORS.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => Keyboard.dismiss()} style={styles.keyboardDone}>
            <Text style={styles.keyboardDoneText}>Done</Text>
          </Pressable>
        </View>
      </InputAccessoryView>}
    </FormScreen>
  </Animated.View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 12, paddingBottom: 20, gap: 16 },
  keyboardAction: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  keyboardDone: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  keyboardDoneText: { ...TYPOGRAPHY.button, color: COLORS.primary },
  toolDisabled: { opacity: 0.35 },
  keyboardBar: { alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EAE2DB" },
  sheetHeader: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EAE2DB" },
  zoomBadge: { position: "absolute", right: 2, bottom: 2, padding: 3, borderRadius: 8, backgroundColor: "#FFFFFFE6" },
  photoPreview: { flex: 1, backgroundColor: "#171311" },
  photoPreviewHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
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
  nutrient: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 5, gap: 2, borderRadius: 12, borderWidth: 1, borderColor: "#E6DED5", backgroundColor: "#F6F1EC" },
  focusedNutrient: { borderColor: COLORS.primary },
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
