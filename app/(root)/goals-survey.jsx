import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, LayoutAnimationConfig } from "react-native-reanimated";
import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useNavigation, StackActions } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormHeader, GlassButton, FormScreen, FormScrollView, formStyles } from "@/components/GlassForm";
import SegmentedControl from "@/components/SegmentedControl";
import SettingsRow from "@/components/SettingsRow";
import SheetModal from "@/components/SheetModal";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import { USERS_API_URL } from "@/constants/api";
import { NUTRIENT_COLORS } from "@/constants/colors";
import { SETTINGS, SETTINGS_MOTION } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import usePageExit from "@/hooks/usePageExit";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import { saveGoalProfile, goalSaveErrorMessage } from "@/lib/goalProfile.mjs";
import { ADULT_AGE, DEFICIT, surveyGoals, surveyPickerCommit } from "@/lib/goalsSurvey.mjs";
import { formatNumber } from "@/lib/insights/stats.mjs";

const sexOptions = [
  { label: "Female", value: "female" }, { label: "Male", value: "male" }, { label: "Prefer not to say", value: "na" },
];
const workActivityOptions = [
  { value: "sedentary", title: "Mostly sitting", subtitle: "Desk work, driving" },
  { value: "light", title: "Mostly standing", subtitle: "Teaching, retail" },
  { value: "moderate", title: "Mostly walking", subtitle: "Nursing, serving, delivery" },
  { value: "active", title: "Heavy lifting", subtitle: "Construction, moving" },
];
const exerciseActivityOptions = [
  { label: "0", value: "sedentary" }, { label: "1–2", value: "light" },
  { label: "3–4", value: "moderate" }, { label: "5–6", value: "high" }, { label: "7+", value: "very_high" },
];
const goalOptions = [
  { value: "lose", title: "Lose weight", subtitle: `About ${DEFICIT} kcal under what you burn` },
  { value: "maintain", title: "Stay the same", subtitle: "About what you burn" },
  { value: "gain", title: "Build muscle", subtitle: "About 10% over what you burn" },
];
const RESULTS = [
  { key: "calorieGoal", label: "Calories", unit: "", color: NUTRIENT_COLORS.calories },
  { key: "proteinGoal", label: "Protein", unit: "g", color: NUTRIENT_COLORS.protein },
  { key: "carbsGoal", label: "Carbs", unit: "g", color: NUTRIENT_COLORS.carbs },
  { key: "fatGoal", label: "Fat", unit: "g", color: NUTRIENT_COLORS.fat },
];
const DISCLAIMER_LEAD = "A starting point only, not dietary or medical advice.";
const DISCLAIMER = " Calmera isn’t a medical service; talk to a doctor or registered dietitian before changing how you eat.";
const ageItems = Array.from({ length: 86 }, (_, i) => i + 15);
const weightKgIntItems = Array.from({ length: 171 }, (_, i) => 30 + i);
const weightLbsIntItems = Array.from({ length: 285 }, (_, i) => 66 + i);
const heightCmIntItems = Array.from({ length: 131 }, (_, i) => 120 + i);
const heightFtItems = Array.from({ length: 5 }, (_, i) => 4 + i);
const heightInItems = Array.from({ length: 12 }, (_, i) => i);
const decimalItems = Array.from({ length: 10 }, (_, i) => i);
// Pounds keep their tenth, like kilograms, so a picked 154.6 lb stays 154.6.
const toLbs = (kg) => Math.round(kg * 2.20462 * 10) / 10;
const toKg = (lbs) => lbs / 2.20462;
const cmToFeetIn = (cm) => {
  const totalInches = cm / 2.54;
  return { ft: Math.floor(totalInches / 12), in: Math.round(totalInches % 12) };
};
const feetInToCm = (ft, inch) => (ft * 12 + (inch || 0)) * 2.54;
const tick = () => Haptics.selectionAsync().catch(() => {});

