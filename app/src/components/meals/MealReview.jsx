import { useEffect, useId, useRef, useState } from "react";
import { AccessibilityInfo, Alert, Image, InputAccessoryView, InteractionManager, Keyboard, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Animated, { Easing, FadeInDown, FadeOutDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, FormCard, GlassButton, MenuButton } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { SURFACES } from "@/constants/surfaces";
import { TYPOGRAPHY } from "@/constants/typography";
import { getFoodIcon } from "@/lib/meals/foodIcons.mjs";
import FoodEmojiPicker from "@/components/meals/FoodEmojiPicker";
import NutrientValue from "@/components/meals/NutrientValue";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { MEAL_TYPES, MAX_MEAL_FOODS, addReviewFood, hasIncompleteFood, reviewTotals, setReviewField, validateMealReview } from "@/lib/meals/mealReview.mjs";

// One formatter for the screen: toLocaleString builds a native formatter per call.
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const number = value => numberFormat.format(Number(value) || 0);
const nutrients = [["Calories", "calories", "kcal"], ["Protein", "protein", "g"], ["Carbs", "carbs", "g"], ["Fat", "fat", "g"]];
const pick = entry => Object.fromEntries(nutrients.map(([, key]) => [key, entry[key]]));
const amount = value => value.replace(/\s*\(([^)]+)\)/g, " · $1");
const MACROS = [["Protein", "protein"], ["Carbs", "carbs"], ["Fat", "fat"]];
const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
const UNDO_SECONDS = 5;
// Room kept below the content while the Undo toast floats over it.
const TOAST_SPACE = 64;
const haptic = run => { run().catch(() => {}); };
// Starts fast and settles: the panel visibly moves on the first frame after a tap.
const REVEAL = { duration: 260, easing: Easing.bezier(0.2, 0.9, 0.2, 1) };

