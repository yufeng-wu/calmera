import { useRef, useState } from "react";
import { Alert, Image, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, FormCard, GlassButton } from "@/components/GlassForm";
import { FoodEntryFormCard } from "@/components/FoodEntryFormCard";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { getFoodEmoji } from "@/lib/foodIcons.mjs";
import { mealEditorValues } from "@/lib/mealEditorDraft.mjs";
import { MAX_PHOTO_FOODS, PHOTO_MEAL_TYPES, photoReviewTotals, updatePhotoReviewFood } from "@/lib/photoMealReview.mjs";

const number = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
const nutrients = [["Calories", "calories", "kcal"], ["Protein", "protein", "g"], ["Carbs", "carbs", "g"], ["Fat", "fat", "g"]];

export default function PhotoMealReview({ photo, review, setReview, editor, setEditor, busy, estimating, selecting,
  mealSaved, uncertain, onBack, onSave, onChangePhoto, onReestimate, onViewHistory }) {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const large = fontScale >= 1.5;
  const [removed, setRemoved] = useState(null);
  const [categoryDraft, setCategoryDraft] = useState(null);
  const categorySubmitted = useRef(false);
  const locked = busy || selecting || mealSaved || uncertain || Boolean(categoryDraft);
  const totals = photoReviewTotals(review);
  const applyEditor = () => {
    try {
      const updated = editor ? updatePhotoReviewFood(review, editor.id, editor.values) : review;
      Keyboard.dismiss(); setReview(updated); setEditor(null);
      return updated;
    } catch (error) { Alert.alert("Check this food", error.message); return null; }
  };
  const openEditor = entry => {
    if (locked) return;
    if (editor && !applyEditor()) return;
    const values = mealEditorValues(entry || { mealType: review.mealType });
    setEditor({ id: entry?.id ?? null, values, estimated: { foodName: values.foodName, quantity: values.quantity } });
  };
  const removeFood = () => {
    if (locked || !editor?.id) return;
    const index = review.entries.findIndex(entry => entry.id === editor.id);
    if (index < 0) return;
    setRemoved({ entry: review.entries[index], index });
    setReview({ ...review, entries: review.entries.filter(entry => entry.id !== editor.id) });
    Keyboard.dismiss(); setEditor(null);
  };
  const undoRemoval = () => {
    if (locked || !removed || review.entries.length >= MAX_PHOTO_FOODS) return;
    const entries = [...review.entries];
    if (!entries.some(entry => entry.id === removed.entry.id)) entries.splice(Math.min(removed.index, entries.length), 0, removed.entry);
    setReview({ ...review, entries }); setRemoved(null);
  };
  const chooseCategory = () => {
    if (locked) return;
    const draft = applyEditor();
    if (!draft?.entries.length) return;
    categorySubmitted.current = false;
    setCategoryDraft(draft);
  };
  const saveCategory = mealType => {
    if (!categoryDraft || categorySubmitted.current) return;
    categorySubmitted.current = true;
    const draft = categoryDraft;
    setCategoryDraft(null);
    onSave(mealType, draft);
  };
  const inlineEditor = () => {
    if (!editor) return null;
    const field = name => value => setEditor(current => current ? { ...current, values: { ...current.values, [name]: value } } : current);
    const canEstimate = editor.values.foodName.trim() && editor.values.quantity.trim()
      && (editor.values.foodName !== editor.estimated.foodName || editor.values.quantity !== editor.estimated.quantity);
    return <View style={styles.editor}>
      <FoodEntryFormCard {...editor.values} setFoodName={field("foodName")} setQuantity={field("quantity")}
        setCalories={field("calories")} setProtein={field("protein")} setCarbs={field("carbs")} setFat={field("fat")}
        style={styles.editorForm} showMealType={false} onEstimateMacros={onReestimate} estimateDisabled={!canEstimate}
        isEstimating={estimating} busy={locked} showMacros />
      <GlassButton title="Apply changes" symbol="checkmark" onPress={() => { if (!locked) applyEditor(); }} disabled={locked} />
      <GlassButton title="Cancel edits" onPress={() => { Keyboard.dismiss(); setEditor(null); }} disabled={locked} />
      {editor.id && <GlassButton title="Remove food" symbol="xmark" role="destructive" onPress={removeFood} disabled={locked} />}
    </View>;
  };

  return <FormScreen>
    <FormHeader title="Review meal" onBack={onBack} backDisabled={busy || selecting || Boolean(categoryDraft)} />
    <FormScrollView keyboardAware enableOnAndroid extraScrollHeight={20} enableResetScrollToCoords={false}
      contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={[styles.photoRow, large && styles.stacked]}>
        <Image source={{ uri: photo.dataURL }} style={styles.thumbnail} accessibilityLabel="Meal photo to review" />
        <GlassButton title="Change photo" onPress={onChangePhoto} disabled={locked} accessibilityLabel="Change meal photo" style={styles.changePhoto} />
      </View>
      <FormCard>
        <Text style={styles.heading}>Estimated total</Text>
        <Text style={styles.calories}>{number(totals.calories)} <Text style={styles.calorieUnit}>kcal</Text></Text>
        <View style={styles.macros}>
          {nutrients.slice(1).map(([label, key, unit]) =>
            <View key={key} style={[styles.macro, large && { flexBasis: "100%" }]}><Text style={styles.caption}>{label}</Text><Text style={styles.value}>{number(totals[key])} {unit}</Text></View>)}
        </View>
      </FormCard>
      <Text style={styles.heading}>Breakdown <Text style={styles.caption}>({review.entries.length} {review.entries.length === 1 ? "food" : "foods"} detected)</Text></Text>
      {review.entries.length ? <FormCard style={styles.foodList}>
        {review.entries.map((entry, index) => {
          const expanded = editor?.id === entry.id;
          return <View key={entry.id} style={index > 0 && styles.divider}>
            <Pressable onPress={() => { if (expanded) { if (!locked) applyEditor(); } else openEditor(entry); }} disabled={locked}
              accessibilityRole="button" accessibilityLabel={`${expanded ? "Apply edits to" : "Edit"} ${entry.foodName}`}
              accessibilityHint={`${entry.quantity}. ${nutrients.map(([label, key, unit]) => `${label}: ${number(entry[key])} ${unit}`).join(", ")}.`}
              accessibilityState={{ disabled: locked, expanded }} style={({ pressed }) => [styles.foodRow, pressed && styles.pressed]}>
              <View style={styles.foodHeading}>
                <Text style={styles.emoji} accessible={false} allowFontScaling={false}>{getFoodEmoji(entry.foodName)}</Text>
                <View style={styles.foodCopy}><Text style={styles.foodName}>{entry.foodName}</Text><Text style={styles.caption}>{entry.quantity}</Text></View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textLight} accessible={false} />
              </View>
              <View style={styles.foodNutrients}>
                {nutrients.map(([label, key, unit]) => <View key={key} style={[styles.foodNutrient, large && { flexBasis: "100%" }]}>
                  <Text style={styles.caption}>{label}</Text><Text style={styles.foodValue}>{number(entry[key])} {unit}</Text>
                </View>)}
              </View>
            </Pressable>
            {expanded && inlineEditor()}
          </View>;
        })}
      </FormCard> : <FormCard><Text style={styles.heading}>No foods in this meal yet</Text><Text style={styles.caption}>Add a food below, or choose a different photo.</Text></FormCard>}
      {removed && <View style={styles.undoRow}><Text style={[styles.caption, { flex: 1 }]}>{removed.entry.foodName} removed</Text>
        <GlassButton title="Undo" onPress={undoRemoval} disabled={locked || review.entries.length >= MAX_PHOTO_FOODS} style={{ minWidth: Math.max(96, 96 * fontScale) }} /></View>}
      <GlassButton title="Add food" symbol="plus" onPress={() => openEditor(null)} disabled={locked || editor?.id === null || review.entries.length >= MAX_PHOTO_FOODS} />
      {editor?.id === null && <FormCard style={styles.foodList}>{inlineEditor()}</FormCard>}
      {uncertain && <FormCard><Text style={styles.heading}>Check History before trying again</Text><Text style={styles.caption}>Some foods may already have been saved. Check History before logging this meal again.</Text>
        <GlassButton title="View History" symbol="clock" onPress={onViewHistory} /></FormCard>}
      {mealSaved && <FormCard><Text style={styles.heading}>Meal saved</Text><Text style={styles.caption}>Go back to continue.</Text></FormCard>}
    </FormScrollView>
    <View style={[styles.saveBar, { paddingBottom: Math.max(bottom, 16) }]}>
      <GlassButton title={mealSaved ? "Go back" : busy ? estimating ? "Updating nutrition…" : "Saving meal…" : "Save meal"} symbol={mealSaved ? "chevron.left" : "checkmark"} role="accent"
        onPress={mealSaved ? onBack : chooseCategory} loading={busy && !mealSaved}
        disabled={busy || selecting || uncertain || Boolean(categoryDraft) || (!mealSaved && !review.entries.length && !editor)} />
    </View>
    <Modal visible={Boolean(categoryDraft)} transparent animationType="slide" onRequestClose={() => setCategoryDraft(null)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setCategoryDraft(null)} accessibilityLabel="Cancel meal category selection" accessibilityRole="button" />
        <ScrollView style={styles.categoryScroll} contentContainerStyle={[styles.categorySheet, { paddingBottom: Math.max(bottom, 20) }]} accessibilityViewIsModal>
          <Text style={styles.heading} accessibilityRole="header">Save meal as</Text>
          {PHOTO_MEAL_TYPES.map(mealType => <GlassButton key={mealType} title={mealType} onPress={() => saveCategory(mealType)} />)}
          <GlassButton title="Cancel" onPress={() => setCategoryDraft(null)} />
        </ScrollView>
      </View>
    </Modal>
  </FormScreen>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 12, paddingBottom: 20, gap: 16 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  thumbnail: { width: 72, height: 72, borderRadius: 16, backgroundColor: "#F6F1EC" },
  changePhoto: { flex: 1, minHeight: 48 },
  stacked: { flexDirection: "column", alignItems: "stretch" },
  heading: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  calories: { ...TYPOGRAPHY.authTitle, color: COLORS.text, fontVariant: ["tabular-nums"] },
  calorieUnit: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  macros: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  macro: { flexGrow: 1, gap: 3 },
  value: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
  foodList: { padding: 0, gap: 0, overflow: "hidden" },
  foodRow: { gap: 16, padding: 16 },
  foodHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  foodCopy: { flex: 1, gap: 3 },
  foodName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  foodNutrients: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 8 },
  foodNutrient: { flexBasis: "45%", flexGrow: 1, gap: 2 },
  foodValue: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary, fontVariant: ["tabular-nums"] },
  emoji: { fontSize: 25, width: 38, textAlign: "center" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EAE2DB" },
  pressed: { backgroundColor: "#F8F3EF" },
  undoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  editor: { padding: 12, paddingTop: 0, gap: 12 },
  editorForm: { paddingHorizontal: 0, paddingTop: 0 },
  saveBar: { paddingTop: 12, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EAE2DB", backgroundColor: COLORS.background },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.32)" },
  categoryScroll: { flexGrow: 0, flexShrink: 1, maxHeight: "90%", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", backgroundColor: COLORS.card },
  categorySheet: { padding: 20, gap: 12 },
});