// The footnote under the numbers: one sentence with the equation, the figures
// and the aim rule that applied. Plain statements, no advice.
function describeMethod({ details, sex }) {
  const { bmr, activityFactor, tdee, aim, reason, change, atFloor, floor } = details;
  let tail = ".";
  if (reason === "minor") tail = `, kept at that level under ${ADULT_AGE}.`;
  else if (reason === "underweight") tail = ", kept at that level with a BMI under the healthy range.";
  else if (reason === "at-minimum") tail = `, already at the ${formatNumber(floor)} kcal adult minimum.`;
  else if (aim === "lose" && atFloor) tail = `, cut to the ${formatNumber(floor)} kcal adult minimum${sex === "na" ? " for men" : ""}.`;
  else if (aim === "lose") tail = `, minus ${formatNumber(-change)} kcal to lose weight.`;
  else if (aim === "gain") tail = `, plus ${formatNumber(change)} kcal to build muscle.`;
  return `Suggested based on Mifflin–St Jeor: about ${formatNumber(bmr)} kcal at rest × ${activityFactor} for activity ≈ ${formatNumber(tdee)} kcal a day${tail}`;
}

// One row of labelled choices on the native segmented control (Liquid Glass on iOS 26).
function Segmented({ label, options, value, onChange, disabled = false, fitContent = false }) {
  const current = options.find(option => option.value === value)?.label ?? "";
  return <SegmentedControl options={options.map(option => option.label)} value={current} disabled={disabled} accessibilityLabel={label} fitContent={fitContent}
    onChange={picked => { const option = options.find(candidate => candidate.label === picked); if (option) onChange(option.value); }} />;
}

function SurveyWheel({ label, value, onChange, items, disabled = false }) {
  return <View style={styles.wheelColumn}>
    {!!label && <Text style={styles.wheelLabel}>{label}</Text>}
    <Picker accessibilityLabel={label} accessibilityState={{ disabled }} enabled={!disabled}
      selectedValue={value} onValueChange={value => { if (!disabled) onChange(value); }}
      itemStyle={styles.pickerItem} style={styles.wheel}>
      {items.map(item => <Picker.Item key={item} label={String(item)} value={item} color={SETTINGS.ink} />)}
    </Picker>
  </View>;
}

// The wheel pickers live in the shared sheet, so only the sheet travels while
// the dimmed backdrop fades. Done commits, then the sheet slides away.
function SurveyPickerSheet({ visible, title, onDone, onClose, children, disabled = false }) {
  const sheetRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.4;
  const actionScale = Math.max(1, fontScale);
  // The Done label needs text-sized space, not the shared multi-line action
  // height. Keep native fonts/materials and let the row wrap if needed.
  const actionWidth = Math.ceil(Math.max(64, 24 + 40 * actionScale) / 4) * 4;
  const actionHeight = Math.ceil(Math.max(48, 20 + 22 * actionScale) / 4) * 4;
  const actionStyle = [styles.sheetSmallAction, { width: actionWidth, height: actionHeight, maxWidth: "100%" }];
  if (!visible) return null;
  const header = <View style={styles.sheetTop}>
    {largeText && <Text accessibilityRole="header" style={[styles.sheetTitle, styles.sheetTitleLarge]}>{title}</Text>}
    <View style={[styles.sheetHeader, largeText && styles.sheetActionsLarge]}>
      {!largeText && <View style={actionStyle} />}
      {!largeText && <Text accessibilityRole="header" style={styles.sheetTitle}>{title}</Text>}
      <GlassButton title="Done" onPress={() => sheetRef.current?.close(onDone)} disabled={disabled} style={actionStyle} />
    </View>
  </View>;
  return <SheetModal ref={sheetRef} onClose={onClose} dismissLabel="Close picker" header={header}
    style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom), maxHeight: height * 0.85 }]}>
    <ScrollView bounces={false} contentContainerStyle={styles.sheetContent}>
      {children}
    </ScrollView>
  </SheetModal>;
}

// The suggested goals in Today's ring colors; dashes until every question is answered.
function SuggestedGoals({ goals, large }) {
  const spoken = goals ? RESULTS.map(({ key, label, unit }) => `${label} ${formatNumber(goals[key])} ${unit === "g" ? "grams" : "kilocalories"}`).join(", ")
    : "Not ready yet";
  return <View style={styles.results} accessible accessibilityLabel={`A reasonable starting point. ${spoken}.`}>
    <LayoutAnimationConfig skipEntering>
      {RESULTS.map(({ key, label, unit, color }) => <View key={key} style={[styles.result, large && styles.resultLarge]}>
        <View style={styles.resultLabelRow}>
          <View style={[styles.resultDot, { backgroundColor: color }]} />
          <Text numberOfLines={1} style={styles.resultLabel}>{label}</Text>
        </View>
        <Animated.Text key={`${key}-${goals?.[key] ?? "none"}`} entering={goals ? FadeIn.duration(SETTINGS_MOTION.fade) : undefined}
          numberOfLines={1} style={styles.resultValue}>
          {goals ? formatNumber(goals[key]) : "–"}{goals && !!unit && <Text style={styles.resultUnit}>{` ${unit}`}</Text>}
        </Animated.Text>
      </View>)}
    </LayoutAnimationConfig>
  </View>;
}

