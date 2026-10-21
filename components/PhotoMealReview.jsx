import { useState } from "react";
import { Alert, Image, Keyboard, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, FormCard, GlassButton } from "@/components/GlassForm";
import { FoodEntryFormCard, MealTypeOptions } from "@/components/FoodEntryFormCard";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { getFoodEmoji } from "@/lib/foodIcons.mjs";
import { mealEditorValues } from "@/lib/mealEditorDraft.mjs";
import { MAX_PHOTO_FOODS, photoReviewTotals, updatePhotoReviewFood } from "@/lib/photoMealReview.mjs";

const number = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function PhotoMealReview({ photo, review, setReview, editor, setEditor, busy, selecting,
  mealSaved, uncertain, onBack, onSave, onChangePhoto, onReestimate, onViewHistory }) {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const large = fontScale >= 1.5;
  const [removed, setRemoved] = useState(null);
  const locked = busy || selecting || mealSaved || uncertain;
  const totals = photoReviewTotals(review);
  const openEditor = entry => {
    if (locked) return;
    const values = mealEditorValues(entry || { mealType: review.mealType });
    setEditor({ id: entry?.id ?? null, values, estimated: { foodName: values.foodName, quantity: values.quantity } });
  };
  const commitEditor = () => {
    if (locked) return;
    try {
      const updated = updatePhotoReviewFood(review, editor.id, editor.values);
      Keyboard.dismiss(); setReview(updated); setEditor(null);
    } catch (error) { Alert.alert("Check this food", error.message); }
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

  if (editor) {
    const field = name => value => setEditor(current => current ? { ...current, values: { ...current.values, [name]: value } } : current);
    const canEstimate = editor.values.foodName.trim() && editor.values.quantity.trim()
      && (editor.values.foodName !== editor.estimated.foodName || editor.values.quantity !== editor.estimated.quantity);
    return <FormScreen>
      <FormHeader title={editor.id ? "Edit food" : "Add food"} onBack={() => { if (!locked) { Keyboard.dismiss(); setEditor(null); } }} backDisabled={locked}
        rightAction={<GlassButton title={large ? "" : "Done"} symbol={large ? "checkmark" : ""} accessibilityLabel="Done" role="navigation-action" onPress={commitEditor} disabled={locked} style={{ width: large ? 44 : 68, minHeight: 44 }} />} />
      <FormScrollView keyboardAware keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        enableOnAndroid extraScrollHeight={20} enableResetScrollToCoords={false} contentContainerStyle={{ paddingBottom: Math.max(bottom, 24) + 16 }}>
        <Text style={styles.editorNote}>Changes apply to this review when you tap Done. If you change the amount, update nutrition or estimate again.</Text>
        <FoodEntryFormCard {...editor.values} setFoodName={field("foodName")} setQuantity={field("quantity")}
          setCalories={field("calories")} setProtein={field("protein")} setCarbs={field("carbs")} setFat={field("fat")}
          showMealType={false} onEstimateMacros={onReestimate} estimateDisabled={!canEstimate}
          isEstimating={busy} busy={locked} showMacros />
        {editor.id && <GlassButton title="Remove food" symbol="xmark" role="destructive" onPress={removeFood} disabled={locked}
          style={{ marginHorizontal: 20, marginTop: 20 }} />}
      </FormScrollView>
    </FormScreen>;
  }

  return <FormScreen>
    <FormHeader title="Review meal" onBack={onBack} backDisabled={busy || selecting} />
    <FormScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.photoRow, large && styles.stacked]}>
        <Image source={{ uri: photo.dataURL }} style={styles.thumbnail} accessibilityLabel="Meal photo to review" />
        <View style={[styles.photoCopy, large && styles.photoCopyStacked]}>
          <Text style={styles.heading}>Make it your meal</Text>
          <Text style={styles.caption}>Check each food and portion before saving.</Text>
        </View>
        <GlassButton title="Change" onPress={onChangePhoto} disabled={locked} accessibilityLabel="Change meal photo" style={{ minWidth: Math.max(96, 96 * fontScale) }} />
      </View>
      <FormCard>
        <Text style={styles.heading}>Meal</Text>
        <MealTypeOptions mealType={review.mealType} setMealType={mealType => { if (!locked) setReview({ ...review, mealType }); }} disabled={locked} />
      </FormCard>
      <FormCard>
        <View style={styles.totalHeading}>
          <Text style={styles.heading}>Meal total</Text>
          <Text style={styles.caption}>{review.entries.length} {review.entries.length === 1 ? "food" : "foods"}</Text>
        </View>
        <Text style={styles.calories}>{number(totals.calories)} <Text style={styles.calorieUnit}>kcal</Text></Text>
        <View style={styles.macros}>
          {[["Protein", totals.protein], ["Carbs", totals.carbs], ["Fat", totals.fat]].map(([label, value]) =>
            <View key={label} style={[styles.macro, large && { flexBasis: "100%" }]}><Text style={styles.caption}>{label}</Text><Text style={styles.value}>{number(value)} g</Text></View>)}
        </View>
      </FormCard>
      <View style={[styles.listHeading, large && styles.stacked]}><Text style={styles.heading}>Foods</Text><Text style={styles.caption}>Tap a food to edit</Text></View>
      {review.entries.length ? <FormCard style={styles.foodList}>
        {review.entries.map((entry, index) => <Pressable key={entry.id} onPress={() => openEditor(entry)} disabled={locked}
          accessibilityRole="button" accessibilityLabel={`Edit ${entry.foodName}`}
          accessibilityHint={`${entry.quantity}, ${number(entry.calories)} calories. Review amount and nutrition.`}
          accessibilityState={{ disabled: locked }} style={({ pressed }) => [styles.foodRow, index > 0 && styles.divider, pressed && styles.pressed]}>
          <Text style={styles.emoji} accessible={false} allowFontScaling={false}>{getFoodEmoji(entry.foodName)}</Text>
          <View style={styles.foodCopy}><Text style={styles.foodName}>{entry.foodName}</Text><Text style={styles.caption}>{entry.quantity}</Text>
            <Text style={styles.foodCalories}>{number(entry.calories)} kcal</Text></View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} accessible={false} />
        </Pressable>)}
      </FormCard> : <FormCard><Text style={styles.heading}>No foods in this meal yet</Text><Text style={styles.caption}>Add a food below, or choose a different photo.</Text></FormCard>}
      {removed && <View style={styles.undoRow}><Text style={[styles.caption, { flex: 1 }]}>{removed.entry.foodName} removed</Text>
        <GlassButton title="Undo" onPress={undoRemoval} disabled={locked || review.entries.length >= MAX_PHOTO_FOODS} style={{ minWidth: Math.max(96, 96 * fontScale) }} /></View>}
      <GlassButton title="Add food" symbol="plus" onPress={() => openEditor(null)} disabled={locked || review.entries.length >= MAX_PHOTO_FOODS} />
      <Text style={styles.note}>Estimates are for the amounts shown. Nothing is saved until you tap Save meal.</Text>
      {uncertain && <FormCard><Text style={styles.heading}>Check History before trying again</Text><Text style={styles.caption}>Some foods may already have been saved. Check History before logging this meal again.</Text>
        <GlassButton title="View History" symbol="clock" onPress={onViewHistory} /></FormCard>}
      {mealSaved && <FormCard><Text style={styles.heading}>Meal saved</Text><Text style={styles.caption}>Go back to continue.</Text></FormCard>}
    </FormScrollView>
    <View style={[styles.saveBar, { paddingBottom: Math.max(bottom, 16) }]}>
      <GlassButton title={mealSaved ? "Go back" : busy ? "Saving meal…" : "Save meal"} symbol={mealSaved ? "chevron.left" : "checkmark"} role="accent"
        onPress={mealSaved ? onBack : onSave} loading={busy && !mealSaved}
        disabled={busy || selecting || uncertain || (!mealSaved && !review.entries.length)} />
    </View>
  </FormScreen>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 12, paddingBottom: 20, gap: 16 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumbnail: { width: 64, height: 64, borderRadius: 16, backgroundColor: "#F6F1EC" },
  photoCopy: { flex: 1, gap: 4 },
  photoCopyStacked: { flex: 0, width: "100%" },
  stacked: { flexDirection: "column", alignItems: "stretch" },
  heading: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  totalHeading: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
  calories: { ...TYPOGRAPHY.authTitle, color: COLORS.text, fontVariant: ["tabular-nums"] },
  calorieUnit: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  macros: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  macro: { flexGrow: 1, gap: 3 },
  value: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
  listHeading: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
  foodList: { padding: 0, gap: 0, overflow: "hidden" },
  foodRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, minHeight: 84 },
  foodCopy: { flex: 1, gap: 3 },
  foodName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  foodCalories: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  emoji: { fontSize: 25, width: 38, textAlign: "center" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EAE2DB" },
  pressed: { backgroundColor: "#F8F3EF" },
  undoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center", paddingHorizontal: 8 },
  editorNote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, marginHorizontal: 24, marginTop: 12 },
  saveBar: { paddingTop: 12, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EAE2DB", backgroundColor: COLORS.background },
});
