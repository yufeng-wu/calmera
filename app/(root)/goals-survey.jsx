import { SafeScreenTopContext } from "@/components/SafeScreen";
import { TYPOGRAPHY } from "@/constants/typography";
import React, { useContext, useRef, useState } from "react";
import { AccessibilityInfo, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import { useNavigation, StackActions } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { USERS_API_URL } from "@/constants/api";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { FormCard, FormHeader, GlassButton, FormScreen, FormScrollView, formStyles } from "@/components/GlassForm";
import GlassSurface from "@/components/GlassSurface";
import usePageExit from "@/hooks/usePageExit";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import { saveGoalProfile, goalSaveErrorMessage } from "@/lib/goalProfile.mjs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { surveyBmr, surveyGoals, surveyPickerCommit, surveyInputSignature } from "@/lib/goalsSurvey.mjs";

const sexOptions = [
  { label: "Female", value: "female" }, { label: "Male", value: "male" },
  { label: "Prefer not to say", value: "na" },
];
const goalOptions = [
  { label: "Lose", value: "lose" }, { label: "Maintain", value: "maintain" }, { label: "Gain", value: "gain" },
];
const workActivityOptions = [
  { label: "Sedentary", value: "sedentary", desc: "Desk job, mostly sitting", example: "e.g. Office worker, programmer, driver" },
  { label: "Light", value: "light", desc: "Mostly standing, light movement", example: "e.g. Teacher, cashier, retail" },
  { label: "Moderate", value: "moderate", desc: "On feet, walking often", example: "e.g. Nurse, waiter, delivery" },
  { label: "Active", value: "active", desc: "Physically demanding work", example: "e.g. Construction, mover, athlete" },
];
const exerciseActivityOptions = [
  { label: "0", value: "sedentary" }, { label: "1–2", value: "light" },
  { label: "3–4", value: "moderate" }, { label: "5–6", value: "high" }, { label: "7+", value: "very_high" },
];
const goalHelper = {
  lose: "Aim for fat loss through a slight calorie deficit",
  maintain: "Keep current weight and body composition",
  gain: "Build muscle or increase body mass with a surplus",
};
const ageItems = Array.from({ length: 86 }, (_, i) => i + 15);
const weightKgIntItems = Array.from({ length: 171 }, (_, i) => 30 + i);
const weightLbsIntItems = Array.from({ length: 285 }, (_, i) => 66 + i);
const heightCmIntItems = Array.from({ length: 131 }, (_, i) => 120 + i);
const bodyFatItems = Array.from({ length: 46 }, (_, i) => 5 + i);
const heightFtItems = Array.from({ length: 5 }, (_, i) => 4 + i);
const heightInItems = Array.from({ length: 12 }, (_, i) => i);
const decimalItems = Array.from({ length: 10 }, (_, i) => i);
const toLbs = (kg) => Math.round(kg * 2.20462);
const toKg = (lbs) => lbs / 2.20462;
const cmToFeetIn = (cm) => {
  const totalInches = cm / 2.54;
  return { ft: Math.floor(totalInches / 12), in: Math.round(totalInches % 12) };
};
const feetInToCm = (ft, inch) => (ft * 12 + (inch || 0)) * 2.54;

function SurveyChoices({ label, options, selectedValue, onValueChange, compact = false, columns, shortLabels = false, disabled = false }) {
  const { fontScale } = useWindowDimensions();
  const minimumWidth = shortLabels ? 44 * Math.max(1, fontScale) : Math.min(160, 64 * Math.max(1, fontScale));
  return <View style={[styles.choices, compact && styles.unitChoices]}>
    {options.map(({ label: text, value }) => <Pressable key={value}
      accessibilityRole="radio" accessibilityLabel={`${label}, ${text}`}
      accessibilityState={{ checked: selectedValue === value, disabled }} disabled={disabled} onPress={() => onValueChange(value)}
      style={({ pressed }) => [styles.choice, compact && styles.unitChoice,
        !compact && { minWidth: minimumWidth, flexBasis: minimumWidth },
        columns === 2 && { flexBasis: fontScale >= 1.5 ? "100%" : "45%" },
        selectedValue === value && styles.choiceSelected, pressed && styles.choicePressed]}>
      {selectedValue === value && <GlassSurface style={StyleSheet.absoluteFill} />}
      <Text style={[styles.choiceText, selectedValue === value && styles.choiceTextSelected]}>{text}</Text>
    </Pressable>)}
  </View>;
}

function SurveyField({ label, value, onPress, children, disabled = false }) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.fieldControls}>
      <GlassButton title={value} onPress={onPress} disabled={disabled} accessibilityLabel={`${label}, ${value}. Choose value.`}
        style={styles.valueButton} />
      {children}
    </View>
  </View>;
}