export default function GoalsSurvey({ calmeraPreview = false, calmeraPreviewStage = "form" }) {
  const navigation = useNavigation();
  const { fontScale } = useWindowDimensions();
  const { getToken, userId } = useAuth();
  const owner = calmeraPreview ? "calmera-ui-preview" : userId;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const savingRef = useRef(false);
  const goBack = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");
  const { store, setShouldRefresh, setShouldRefreshGoals } = useRefreshSignal();
  const scrollViewRef = useRef(null);
  const saveFixture = calmeraPreview && ["save-token-timeout", "save-response-timeout", "save-error"].includes(calmeraPreviewStage);
  const disclosureFixture = calmeraPreview && Constants.expoConfig?.extra?.calmeraFullAppTest === true
    && ["recommendation-unspecified", "recommendation-minor"].includes(calmeraPreviewStage);
  const seeded = calmeraPreview && (calmeraPreviewStage === "recommendation" || saveFixture || disclosureFixture);
  const [age, setAge] = useState(seeded ? calmeraPreviewStage === "recommendation-minor" ? 16 : 30 : null);
  const [sex, setSex] = useState(seeded ? disclosureFixture ? "na" : "female" : null);
  const [weightKg, setWeightKg] = useState(seeded ? 70 : null);
  const [weightUnit, setWeightUnit] = useState("kg");
  const [heightCm, setHeightCm] = useState(seeded ? 175 : null);
  const [heightUnit, setHeightUnit] = useState("cm");
  const [goal, setGoal] = useState(seeded ? "maintain" : null);
  const [loading, setLoading] = useState(false);
  const fixtureCalls = useRef({ attempts: 0, puts: 0 });
  const [fixtureTrace, setFixtureTrace] = useState({ attempts: 0, puts: 0 });
  const scope = useFormTaskScope(owner, () => {
    savingRef.current = false;
    setLoading(false);
  });
  const [workActivity, setWorkActivity] = useState(seeded ? "moderate" : null);
  const [exerciseActivity, setExerciseActivity] = useState(seeded ? "moderate" : null);
  // The suggestion follows the answers as they change, so there's nothing to press first.
  const answers = [age, heightCm, weightKg, sex, workActivity, exerciseActivity, goal];
  const remaining = answers.filter(value => value === null).length;
  const recommendation = remaining ? null : surveyGoals({ weightKg, heightCm, age, sex, workActivity, exerciseActivity, goal });
  const [picker, setPicker] = useState({ field: null, visible: false });
  const [pendingAge, setPendingAge] = useState(25);
  // Ref guards also reject accessibility/queued actions before disabled props render.
  const changeInput = setter => value => { if (!savingRef.current) setter(value); };
  const choose = (setter, value, current) => { if (savingRef.current || value === current) return; tick(); setter(value); };
  const closePicker = () => { if (!savingRef.current) setPicker({ field: null, visible: false }); };
  const openPicker = field => {
    if (savingRef.current) return;
    if (field === "age") setPendingAge(age ?? 25);
    setPicker({ field, visible: true });
  };
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);
  // When the last answer completes the suggestion, bring it and its button into view.
  const ready = Boolean(recommendation);
  const wasReady = useRef(ready && !(seeded && !disclosureFixture));
  useEffect(() => {
    if (ready && !wasReady.current) requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: !reduceMotion }));
    wasReady.current = ready;
  }, [ready, reduceMotion]);
  const { ft: currentFt, in: currentIn } = cmToFeetIn(heightCm ?? 175);
  const setHeightFromFt = ft => { if (!savingRef.current) setHeightCm(feetInToCm(ft, currentIn)); };
  const setHeightFromIn = inch => { if (!savingRef.current) setHeightCm(feetInToCm(currentFt, inch)); };

  const handleSaveMacros = async () => {
    if (!recommendation || savingRef.current || !scope.isActive()) return;
    if (calmeraPreview && !saveFixture) return Alert.alert("Preview only", "Recommendation validated. No goals were saved.");
    const task = scope.start();
    if (!task) return;
    const current = () => task.isCurrent() && ownerRef.current === owner;
    const refreshAfterWrite = () => {
      if (!calmeraPreview && ownerRef.current === owner && store.belongsTo(owner)) {
        setShouldRefresh(true);
        setShouldRefreshGoals(true);
      }
    };
    const body = {
      calorieGoal: recommendation.calorieGoal, proteinGoal: recommendation.proteinGoal,
      carbsGoal: recommendation.carbsGoal, fatGoal: recommendation.fatGoal,
      localDate: new Date().toLocaleDateString("en-CA"),
    };
    savingRef.current = task;
    setLoading(true);
    try {
      const options = { getToken: () => tokenRef.current(), url: `${USERS_API_URL}/update-user`,
        body, signal: task.signal, isActive: current };
      if (saveFixture) {
        // These private review cases use the real save helper with fake I/O only.
        const attempt = ++fixtureCalls.current.attempts;
        setFixtureTrace({ ...fixtureCalls.current });
        options.url = "https://synthetic.invalid/goals";
        options.timeoutMs = 4000;
        options.getToken = () => calmeraPreviewStage === "save-token-timeout" && attempt === 1
          ? new Promise(() => {}) : Promise.resolve("synthetic-token");
        options.fetchImpl = async () => {
          fixtureCalls.current.puts += 1;
          if (current()) setFixtureTrace({ ...fixtureCalls.current });
          if (calmeraPreviewStage === "save-response-timeout" && attempt === 1) return new Promise(() => {});
          await new Promise(resolve => setTimeout(resolve, 300));
          return { ok: calmeraPreviewStage !== "save-error" || attempt > 1, status: calmeraPreviewStage === "save-error" && attempt === 1 ? 400 : 200 };
        };
      }
      await saveGoalProfile(options);
      refreshAfterWrite();
      if (!current()) return;
      if (saveFixture) {
        Alert.alert("Preview only", "Synthetic save complete. No goals were saved.");
      } else {
        // Settings shows the new goals as soon as this closes, so a tap of success is enough.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (navigation.canGoBack()) navigation.dispatch(StackActions.popToTop());
        else goBack();
      }
    } catch (error) {
      if (error.mayHaveSaved) refreshAfterWrite();
      if (current()) Alert.alert(error.mayHaveSaved ? "Save not confirmed" : "Couldn’t save goals", goalSaveErrorMessage(error));
    } finally {
      task.finish();
      if (savingRef.current === task) {
        savingRef.current = false;
        if (current()) setLoading(false);
      }
    }
  };
  const displayAge = age !== null ? `${Number(age)}` : "Choose";
  const displayWeight = weightKg !== null
    ? `${weightUnit === "kg" ? Number(weightKg).toFixed(1) : Number(toLbs(weightKg)).toFixed(1)} ${weightUnit === "kg" ? "kg" : "lb"}` : "Choose";
  const displayHeight = heightCm !== null
    ? heightUnit === "cm" ? `${Number(heightCm).toFixed(1)} cm` : `${currentFt} ft ${Math.round(currentIn)} in` : "Choose";
  const weightDisplayNumber = weightKg === null ? weightUnit === "kg" ? 70 : 154
    : weightUnit === "kg" ? weightKg : toLbs(weightKg);
  const decimalOf = value => Math.round((value * 10) % 10);
  const changeWeight = value => { if (!savingRef.current) setWeightKg(weightUnit === "kg" ? value : toKg(value)); };
  const fieldName = { age: "Age", weight: "Weight", height: "Height" }[picker.field];
  const sexAssumption = sex === "na" ? "With “Prefer not to say”, the estimate uses the midpoint of the female and male equations and the higher calorie minimum." : null;
  const minor = age !== null && age < ADULT_AGE;
  const aimNote = minor ? `Under ${ADULT_AGE}, we only suggest what you need to stay the same. Changing weight is something to plan with a doctor or dietitian.` : null;
  const resultsNote = recommendation ? describeMethod({ details: recommendation.details, sex })
    : `Answer ${remaining} more ${remaining === 1 ? "question" : "questions"} to see your goals.`;

  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Suggest goals" onBack={goBack} backDisabled={loading} />
    <FormScrollView key={`survey-text-${fontScale}`} ref={scrollViewRef} contentContainerStyle={settingsStyles.content} keyboardShouldPersistTaps="handled"
      pointerEvents={loading ? "none" : "auto"}>
      {calmeraPreview && <Text style={settingsStyles.footnote}>Synthetic preview · nothing is saved</Text>}
      <Text style={settingsStyles.lead}>Answer a few questions for a starting point. Change the numbers anytime.</Text>
      <SettingsSection label="About you" footnote={sexAssumption}>
        <SettingsRow title="Age" value={displayAge} onPress={() => openPicker("age")} disabled={loading} />
        <SettingsRow title="Height" value={displayHeight} divider onPress={() => openPicker("height")} disabled={loading} />
        <SettingsRow title="Weight" value={displayWeight} divider onPress={() => openPicker("weight")} disabled={loading} />
        <View style={styles.segmentRow}>
          <View style={styles.inlineDivider} />
          <Text style={styles.segmentTitle}>Sex</Text>
          <Segmented label="Sex" options={sexOptions} value={sex} disabled={loading} fitContent onChange={value => choose(setSex, value, sex)} />
        </View>
      </SettingsSection>
      <SettingsSection label="At work">
        {workActivityOptions.map((option, index) => <SettingsRow key={option.value} title={option.title} subtitle={option.subtitle}
          accessibilityRole="radio" selected={workActivity === option.value} divider={index > 0} disabled={loading}
          onPress={() => choose(setWorkActivity, option.value, workActivity)} />)}
      </SettingsSection>
      <SettingsSection label="Workouts a week">
        <View style={styles.segmentCard}>
          <Segmented label="Workouts a week" options={exerciseActivityOptions} value={exerciseActivity} disabled={loading}
            onChange={value => choose(setExerciseActivity, value, exerciseActivity)} />
        </View>
      </SettingsSection>
      <SettingsSection label="Your aim" footnote={aimNote}>
        {goalOptions.map((option, index) => <SettingsRow key={option.value} title={option.title} subtitle={option.subtitle}
          accessibilityRole="radio" selected={goal === option.value} divider={index > 0} disabled={loading}
          onPress={() => choose(setGoal, option.value, goal)} />)}
      </SettingsSection>
      <SettingsSection label="A reasonable starting point" footnote={resultsNote}>
        <SuggestedGoals goals={recommendation} large={fontScale > 1.3} />
      </SettingsSection>
      {saveFixture && <Text accessibilityLiveRegion="polite" style={settingsStyles.footnote}>
        Synthetic save attempts: {fixtureTrace.attempts} · PUT requests: {fixtureTrace.puts}
      </Text>}
      <GlassButton title="Use these goals" symbol="checkmark" role="accent" onPress={handleSaveMacros} loading={loading} disabled={loading || !recommendation} />
      <Text style={settingsStyles.footnote}><Text style={styles.disclaimerLead}>{DISCLAIMER_LEAD}</Text>{DISCLAIMER}</Text>
    </FormScrollView>
    <SurveyPickerSheet disabled={loading} visible={picker.visible} title={fieldName} onClose={closePicker}
      onDone={() => {
        if (savingRef.current) return;
        const committed = surveyPickerCommit(picker.field, {
          pendingAge, weightKg, weightUnit, heightCm, heightUnit, feet: currentFt, inches: currentIn,
        });
        if (committed.age !== undefined) setAge(committed.age);
        if (committed.weightKg !== undefined) setWeightKg(committed.weightKg);
        if (committed.heightCm !== undefined) setHeightCm(committed.heightCm);
        closePicker();
      }}>
      {picker.field === "weight" && <Segmented label="Weight unit" options={[{ label: "kg", value: "kg" }, { label: "lb", value: "lbs" }]}
        value={weightUnit} disabled={loading} onChange={changeInput(setWeightUnit)} />}
      {picker.field === "height" && <Segmented label="Height unit" options={[{ label: "cm", value: "cm" }, { label: "ft / in", value: "ft" }]}
        value={heightUnit} disabled={loading} onChange={changeInput(setHeightUnit)} />}
      {picker.field === "age" && <SurveyWheel disabled={loading} label="Years" value={pendingAge} onChange={changeInput(setPendingAge)} items={ageItems} />}
      {picker.field === "weight" && <View style={styles.wheelRow}>
        <SurveyWheel disabled={loading} label={weightUnit === "kg" ? "kg" : "lb"} value={Math.floor(weightDisplayNumber)}
          onChange={value => changeWeight(Number(`${value}.${decimalOf(weightDisplayNumber)}`))}
          items={weightUnit === "kg" ? weightKgIntItems : weightLbsIntItems} />
        <Text style={styles.decimalPoint}>.</Text>
        <SurveyWheel disabled={loading} label="Tenths" value={decimalOf(weightDisplayNumber)}
          onChange={value => changeWeight(Number(`${Math.floor(weightDisplayNumber)}.${value}`))} items={decimalItems} />
      </View>}
      {picker.field === "height" && heightUnit === "cm" && <View style={styles.wheelRow}>
        <SurveyWheel disabled={loading} label="cm" value={Math.floor(heightCm ?? 175)}
          onChange={changeInput(value => setHeightCm(Number(`${value}.${decimalOf(heightCm ?? 175)}`)))} items={heightCmIntItems} />
        <Text style={styles.decimalPoint}>.</Text>
        <SurveyWheel disabled={loading} label="Tenths" value={decimalOf(heightCm ?? 175)}
          onChange={changeInput(value => setHeightCm(Number(`${Math.floor(heightCm ?? 175)}.${value}`)))} items={decimalItems} />
      </View>}
      {picker.field === "height" && heightUnit === "ft" && <View style={styles.wheelRow}>
        <SurveyWheel disabled={loading} label="Feet" value={currentFt} onChange={value => setHeightFromFt(Number(value))} items={heightFtItems} />
        <SurveyWheel disabled={loading} label="Inches" value={Math.round(currentIn)} onChange={value => setHeightFromIn(Number(value))} items={heightInItems} />
      </View>}
    </SurveyPickerSheet>
  </FormScreen>;
}