// `embedded` drops the page header so the review can sit inside another surface (the voice sheet),
// which supplies its own title and close control.
export default function MealReview({ photo, text, review, setReview, busy, estimating, selecting,
  mealSaved, uncertain, onBack, onSave, onChangeInput, onReestimate, onViewMeals, embedded = false }) {
  const { bottom, top } = useSafeAreaInsets();
  const { fontScale, width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const large = fontScale >= 1.5;
  // Match four columns to available width and the current system text scale.
  const stackedNutrients = large || (width - 2 * (20 + 12) - 3 * 6) / 4 < 72 * fontScale;
  const inFlowSave = fontScale >= 2.3;
  const { iconFor } = useFoodIcons();
  const [expandedId, setExpandedId] = useState(null);
  // The whole row header tints while touched, as a table cell does.
  // Once the entrance has settled, build every row's edit panel so taps open instantly.
  const [warm, setWarm] = useState(false);
  const openedIds = useRef(new Set());
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setWarm(true));
    return () => task.cancel();
  }, []);
  const [photoPreview, setPhotoPreview] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const accessoryId = useId();
  const inputs = useRef({});
  const breakdownY = useRef(null);
  const listOffset = useRef(null);
  const foodRowsY = useRef({});
  const headerHeight = useRef(embedded ? 0 : top + 64);
  const revealFrame = useRef(null);
  const [iconFoodId, setIconFoodId] = useState(null);
  // A food before Re-estimate. Every landed estimate plays over all four tiles, even
  // when a number came back the same; a failed one leaves the food untouched and plays nothing.
  const beforeEstimate = useRef({});
  const [pulse, setPulse] = useState(null);
  const lastEstimating = useRef(estimating);
  useEffect(() => {
    const finished = lastEstimating.current;
    lastEstimating.current = estimating;
    if (!finished || finished === estimating) return;
    const before = beforeEstimate.current[finished];
    delete beforeEstimate.current[finished];
    const entry = review.entries.find(item => item.id === finished);
    if (!before || !entry || entry === before.entry) return;
    setPulse({ id: Date.now(), entryId: finished, from: pick(before.entry) });
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  }, [estimating, review.entries]);
  const [removed, setRemoved] = useState(null);
  // Removed rows stay briefly so they can fold away instead of vanishing.
  const [leaving, setLeaving] = useState([]);
  const [validation, setValidation] = useState(null);
  const [saveBarHeight, setSaveBarHeight] = useState(96);
  const saving = useRef(false);
  // The meal picked from Save's menu, shown while that save runs.
  const [savingAs, setSavingAs] = useState(null);
  const initialIds = useRef(new Set(review.entries.map(entry => entry.id)));
  // "Detected" only while the list is still exactly what the estimate found.
  const estimateIds = useRef(new Set(review.entries.filter(entry => entry.origin !== "added").map(entry => entry.id))).current;
  const detected = review.entries.length === estimateIds.size && review.entries.every(entry => estimateIds.has(entry.id));
  const scroll = useRef(null);
  const scrollMetrics = useRef({ y: 0, height: 0, content: 0, under: 0 });
  const revealId = useRef(null);
  const draft = useRef(review);
  draft.current = review;
  const barEdge = useSharedValue(0);
  const barEdgeStyle = useAnimatedStyle(() => ({ opacity: barEdge.value }));
  const locked = busy || selecting || mealSaved || uncertain;
  const totals = reviewTotals(review);
  const fields = ["foodName", "quantity", "calories", "protein", "carbs", "fat"];
  const activeIndex = focusedField ? fields.indexOf(focusedField.name) : -1;

  // Sections without glass controls rise in once when the estimate arrives.
  // Never fade a view that contains a GlassButton: on device, Liquid Glass
  // under an animated-opacity ancestor renders as plain text.
  const motion = reducedMotion ? {} : {
    enter: delay => FadeInDown.duration(300).delay(delay).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] }),
    toastIn: FadeInDown.duration(320).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 16 }] }),
    toastOut: FadeOutDown.duration(200),
  };
  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), UNDO_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [removed]);

  const focusAdjacent = offset => {
    if (!focusedField || locked) return;
    const name = fields[activeIndex + offset];
    inputs.current[`${focusedField.id}:${name}`]?.focus();
  };
  const inputProps = (id, name) => ({
    ref: node => { inputs.current[`${id}:${name}`] = node; },
    inputAccessoryViewID: Platform.OS === "ios" ? `${accessoryId}-${id}-${name}` : undefined,
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
    haptic(Haptics.selectionAsync);
    Keyboard.dismiss(); setExpandedId(current => current === id ? null : id);
  };
  const addFood = () => {
    if (locked || hasIncompleteFood(draft.current) || draft.current.entries.length >= MAX_MEAL_FOODS) return;
    const next = update(addReviewFood);
    const id = next.entries.at(-1).id;
    revealId.current = id;
    setExpandedId(id);
  };
  const removeFood = id => {
    if (locked) return;
    const index = draft.current.entries.findIndex(entry => entry.id === id);
    if (index < 0) return;
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    // Capture the row now: React runs the updater below during the next
    // render, after update() has already dropped it from draft.current.
    const row = { entry: draft.current.entries[index], index };
    // If Undo comes after the fold finishes, the row remounts and rises in.
    initialIds.current.delete(id);
    setRemoved(row);
    AccessibilityInfo.announceForAccessibility(`${row.entry.foodName || "Food"} removed. Undo is available.`);
    setLeaving(current => [...current.filter(item => item.entry.id !== id), row]);
    Keyboard.dismiss();
    update(current => ({ ...current, entries: current.entries.filter(entry => entry.id !== id) }));
    setExpandedId(null);
  };
  const undoRemoval = () => {
    if (locked || !removed || draft.current.entries.length >= MAX_MEAL_FOODS) return;
    setLeaving(current => current.filter(row => row.entry.id !== removed.entry.id));
    update(current => {
      const entries = [...current.entries];
      entries.splice(Math.min(removed.index, entries.length), 0, removed.entry);
      return { ...current, entries };
    });
    setExpandedId(null); setRemoved(null);
  };
  const save = mealType => {
    if (locked || saving.current || !MEAL_TYPES.includes(mealType)) return;
    let snapshot;
    try { snapshot = { ...validateMealReview(draft.current), mealType }; }
    catch (error) {
      setExpandedId(error.foodId || null);
      setValidation({ id: error.foodId, message: error.message });
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
      Alert.alert("Check this food", error.message);
      return;
    }
    Keyboard.dismiss(); setRemoved(null); setSavingAs(mealType);
    saving.current = true;
    Promise.resolve(onSave(snapshot.mealType, snapshot)).finally(() => { saving.current = false; });
  };
  const revealNewFood = () => {
    const id = revealId.current;
    if (!id || breakdownY.current == null || listOffset.current == null || foodRowsY.current[id] == null) return;
    revealId.current = null;
    const y = Math.max(0, breakdownY.current + listOffset.current + foodRowsY.current[id] - headerHeight.current - 8);
    if (scroll.current?.scrollToPosition) scroll.current.scrollToPosition(0, y, !reducedMotion);
    else scroll.current?.scrollTo?.({ y, animated: !reducedMotion });
    // Raise the keyboard once the row has unfolded rather than during it.
    revealFrame.current = setTimeout(() => inputs.current[`${id}:foodName`]?.focus(), reducedMotion ? 0 : REVEAL.duration);
  };
  // Like a UIKit toolbar, the Save bar shows its edge only while content is beneath it.
  const updateBarEdge = changes => {
    const metrics = Object.assign(scrollMetrics.current, changes);
    const under = metrics.height > 0 && metrics.y + metrics.height < metrics.content - 2 ? 1 : 0;
    if (metrics.under === under) return;
    metrics.under = under;
    barEdge.value = reducedMotion ? under : withTiming(under, { duration: 180 });
  };
  useEffect(() => () => {
    if (revealFrame.current != null) clearTimeout(revealFrame.current);
  }, []);
  const rows = review.entries.map(entry => ({ entry }));
  for (const row of [...leaving].sort((a, b) => a.index - b.index)) {
    if (!rows.some(item => item.entry.id === row.entry.id)) rows.splice(Math.min(row.index, rows.length), 0, { entry: row.entry, gone: true });
  }
  const closeIcons = () => setIconFoodId(null);
  const iconEntry = review.entries.find(entry => entry.id === iconFoodId);
  const selectedIcon = iconEntry?.iconId || getFoodIcon(iconEntry?.foodName).id;

  // Save opens a glass menu to file the meal; the estimate's meal is pre-checked.
  // If a food still needs fixing, Save reports it directly instead of asking for a meal first.
  const saveDisabled = busy || selecting || uncertain || !review.entries.length;
  const saveControl = mealSaved || busy
    ? <GlassButton title={mealSaved ? "Go back" : estimating ? "Updating nutrition…" : savingAs ? `Saving as ${savingAs}…` : "Saving…"}
      symbol={mealSaved ? "chevron.left" : "checkmark"} role="accent" onPress={mealSaved ? onBack : undefined}
      loading={busy && !mealSaved} disabled={!mealSaved && saveDisabled} style={styles.saveButton} />
    : hasIncompleteFood(review)
      ? <GlassButton testID="save-meal" title="Save" symbol="checkmark" role="accent" onPress={() => save(review.mealType)}
        disabled={saveDisabled} accessibilityLabel="Save meal" style={styles.saveButton} />
      : <MenuButton testID="save-meal" buttonTitle="Save" symbol="checkmark" role="accent" title="Save as"
        value="" options={MEAL_TYPES} onChange={save} disabled={saveDisabled}
        accessibilityLabel="Save meal as" accessibilityHint="Opens a menu to choose the meal" style={styles.saveButton} />;

  const Screen = embedded ? View : FormScreen;
  const screenProps = embedded ? { style: styles.embedded } : { compactControls: true, onHeaderHeightChange: value => { headerHeight.current = value; } };
  return <Screen {...screenProps}>
      {!embedded && <FormHeader title="Review" onBack={onBack} backDisabled={busy || selecting} />}
      <FormScrollView ref={scroll} keyboardAware enableOnAndroid extraScrollHeight={20} enableResetScrollToCoords={false}
        onContentSizeChange={(_, content) => { updateBarEdge({ content }); revealNewFood(); }}
        onLayout={event => updateBarEdge({ height: event.nativeEvent.layout.height })}
        onScroll={event => updateBarEdge({ y: event.nativeEvent.contentOffset.y })} scrollEventThrottle={32}
        contentContainerStyle={[styles.content, removed && { paddingBottom: styles.content.paddingBottom + TOAST_SPACE }]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {photo ? <View style={styles.hero}>
          <Pressable accessibilityRole="button" accessibilityLabel="View meal photo" onPress={() => { Keyboard.dismiss(); setPhotoPreview(true); }}
            style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.heroPressed]}>
            <Image source={{ uri: photo.dataURL }} style={styles.heroImage} resizeMode="cover" accessibilityIgnoresInvertColors />
          </Pressable>
          <GlassButton title="Change" symbol="camera" onPress={onChangeInput} disabled={locked} accessibilityLabel="Change photo"
            style={[styles.heroAction, { width: Math.round(112 * Math.min(Math.max(fontScale, 1), 1.35)) }]} />
        </View> : <View style={[styles.textSource, large && styles.stacked]}>
          <Text style={[styles.sourceText, !large && { flex: 1 }]} numberOfLines={3}>{text}</Text>
          <GlassButton title="Edit" symbol="pencil" onPress={onChangeInput} disabled={locked} accessibilityLabel="Edit text"
            style={[styles.compactButton, { minWidth: Math.round(88 * Math.max(fontScale, 1)) }]} />
        </View>}

        {/* Calories lead; the three macros in grams sit quietly beneath. */}
        <FormCard entering={motion.enter?.(40)} style={styles.totalCard}>
          <View style={styles.totalHeading}>
            <Text style={styles.eyebrow}>Estimated total</Text>
            <Text style={styles.detectedCount}>{review.entries.length} {review.entries.length === 1 ? "food" : "foods"}{detected ? " detected" : ""}</Text>
          </View>
          <View style={styles.calorieLine} accessible
            accessibilityLabel={`${number(totals.calories)} calories. ${MACROS.map(([label, key]) => `${label} ${number(totals[key])} grams`).join(", ")}.`}>
            <CountingNumber value={totals.calories} style={styles.calories} reducedMotion={reducedMotion} />
            <Text style={styles.calorieUnit}>kcal</Text>
          </View>
          <View style={[styles.macros, large && styles.macrosStacked]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {MACROS.map(([label, key]) => <View key={key} style={[styles.macro, large && styles.macroStacked]}>
              <Text style={styles.macroName}>{label}</Text>
              <Text style={styles.macroValue}><CountingNumber value={totals[key]} reducedMotion={reducedMotion} /><Text style={styles.macroUnit}> g</Text></Text>
            </View>)}
          </View>
        </FormCard>


        <View style={styles.section}
          onLayout={event => { breakdownY.current = event.nativeEvent.layout.y; revealNewFood(); }}>
          <Text style={styles.heading} accessibilityRole="header">Breakdown</Text>
          {!!rows.length && <View style={styles.foodList} onLayout={event => { listOffset.current = event.nativeEvent.layout.y; revealNewFood(); }}>
          {rows.map(({ entry, gone }, index) => {
            const expanded = !gone && expandedId === entry.id;
            if (expanded) openedIds.current.add(entry.id);
            const name = entry.foodName || "new food";
            // Each food is its own card. Header and panel are sibling reveals
            // (never nested), so each animates its own height without lag.
            // The gap above a card folds with it, so nothing below jumps when one leaves.
            return <View key={entry.id} onLayout={event => { foodRowsY.current[entry.id] = event.nativeEvent.layout.y; revealNewFood(); }}>
              <Reveal open={!gone && index > 0} appear={!initialIds.current.has(entry.id)} reducedMotion={reducedMotion}><View style={styles.cardGap} /></Reveal>
              <View style={styles.foodCard}>
              <Reveal open={!gone} appear={!initialIds.current.has(entry.id)} reducedMotion={reducedMotion} inert={gone}
                onClosed={() => setLeaving(current => current.filter(row => row.entry.id !== entry.id))}>
              <View style={styles.foodHeading}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Change icon for ${name}`} accessibilityValue={{ text: iconFor(entry).label }}
                  disabled={locked} onPress={() => { Keyboard.dismiss(); setIconFoodId(entry.id); }}
                  style={({ pressed }) => [styles.emojiTile, pressed && styles.emojiPressed]}>
                  <Text style={styles.emoji} allowFontScaling={false}>{iconFor(entry).emoji}</Text>
                </Pressable>
                <Pressable onPress={() => toggle(entry.id)} disabled={locked} style={styles.foodSummary}
                  accessibilityRole="button" accessibilityLabel={`${expanded ? "Collapse" : "Edit"} ${name}`} accessibilityState={{ expanded, disabled: locked }}>
                  <View style={styles.foodCopy}>
                    <Text style={[styles.foodName, !entry.foodName && styles.placeholder]} numberOfLines={2}>{entry.foodName || "New food"}</Text>
                    {/* The header keeps one layout whether open or closed, so only the panel below moves. */}
                    <Text style={styles.foodDetail} numberOfLines={1}>{amount(entry.quantity) || "Add an amount"}</Text>
                  </View>
                  <Text style={styles.rowCalories}>{entry.calories === "" ? "—" : `${number(entry.calories)} kcal`}</Text>
                  <Chevron expanded={expanded} reducedMotion={reducedMotion} />
                </Pressable>
              </View></Reveal>
              {/* The panel is built ahead of time (hidden) so opening only runs the animation. */}
              <Reveal open={expanded} appear keepMounted={warm} inert={!expanded} reducedMotion={reducedMotion}>{(expanded || warm) && <View style={styles.details}>
                <View style={styles.fieldGroup}>
                  <View style={[styles.fieldRow, large && styles.fieldRowStacked]}>
                    <Text style={[styles.fieldLabel, large ? styles.fieldLabelStacked : { width: 64 * Math.min(fontScale, 1.3) }]}>Name</Text>
                    <TextInput {...inputProps(entry.id, "foodName")} testID={`review-food-name-${entry.id}`} accessibilityLabel="Food name" placeholder="What did you eat?" placeholderTextColor={COLORS.textLight}
                      value={entry.foodName} onChangeText={field(entry.id, "foodName")} editable={!locked && expanded} maxLength={255}
                      multiline scrollEnabled={false} style={[styles.input, large && styles.inputStacked]} />
                  </View>
                  <View style={styles.fieldDivider} />
                  <View style={[styles.fieldRow, large && styles.fieldRowStacked]}>
                    <Text style={[styles.fieldLabel, large ? styles.fieldLabelStacked : { width: 64 * Math.min(fontScale, 1.3) }]}>Amount</Text>
                    <TextInput {...inputProps(entry.id, "quantity")} testID={`review-amount-${entry.id}`} accessibilityLabel="Amount" placeholder="e.g. 1 bowl" placeholderTextColor={COLORS.textLight}
                      value={String(entry.quantity)} onChangeText={field(entry.id, "quantity")} editable={!locked && expanded} maxLength={255}
                      multiline scrollEnabled={false} style={[styles.input, large && styles.inputStacked]} />
                  </View>
                </View>
                {entry.origin !== "added" && <View style={styles.nutrients}>{nutrients.map(([label, key, unit], index) => {
                  const focused = focusedField?.id === entry.id && focusedField?.name === key;
                  // Step the number down as it grows so it and its unit stay on one line.
                  const digits = String(entry[key]).length;
                  const step = digits >= 6 ? 2 : digits >= 5 ? 1 : 0;
                  const fit = [null, styles.nutrientLong, styles.nutrientLonger][step];
                  return <Pressable key={key} accessible={false} onPress={() => inputs.current[`${entry.id}:${key}`]?.focus()}
                    style={[styles.nutrient, key === "calories" && !stackedNutrients && styles.caloriesNutrient, focused && styles.focusedNutrient, stackedNutrients && styles.largeNutrient, fontScale >= 2.3 && { flexBasis: "100%" }]}>
                    <Text style={styles.tileLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
                    {/* The unit trails the number as fixed text: an invisible copy of the value sizes
                        the field, so only the number is editable and the unit follows it as you type. */}
                    <NutrientValue {...inputProps(entry.id, key)} accessibilityLabel={`${label}, ${unit === "g" ? "grams" : "kilocalories"}`}
                      value={entry[key]} unit={unit} onChangeText={field(entry.id, key)} editable={!locked && expanded}
                      order={index} pulse={pulse?.entryId === entry.id ? { id: pulse.id, from: pulse.from[key] } : undefined}
                      style={styles.valueRow} valueStyle={[styles.nutrientText, fit]} unitStyle={[styles.nutrientUnit, { fontSize: 14 - step }]} />
                  </Pressable>;
                })}</View>}
                {validation?.id === entry.id && <Text accessibilityRole="alert" style={styles.error}>{validation.message}</Text>}
                {/* Glass buttons are built only once a row has been opened; until then a
                    same-size placeholder keeps the measured height exact. */}
                {!expanded && !openedIds.current.has(entry.id) ? <View style={[styles.itemActions, styles.actionsPlaceholder]} /> : <View style={styles.itemActions}>
                  <GlassButton title={entry.origin === "added" ? "Estimate nutrition" : "Re-estimate"} symbol="sparkles" onPress={() => { Keyboard.dismiss(); beforeEstimate.current[entry.id] = { entry }; onReestimate(entry.id); }}
                    disabled={locked || !entry.foodName.trim() || !entry.quantity.trim()} loading={estimating === entry.id} style={styles.reestimate} />
                  <GlassButton symbol="trash" role="destructive" onPress={() => removeFood(entry.id)} disabled={locked}
                    accessibilityLabel={`Remove ${name}`} style={styles.remove} />
                </View>}
              </View>}</Reveal>
              </View>
            </View>;
          })}
          </View>}
          {!rows.length && <Text style={[styles.caption, styles.empty]}>No foods in this meal. Add one to save it.</Text>}
        </View>
        <View>
          <GlassButton title={review.entries.length ? "Add another item" : "Add item"} symbol="plus" onPress={addFood}
            disabled={locked || hasIncompleteFood(review) || review.entries.length >= MAX_MEAL_FOODS} />
        </View>
        {uncertain && <FormCard><Text style={styles.heading}>Check your meals before trying again</Text><Text style={styles.caption}>Some foods may already have been saved. Check your meals before logging this one again.</Text>
          <GlassButton title="View meals" symbol="clock" onPress={onViewMeals} /></FormCard>}
        {mealSaved && <FormCard><Text style={styles.heading}>Meal saved</Text><GlassButton title="Go back" onPress={onBack} /></FormCard>}
        {inFlowSave && <View style={[styles.inFlowSave, { paddingBottom: bottom }]}>{saveControl}</View>}
      </FormScrollView>
      {!inFlowSave && <View onLayout={event => setSaveBarHeight(event.nativeEvent.layout.height)}
        style={[styles.saveBar, { paddingBottom: Math.max(bottom, 16) }]}>
        <Animated.View pointerEvents="none" style={[styles.saveBarEdge, barEdgeStyle]} />
        {saveControl}
      </View>}
      {removed && <Animated.View key={removed.entry.id} entering={motion.toastIn} exiting={motion.toastOut} accessibilityLiveRegion="polite"
        style={[styles.toast, { bottom: inFlowSave ? Math.max(bottom, 16) : saveBarHeight + 10 }]}>
        <Text style={styles.toastText} numberOfLines={2}>{removed.entry.foodName || "Food"} removed</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Undo" onPress={undoRemoval} hitSlop={8}
          disabled={locked || review.entries.length >= MAX_MEAL_FOODS}
          style={({ pressed }) => [styles.toastAction, pressed && { opacity: 0.6 }, (locked || review.entries.length >= MAX_MEAL_FOODS) && styles.toolDisabled]}>
          <Text style={styles.toastActionText}>Undo</Text>
        </Pressable>
      </Animated.View>}
      {iconFoodId && <FoodEmojiPicker selectedIconId={selectedIcon} disabled={locked}
        onSelect={iconId => field(iconFoodId, "iconId")(iconId)} onClose={closeIcons} />}
      {/* Slide, not fade: a fading modal would break its glass Close button on device. */}
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
      {/* Fabric attaches an accessory when it mounts, so each exists before its
          field is opened: for every warm row (or the open one until warm). */}
      {Platform.OS === "ios" && (warm ? review.entries.map(entry => entry.id) : expandedId ? [expandedId] : []).flatMap(id => fields.map(name => <InputAccessoryView key={`${id}-${name}`}
        nativeID={`${accessoryId}-${id}-${name}`} backgroundColor={COLORS.card}>
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
      </InputAccessoryView>))}
    </Screen>;
}

// Eases displayed totals toward edited values so changes read as one motion.
function CountingNumber({ value, style, reducedMotion }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (reducedMotion || from === target) { current.current = target; setShown(target); return; }
    const began = Date.now();
    let frame;
    const step = () => {
      const progress = Math.min(1, (Date.now() - began) / 360);
      current.current = from + (target - from) * (1 - (1 - progress) ** 3);
      setShown(progress < 1 ? Math.round(current.current) : target);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion]);
  return <Text style={style}>{number(shown)}</Text>;
}

// Animates its measured height, so content below moves with it. Children
// stay rendered while closing and unmount once folded away. Do not nest:
// an outer reveal only learns an inner one's height after a layout pass.
function Reveal({ open, appear = false, keepMounted = false, onClosed, reducedMotion, inert = false, children, style, ...props }) {
  const height = useSharedValue(0);
  const progress = useSharedValue(open && !appear ? 1 : 0);
  const [present, setPresent] = useState(open);
  const kept = useRef(children);
  if (children) kept.current = children;
  const closed = useRef(onClosed);
  closed.current = onClosed;
  const pendingOpen = useRef(false);
  const unfold = () => { progress.value = reducedMotion ? 1 : withTiming(1, REVEAL); };
  useEffect(() => {
    if (open) {
      // Content mounts with the open render (so keyboard accessories attach to
      // existing inputs) but has no height yet: unfold once it's measured.
      setPresent(true);
      if (height.value) unfold();
      else pendingOpen.current = true;
      return;
    }
    pendingOpen.current = false;
    progress.value = reducedMotion ? 0 : withTiming(0, REVEAL);
    // Finish on the JS side; the UI-thread animation needs no callback.
    const timer = setTimeout(() => { setPresent(false); closed.current?.(); }, reducedMotion ? 0 : REVEAL.duration);
    return () => clearTimeout(timer);
    // Runs on open/close changes only; present and height are read as of that change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reducedMotion, progress]);
  const motion = useAnimatedStyle(() => ({
    height: height.value * progress.value,
  }));
  // Fabric reports no layout for content inside a zero-height parent, so the
  // content is measured in its own absolutely positioned layer.
  return <Animated.View {...props} style={[styles.reveal, style, motion]}>
    <View pointerEvents={inert ? "none" : "auto"} accessibilityElementsHidden={inert} importantForAccessibility={inert ? "no-hide-descendants" : "auto"}
      style={styles.revealContent} onLayout={event => {
        height.value = event.nativeEvent.layout.height;
        if (pendingOpen.current && event.nativeEvent.layout.height > 0) { pendingOpen.current = false; unfold(); }
      }}>{present || open || keepMounted ? children || kept.current : null}</View>
  </Animated.View>;
}

function Chevron({ expanded, reducedMotion }) {
  const turn = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    turn.value = reducedMotion ? Number(expanded) : withTiming(Number(expanded), REVEAL);
  }, [expanded, reducedMotion, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return <Animated.View style={[styles.chevron, style]}><Ionicons name="chevron-down" size={18} color={COLORS.textLight} /></Animated.View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 12, paddingBottom: 28, gap: 20 },
  embedded: { flex: 1 },
  section: { gap: 10 },
  reveal: { overflow: "hidden" },
  revealContent: { position: "absolute", top: 0, left: 0, right: 0 },
  keyboardAction: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  keyboardDone: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  keyboardDoneText: { ...TYPOGRAPHY.button, color: COLORS.primary },
  toolDisabled: { opacity: 0.4 },
  keyboardBar: { alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EAE2DB" },
  hero: { height: 148, borderRadius: 24, overflow: "hidden", backgroundColor: "#EFE7E0" },
  heroPressed: { opacity: 0.85 },
  heroImage: { width: "100%", height: "100%" },
  heroAction: { position: "absolute", right: 10, bottom: 10, height: 40, minHeight: 40 },
  photoPreview: { flex: 1, backgroundColor: "#000000" },
  photoPreviewHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  textSource: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingLeft: 16, borderRadius: 20, backgroundColor: "#F6EFE9" },
  sourceText: { ...TYPOGRAPHY.body, color: COLORS.text },
  compactButton: { height: 40, minHeight: 40 },
  stacked: { flexDirection: "column", alignItems: "stretch" },
  heading: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  eyebrow: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  unit: { color: COLORS.textLight },
  totalCard: { gap: 0 },
  totalHeading: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  detectedCount: { ...TYPOGRAPHY.captionMedium, color: COLORS.text, marginLeft: "auto", textAlign: "right" },
  calorieLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 4, marginTop: 4 },
  calories: { fontSize: 32, lineHeight: 38, fontWeight: "700", letterSpacing: -0.5, color: COLORS.text, fontVariant: ["tabular-nums"] },
  calorieUnit: { fontSize: 15, lineHeight: 20, color: COLORS.textLight },
  macros: { flexDirection: "row", gap: 16, marginTop: 12 },
  macrosStacked: { flexDirection: "column", gap: 8 },
  macro: { flex: 1 },
  macroStacked: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  macroName: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  macroValue: { fontSize: 17, lineHeight: 22, fontWeight: "600", color: COLORS.text, fontVariant: ["tabular-nums"], marginTop: 2 },
  macroUnit: { fontSize: 15, fontWeight: "400", color: COLORS.textLight },
  foodList: {},
  cardGap: { height: 10 },
  foodCard: { borderRadius: 24, overflow: "hidden", backgroundColor: SURFACES.content, ...SURFACES.edge },
  foodHeading: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 8 },
  emojiTile: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F1EC" },
  emojiPressed: { backgroundColor: "#EDE3DA" },
  emoji: { fontSize: 24, textAlign: "center" },
  foodSummary: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 },
  foodCopy: { flex: 1, gap: 2, justifyContent: "center" },
  // Same treatment as food rows on Today (home.styles transactionTitle / macrosText).
  foodName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  foodDetail: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  placeholder: { color: COLORS.textLight },
  rowCalories: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: COLORS.text, fontVariant: ["tabular-nums"] },
  chevron: { width: 28, alignItems: "center" },
  details: { paddingHorizontal: 12, paddingTop: 2, paddingBottom: 12, gap: 12 },
  fieldGroup: { borderRadius: 14, backgroundColor: "#F6F1EC", paddingHorizontal: 12 },
  // Labels sit on the first line of a value that wraps, not its middle.
  fieldRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, minHeight: 44 },
  fieldRowStacked: { flexDirection: "column", alignItems: "stretch", gap: 0, paddingTop: 0 },
  // Puts the label's baseline on the value's first baseline (~28 pt down with 12 pt padding).
  fieldLabel: { ...TYPOGRAPHY.caption, color: COLORS.textLight, paddingTop: 14 },
  fieldLabelStacked: { paddingTop: 10 },
  inputStacked: { paddingTop: 2 },
  fieldDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#E2D7CD" },
  input: { ...TYPOGRAPHY.bodyMedium, flex: 1, color: COLORS.text, minHeight: 44, paddingVertical: 12, paddingHorizontal: 0 },
  nutrients: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tileLabel: { fontSize: 12, lineHeight: 16, color: COLORS.textLight },
  nutrient: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6, gap: 0, borderRadius: 14, borderWidth: 1, borderColor: "transparent", backgroundColor: "#F6F1EC" },
  focusedNutrient: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  largeNutrient: { flexBasis: "45%", flexGrow: 1 },
  // A little wider so "Calories kcal" fits beside three gram tiles.
  caloriesNutrient: { flexGrow: 1.4 },
  // The row aligns on the sizer copy's baseline, so the unit sits on the number at every size.
  valueRow: { minHeight: 34, paddingTop: 7 },
  nutrientText: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"], color: COLORS.text },
  nutrientLong: { fontSize: 15 },
  nutrientLonger: { fontSize: 13 },
  // Like the summary card's "25 g": a lighter unit a size or two below its number.
  nutrientUnit: { color: COLORS.textLight, marginLeft: 1 },
  error: { fontSize: 13, lineHeight: 18, color: COLORS.expense },
  itemActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  reestimate: { flex: 1, height: 44, minHeight: 44 },
  actionsPlaceholder: { height: 44 },
  remove: { width: 44, height: 44, minHeight: 44, paddingHorizontal: 0 },
  empty: { paddingVertical: 8 },
  inFlowSave: { marginTop: 8 },
  saveBar: { paddingTop: 12, paddingHorizontal: 20, backgroundColor: COLORS.background },
  saveBarEdge: { position: "absolute", top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "#E2D7CD" },
  saveButton: { minHeight: 52 },
  toast: { position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, minHeight: 52,
    borderRadius: 18, backgroundColor: "#3B2C24", shadowColor: "#000000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6 },
  toastText: { ...TYPOGRAPHY.body, flex: 1, color: "#FFFFFF" },
  toastAction: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  toastActionText: { ...TYPOGRAPHY.button, color: "#F3B07C" },
});