function SurveyWheel({ label, value, onChange, items, disabled = false }) {
  return <View style={styles.wheelColumn}>
    {!!label && <Text style={styles.wheelLabel}>{label}</Text>}
    <Picker accessibilityLabel={label} accessibilityState={{ disabled }} enabled={!disabled}
      selectedValue={value} onValueChange={value => { if (!disabled) onChange(value); }}
      itemStyle={styles.pickerItem} style={styles.wheel}>
      {items.map(item => <Picker.Item key={item} label={String(item)} value={item} color={COLORS.text} />)}
    </Picker>
  </View>;
}

function SurveyPickerSheet({ visible, title, onDone, onClose, onClear, children, disabled = false }) {
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.4;
  const actionScale = Math.max(1, fontScale);
  // These two short labels need text-sized space, not the shared multi-line
  // action height. Keep native fonts/materials and let the row wrap if needed.
  const actionWidth = Math.ceil(Math.max(64, 24 + 40 * actionScale) / 4) * 4;
  const actionHeight = Math.ceil(Math.max(48, 20 + 22 * actionScale) / 4) * 4;
  const actionStyle = [styles.sheetSmallAction, { width: actionWidth, height: actionHeight, maxWidth: "100%" }];
  if (!visible) return null;
  return <Modal visible transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
    <View style={styles.sheetBackdrop}>
      <Pressable accessibilityLabel="Close picker" accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom), maxHeight: height * 0.85 }]}>
        <View style={styles.sheetHandle} />
        {largeText && <Text accessibilityRole="header" style={[styles.sheetTitle, styles.sheetTitleLarge]}>{title}</Text>}
        <View style={[styles.sheetHeader, largeText && styles.sheetActionsLarge]}>
          {onClear && <GlassButton title="Clear" onPress={onClear} disabled={disabled} style={actionStyle} />}
          {!largeText && <Text accessibilityRole="header" style={styles.sheetTitle}>{title}</Text>}
          <GlassButton title="Done" onPress={onDone} disabled={disabled} style={actionStyle} />
        </View>
        <ScrollView bounces={false} contentContainerStyle={styles.sheetContent}>
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>;
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
    && ["recommendation-unspecified", "recommendation-body-fat"].includes(calmeraPreviewStage);
  const seeded = calmeraPreview && (calmeraPreviewStage === "recommendation" || saveFixture || disclosureFixture);
  const [age, setAge] = useState(seeded ? 30 : null);
  const [sex, setSex] = useState(seeded ? disclosureFixture ? "na" : "female" : null);
  const [bodyFat, setBodyFat] = useState(disclosureFixture && calmeraPreviewStage === "recommendation-body-fat" ? 20 : null);
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
  const inputSignature = surveyInputSignature({ weightKg, heightCm, age, sex, bodyFat, workActivity, exerciseActivity, goal });
  const [recommendationResult, setRecommendationResult] = useState(() => seeded
    ? { signature: inputSignature, goals: surveyGoals({ weightKg, heightCm, age, sex, bodyFat, workActivity, exerciseActivity, goal }) } : null);
  const recommendation = recommendationResult?.signature === inputSignature ? recommendationResult.goals : null;
  const [picker, setPicker] = useState({ field: null, visible: false });
  const [pendingAge, setPendingAge] = useState(25);
  // Ref guards also reject accessibility/queued actions before disabled props render.
  const changeInput = setter => value => { if (!savingRef.current) setter(value); };
  const closePicker = () => { if (!savingRef.current) setPicker({ field: null, visible: false }); };
  const openPicker = field => {
    if (savingRef.current) return;
    if (field === "age") setPendingAge(age ?? 25);
    setPicker({ field, visible: true });
  };
  const safeTopInset = useContext(SafeScreenTopContext);
  const [headerHeight, setHeaderHeight] = useState(Math.max(64, 40 * fontScale + 20) + safeTopInset);
  const [reduceMotion, setReduceMotion] = useState(true);
  const recommendationY = useRef(null);
  const pendingReveal = useRef(seeded && !disclosureFixture);
  React.useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);
  const revealRecommendation = y => {
    if (!pendingReveal.current || y == null) return;
    pendingReveal.current = false;
    const overlap = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26 ? headerHeight : 0;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - overlap - 12), animated: !reduceMotion });
  };
  const { ft: currentFt, in: currentIn } = cmToFeetIn(heightCm ?? 175);
  const setHeightFromFt = ft => { if (!savingRef.current) setHeightCm(feetInToCm(ft, currentIn)); };
  const setHeightFromIn = inch => { if (!savingRef.current) setHeightCm(feetInToCm(currentFt, inch)); };

  const handleSubmit = () => {
    if (savingRef.current) return;
    if (
      !age ||
      !weightKg ||
      !heightCm ||
      !sex ||
      !workActivity ||
      !exerciseActivity ||
      !goal
    ) {
      return Alert.alert(
        "Missing Info",
        "Please complete all the required fields."
      );
    }

    pendingReveal.current = true;
    setRecommendationResult({ signature: inputSignature, goals: surveyGoals({
      weightKg, heightCm, age, sex, bodyFat, workActivity, exerciseActivity, goal,
    }) });
    if (recommendation && recommendationY.current != null) requestAnimationFrame(() => revealRecommendation(recommendationY.current));
  };

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
        Alert.alert("Success", "Macro goals updated successfully.", [{ text: "OK", onPress: () => {
          if (!current()) return;
          if (navigation.canGoBack()) navigation.dispatch(StackActions.popToTop());
          else goBack();
        } }]);
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
  const displayAge = age !== null ? `${Number(age)} yrs` : "Required";
  const displayWeight = weightKg !== null
    ? `${weightUnit === "kg" ? Number(weightKg).toFixed(1) : Number(toLbs(weightKg)).toFixed(1)} ${weightUnit}` : "Required";
  const displayHeight = heightCm !== null
    ? heightUnit === "cm" ? `${Number(heightCm).toFixed(1)} cm` : `${currentFt} ft ${Math.round(currentIn)} in` : "Required";
  const weightDisplayNumber = weightKg === null ? weightUnit === "kg" ? 70 : 154
    : weightUnit === "kg" ? weightKg : toLbs(weightKg);
  const decimalOf = value => Math.round((value * 10) % 10);
  const changeWeight = value => { if (!savingRef.current) setWeightKg(weightUnit === "kg" ? value : toKg(value)); };
  const fieldName = { age: "Age", weight: `Weight (${weightUnit})`, height: heightUnit === "cm" ? "Height (cm)" : "Height",
    bodyFat: "Body fat %" }[picker.field];
  const workSelection = workActivityOptions.find(option => option.value === workActivity);
  const sexAssumption = sex === "na" && bodyFat === null
    ? "Sex wasn’t specified, so this estimate uses the female equation." : null;

  return <FormScreen style={formStyles.screen} onHeaderHeightChange={setHeaderHeight}>
    <FormHeader title="Goal Survey" onBack={goBack} backDisabled={loading} />
    <FormScrollView key={`survey-text-${fontScale}`} ref={scrollViewRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
      pointerEvents={loading ? "none" : "auto"}>
      {calmeraPreview && <Text style={formStyles.caption}>Synthetic preview · nothing is saved</Text>}
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.introTitle}>A starting point for your goals</Text>
        <Text style={styles.supporting}>Tell us a little about yourself. Review your recommendation before saving it.</Text>
      </View>
      <FormCard>
        <Text accessibilityRole="header" style={styles.sectionTitle}>About you</Text>
        <SurveyField disabled={loading} label="Age" value={displayAge} onPress={() => openPicker("age")} />
        <SurveyField disabled={loading} label="Weight" value={displayWeight} onPress={() => openPicker("weight")}>
          <SurveyChoices disabled={loading} label="Weight unit" compact options={[{ label: "kg", value: "kg" }, { label: "lbs", value: "lbs" }]}
            selectedValue={weightUnit} onValueChange={changeInput(setWeightUnit)} />
        </SurveyField>
        <SurveyField disabled={loading} label="Height" value={displayHeight} onPress={() => openPicker("height")}>
          <SurveyChoices disabled={loading} label="Height unit" compact options={[{ label: "cm", value: "cm" }, { label: "ft/in", value: "ft" }]}
            selectedValue={heightUnit} onValueChange={changeInput(setHeightUnit)} />
        </SurveyField>
        <SurveyField disabled={loading} label="Body fat (optional)" value={bodyFat === null ? "Optional" : `${bodyFat} %`} onPress={() => openPicker("bodyFat")} />
        <View style={styles.question}>
          <Text style={styles.label}>Sex</Text>
          <SurveyChoices disabled={loading} label="Sex" options={sexOptions} selectedValue={sex} onValueChange={changeInput(setSex)} />
          {sexAssumption && <Text style={styles.caption}>{sexAssumption}</Text>}
        </View>
      </FormCard>
      <FormCard>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Your activity</Text>
        <View style={styles.question}>
          <Text style={styles.label}>How active are you at your job?</Text>
          <SurveyChoices disabled={loading} label="Work activity" columns={2} options={workActivityOptions} selectedValue={workActivity} onValueChange={changeInput(setWorkActivity)} />
          {!!workSelection && <View style={styles.helperGroup}>
            <Text style={styles.supporting}>{workSelection.desc}</Text>
            <Text style={styles.caption}>{workSelection.example}</Text>
          </View>}
        </View>
        <View style={styles.question}>
          <Text style={styles.label}>How often do you exercise each week?</Text>
          <SurveyChoices disabled={loading} label="Exercise sessions per week" shortLabels options={exerciseActivityOptions} selectedValue={exerciseActivity} onValueChange={changeInput(setExerciseActivity)} />
        </View>
      </FormCard>
      <FormCard>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Your goal</Text>
        <SurveyChoices disabled={loading} label="Goal" options={goalOptions} selectedValue={goal} onValueChange={changeInput(setGoal)} />
        {!!goal && <Text style={styles.supporting}>{goalHelper[goal]}</Text>}
      </FormCard>
      <GlassButton title="Get recommendation" symbol="sparkles" role="accent" onPress={handleSubmit} disabled={loading} />
      {recommendationResult && !recommendation && <Text accessibilityLiveRegion="polite" style={styles.caption}>Your details changed. Get a new recommendation to continue.</Text>}
      {recommendation && <View collapsable={false} onLayout={({ nativeEvent }) => {
        recommendationY.current = nativeEvent.layout.y;
        revealRecommendation(nativeEvent.layout.y);
      }}><FormCard>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Recommended macros</Text>
        <Text style={styles.caption}>Daily estimates · adjust anytime</Text>
        <View style={styles.resultRows}>
          {[
            ["Calories", recommendation.calorieGoal, "kcal"], ["Protein", recommendation.proteinGoal, "g"],
            ["Carbs", recommendation.carbsGoal, "g"], ["Fat", recommendation.fatGoal, "g"],
          ].map(([label, value, unit]) => <View key={label} style={styles.resultRow}>
            <Text style={styles.resultLabel}>{label}</Text>
            <Text style={styles.resultValue}>{value} <Text style={styles.resultUnit}>{unit}</Text></Text>
          </View>)}
        </View>
        {saveFixture && <Text accessibilityLiveRegion="polite" style={styles.caption}>
          Synthetic save attempts: {fixtureTrace.attempts} · PUT requests: {fixtureTrace.puts}
        </Text>}
        {sexAssumption && <Text style={styles.caption}>{sexAssumption}</Text>}
        <GlassButton title="Use these goals" symbol="checkmark" role="accent" onPress={handleSaveMacros} loading={loading} disabled={loading} />
        <View style={styles.methodGroup}>
          <Text style={styles.caption}>
            Estimated calories at rest (BMR): {Math.round(surveyBmr({ weightKg, heightCm, age, sex, bodyFat }))} kcal/day.{" "}
            Calculated with the {bodyFat !== null ? "Katch–McArdle" : "Mifflin–St Jeor"} formula.
          </Text>
          <Text style={styles.caption}>Estimated daily energy use (TDEE), including activity: {recommendation.calorieGoal + (goal === "lose" ? 500 : goal === "gain" ? -250 : 0)} kcal/day.</Text>
          <Text style={styles.caption}>For your selected goal, this target {goal === "lose" ? "subtracts 500 kcal/day" : goal === "gain" ? "adds 250 kcal/day" : "matches estimated maintenance calories"}.</Text>
          <Text style={styles.caption}>These are estimates. For personal guidance, consult a qualified health professional.</Text>
        </View>
      </FormCard></View>}
    </FormScrollView>
    <SurveyPickerSheet disabled={loading} visible={picker.visible} title={fieldName} onClose={closePicker}
      onDone={() => {
        if (savingRef.current) return;
        const committed = surveyPickerCommit(picker.field, {
          pendingAge, weightKg, weightUnit, heightCm, heightUnit, bodyFat, feet: currentFt, inches: currentIn,
        });
        if (committed.age !== undefined) setAge(committed.age);
        if (committed.weightKg !== undefined) setWeightKg(committed.weightKg);
        if (committed.heightCm !== undefined) setHeightCm(committed.heightCm);
        if (committed.bodyFat !== undefined) setBodyFat(committed.bodyFat);
        closePicker();
      }}
      onClear={picker.field === "bodyFat" ? () => { if (savingRef.current) return; setBodyFat(null); closePicker(); } : undefined}>
      {picker.field === "age" && <SurveyWheel disabled={loading} label="Age" value={pendingAge} onChange={changeInput(setPendingAge)} items={ageItems} />}
      {picker.field === "weight" && <View style={styles.wheelRow}>
        <SurveyWheel disabled={loading} label={weightUnit} value={Math.floor(weightDisplayNumber)}
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
      {picker.field === "bodyFat" && <View style={styles.wheelRow}>
        <SurveyWheel disabled={loading} label="Percent" value={Math.floor(bodyFat ?? 20)}
          onChange={changeInput(value => setBodyFat(Number(`${value}.${decimalOf(bodyFat ?? 20)}`)))} items={bodyFatItems} />
        <Text style={styles.decimalPoint}>.</Text>
        <SurveyWheel disabled={loading} label="Tenths" value={decimalOf(bodyFat ?? 20)}
          onChange={changeInput(value => setBodyFat(Number(`${Math.floor(bodyFat ?? 20)}.${value}`)))} items={decimalItems} />
      </View>}
    </SurveyPickerSheet>
  </FormScreen>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 12, paddingBottom: 48, gap: 18 },
  intro: { gap: 8, paddingHorizontal: 2, paddingBottom: 4 },
  introTitle: { ...TYPOGRAPHY.pageTitle, color: COLORS.text},
  sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text},
  label: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text},
  field: { gap: 8 },
  fieldControls: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  valueButton: { flexGrow: 1, minWidth: 120 },
  question: { gap: 8 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 4,
    borderRadius: 24, backgroundColor: "#F7F2EC" },
  choice: { flexGrow: 1, flexBasis: 0, minHeight: 44, paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 22, alignItems: "center", justifyContent: "center" },
  choiceSelected: { backgroundColor: "#FFFFFF" },
  choicePressed: { backgroundColor: "#ECE2D9" },
  choiceText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textLight, textAlign: "center"},
  choiceTextSelected: { color: COLORS.primary, fontWeight: "600" },
  unitChoices: { flexGrow: 0, flexShrink: 1, flexBasis: "auto" },
  unitChoice: { flexGrow: 0, flexBasis: "auto", minWidth: 44 },
  supporting: { ...TYPOGRAPHY.body, color: COLORS.textLight,},
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textLight,},
  helperGroup: { gap: 4, paddingHorizontal: 4 },
  resultRows: { gap: 0 },
  resultRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EFE7DF" },
  resultLabel: { ...TYPOGRAPHY.body, color: COLORS.text, flexShrink: 1},
  resultValue: { ...TYPOGRAPHY.value, color: COLORS.primary, fontVariant: ["tabular-nums"]},
  resultUnit: { ...TYPOGRAPHY.caption, color: COLORS.textLight,},
  methodGroup: { gap: 12, paddingTop: 6 },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(35,26,21,0.28)" },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, gap: 14 },
  sheetHandle: { height: 5, width: 36, alignSelf: "center", backgroundColor: "#CFC4BA", borderRadius: 3 },
  sheetHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  sheetTitle: { ...TYPOGRAPHY.pageTitle, flex: 1, minWidth: 80, color: COLORS.text},
  sheetSmallAction: { minWidth: 64 },
  sheetTitleLarge: { flex: 0, width: "100%" },
  sheetActionsLarge: { justifyContent: "flex-end" },
  sheetContent: { flexGrow: 1 },
  wheelRow: { flexDirection: "row", alignItems: "center" },
  wheelColumn: { flex: 1, minWidth: 0 },
  wheelLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textLight, textAlign: "center"},
  wheel: { width: "100%", height: 216 },
  pickerItem: { height: 216, fontSize: 22, color: COLORS.text },
  decimalPoint: { ...TYPOGRAPHY.code, color: COLORS.text, paddingTop: 20},
});