const styles = StyleSheet.create({
  segmentRow: { gap: 10, paddingHorizontal: SETTINGS.rowPadding, paddingTop: 14, paddingBottom: 14 },
  inlineDivider: { position: "absolute", top: 0, left: SETTINGS.rowPadding, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: SETTINGS.hairline },
  segmentTitle: { ...TYPOGRAPHY.bodyMedium, color: SETTINGS.ink },
  segmentCard: { padding: 10 },
  results: { flexDirection: "row", flexWrap: "wrap", rowGap: 14, paddingVertical: 16, paddingHorizontal: SETTINGS.rowPadding },
  result: { width: "25%", gap: 3, paddingRight: 6 },
  resultLarge: { width: "50%" },
  resultLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  resultDot: { width: 7, height: 7, borderRadius: 3.5 },
  resultLabel: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, flexShrink: 1 },
  resultValue: { ...TYPOGRAPHY.value, color: SETTINGS.ink, fontVariant: ["tabular-nums"] },
  resultUnit: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft },
  disclaimerLead: { ...TYPOGRAPHY.captionMedium, fontWeight: "600", color: SETTINGS.ink },
  sheet: { backgroundColor: SETTINGS.surface, paddingHorizontal: 20, paddingBottom: 20 },
  sheetTop: { paddingTop: 10, paddingBottom: 14 },
  sheetHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  sheetTitle: { ...TYPOGRAPHY.sectionTitle, flex: 1, minWidth: 80, color: SETTINGS.ink, textAlign: "center" },
  sheetSmallAction: { minWidth: 64 },
  sheetTitleLarge: { flex: 0, width: "100%" },
  sheetActionsLarge: { justifyContent: "flex-end" },
  sheetContent: { flexGrow: 1, gap: 8, paddingTop: 2 },
  wheelRow: { flexDirection: "row", alignItems: "center" },
  wheelColumn: { flex: 1, minWidth: 0 },
  wheelLabel: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, textAlign: "center" },
  wheel: { width: "100%", height: 216 },
  pickerItem: { height: 216, fontSize: 22, color: SETTINGS.ink },
  decimalPoint: { ...TYPOGRAPHY.code, color: SETTINGS.ink, paddingTop: 20 },
});
