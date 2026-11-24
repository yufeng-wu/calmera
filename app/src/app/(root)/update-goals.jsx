import { TYPOGRAPHY } from "@/constants/typography";
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  LayoutAnimation,
  UIManager,
  Platform,
  ActivityIndicator,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { NUTRIENT_COLORS } from "@/constants/colors";
import { SETTINGS } from "@/constants/settingsTheme";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { profileGoals } from "@/hooks/useNutritionData";
import { FormScreen, FormScrollView, FormHeader, GlassButton } from "@/components/GlassForm";
import GoalSliderRow from "@/components/goals/GoalSliderRow";
import SettingsRow from "@/components/settings/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/settings/SettingsSection";
import { goalAllowed, goalInputValue, goalSaveValue } from "@/lib/goals/goalSlider.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { useDataStore } from "@/lib/store";
import { createMemoryStorage } from "@/lib/store/memoryStorage.mjs";
import { createPhoneStore } from "@/lib/store/phone.mjs";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import usePageExit from "@/hooks/usePageExit";

const EMPTY_GOALS = { calorieGoal: "", proteinGoal: "", carbsGoal: "", fatGoal: "" };
const FIXTURE_GOALS = { calorieGoal: "2000", proteinGoal: "150", carbsGoal: "200", fatGoal: "50" };
const FRACTIONAL_FIXTURE_GOALS = { calorieGoal: 2425.6, proteinGoal: 50.25, carbsGoal: 290.75, fatGoal: 88.1 };
const goalInputs = data => ({
  calorieGoal: goalInputValue(data.calorieGoal),
  proteinGoal: goalInputValue(data.proteinGoal),
  carbsGoal: goalInputValue(data.carbsGoal),
  fatGoal: goalInputValue(data.fatGoal),
});
const GOAL_FIELDS = [
  { key: "calorieGoal", label: "Calories", unit: "kcal", maximum: 5000, rangeIncrement: 500, step: 25, color: NUTRIENT_COLORS.calories },
  { key: "proteinGoal", label: "Protein", unit: "g", maximum: 300, rangeIncrement: 50, step: 1, color: NUTRIENT_COLORS.protein },
  { key: "carbsGoal", label: "Carbs", unit: "g", maximum: 600, rangeIncrement: 100, step: 1, color: NUTRIENT_COLORS.carbs },
  { key: "fatGoal", label: "Fat", unit: "g", maximum: 200, rangeIncrement: 25, step: 1, color: NUTRIENT_COLORS.fat },
];

export default function UpdateGoals() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const params = useLocalSearchParams();
  const isFixture = Constants.expoConfig?.extra?.calmeraFullAppTest === true
    && ["ui-goals", "ui-goals-load", "ui-goals-error", "ui-goals-rounded", "ui-goals-unset", "ui-goals-save", "ui-goals-save-error", "ui-goals-slow"].includes(params.calmeraFixture);
  const fixtureMode = isFixture ? params.calmeraFixture : null;
  const { store, setShouldRefresh, setShouldRefreshGoals } = useRefreshSignal();
  const userId = LOCAL_OWNER, isLoaded = true;
  const data = useDataStore();
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  // Settings already holds these goals, so the page opens with them at once. It reads
  // the saved goals only when they aren't loaded yet, or on Try again.
  const [cached] = useState(() => {
    const { profile } = store.getSnapshot();
    return !isFixture && profile && userId && store.belongsTo(userId) ? { owner: userId, goals: goalInputs(profileGoals(profile)) } : null;
  });
  const [goals, setGoals] = useState(isFixture ? FIXTURE_GOALS : cached?.goals ?? EMPTY_GOALS);
  // What's saved now; Update and the leave prompt only matter once the sliders differ.
  const [saved, setSaved] = useState(goals);
  const changed = Object.keys(EMPTY_GOALS).some(key => String(goals[key]) !== String(saved[key]));
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!isFixture && !cached);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loadCount = useRef(0);
  const saveCount = useRef(0);
  // The save checks run the real data module against synthetic storage; the failure
  // check's first write fails.
  const fixtureStore = useRef(null);
  const savePending = useRef(null);
  const scope = useFormTaskScope(isFixture ? `calmera-goals-fixture:${fixtureMode}` : userId, () => {
    savePending.current = null;
    setLoading(false);
  });
  const leaveEditor = usePageExit("/dashboard");
  const [fixtureSaved, setFixtureSaved] = useState(false);
  const hasAnimated = useRef(false);
  const navigation = useNavigation();
  const leaving = useRef(false);

  // Back, the swipe gesture and any other exit ask first while there are unsaved changes.
  const guard = useRef(null);
  guard.current = { changed: changed && !loading, update: () => handleSave() };
  useEffect(() => navigation.addListener("beforeRemove", event => {
    if (leaving.current || !guard.current.changed) return;
    event.preventDefault();
    Keyboard.dismiss();
    Alert.alert("Update your goals?", "You’ve made changes that haven’t been saved.", [
      { text: "Update", onPress: () => guard.current.update() },
      { text: "Discard Changes", style: "destructive", onPress: () => { leaving.current = true; navigation.dispatch(event.data.action); } },
      { text: "Keep Editing", style: "cancel" },
    ]);
  }), [navigation]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Survey recommendations still return to these same editable values.
  useEffect(() => {
    if (!isFetching && params?.recCal && !hasAnimated.current) {
      hasAnimated.current = true;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setGoals((prev) => ({
        ...prev,
        calorieGoal: goalInputValue(params.recCal),
        proteinGoal: goalInputValue(params.recProt),
        carbsGoal: goalInputValue(params.recCarbs),
        fatGoal: goalInputValue(params.recFat),
      }));
    }
  }, [isFetching, params]);

  useEffect(() => {
    if (fixtureMode === "ui-goals") {
      setGoals({ ...FIXTURE_GOALS });
      setSaved({ ...FIXTURE_GOALS });
      setIsFetching(false);
      setLoadError(false);
      setFixtureSaved(false);
      return;
    }
    if (!isLoaded || !userId || (cached?.owner === userId && loadAttempt === 0)) return;
    let active = true;
    const controller = new AbortController();
    let fixtureTimer;
    loadCount.current += 1;
    setIsFetching(true);
    setLoadError(false);
    const load = async () => {
      try {
        let loaded;
        if (fixtureMode) {
          // Exercise the real loading lifecycle without token/network access.
          loaded = await new Promise((resolve, reject) => {
            fixtureTimer = setTimeout(() => {
              if (fixtureMode === "ui-goals-error" && loadAttempt === 0) reject(new Error("synthetic_load_failure"));
              else resolve(fixtureMode === "ui-goals-rounded" ? { ...FRACTIONAL_FIXTURE_GOALS }
                : fixtureMode === "ui-goals-unset" ? { calorieGoal: null, proteinGoal: null, carbsGoal: null, fatGoal: null } : { ...FIXTURE_GOALS });
            }, fixtureMode === "ui-goals-slow" ? 10000 : 200);
          });
        } else {
          loaded = await data.readGoals({ signal: controller.signal,
            isActive: () => active && ownerRef.current === userId });
        }
        if (active && (fixtureMode || ownerRef.current === userId)) {
          setGoals(goalInputs(loaded));
          setSaved(goalInputs(loaded));
        }
      } catch {
        if (active && (fixtureMode || ownerRef.current === userId)) setLoadError(true);
      } finally {
        if (active && (fixtureMode || ownerRef.current === userId)) setIsFetching(false);
      }
    };
    load();
    return () => { active = false; controller.abort(); clearTimeout(fixtureTimer); };
  }, [data, fixtureMode, userId, isLoaded, loadAttempt, cached]);

  const handleChange = (field, value) => {
    const sanitized = goalInputValue(value);
    setFixtureSaved(false);
    setGoals((prev) => ({ ...prev, [field]: sanitized }));
  };

  const handleSave = async () => {
    const currentOwner = () => ownerRef.current === userId && store.belongsTo(userId);
    if (!scope.isActive() || (!isFixture && !currentOwner())
      || savePending.current || loading || isFetching || loadError) return;
    if (!Object.values(goals).every(goalAllowed)) {
      Alert.alert("Check your goals", "Each goal needs to be at least 1.");
      return;
    }
    // QA uses the real editor, but cannot read or update the user's profile.
    const exerciseSave = isFixture && ["ui-goals-save", "ui-goals-save-error"].includes(fixtureMode);
    if (isFixture && !exerciseSave) {
      setFixtureSaved(true);
      setSaved(goals);
      return;
    }
    const task = scope.start();
    if (!task) return;
    savePending.current = task;
    setLoading(true);
    const refreshSavedGoals = () => {
      // Cache bookkeeping is safe after a blur for the same active owner; stale
      // UI/navigation still requires the original focused task below.
      if (!isFixture && currentOwner()) {
        setShouldRefresh(true);
        setShouldRefreshGoals(true);
      }
    };
    try {
      const next = {
        calorieGoal: goalSaveValue(goals.calorieGoal),
        proteinGoal: goalSaveValue(goals.proteinGoal),
        carbsGoal: goalSaveValue(goals.carbsGoal),
        fatGoal: goalSaveValue(goals.fatGoal),
      };
      const options = { startDate: new Date().toLocaleDateString("en-CA"),
        signal: task.signal, isActive: () => task.isCurrent() && (isFixture || currentOwner()) };
      if (exerciseSave) saveCount.current += 1;
      const target = exerciseSave ? fixtureStore.current ??= createPhoneStore({ storage: createMemoryStorage({},
        { failWrites: fixtureMode === "ui-goals-save-error" ? 1 : 0, delayMs: 100 }) }) : data;
      await target.saveGoals(next, options);
      refreshSavedGoals();
      if (!task.isCurrent() || (!isFixture && !currentOwner())) return;
      // Settings and Today show the new numbers as soon as this page closes, so a tap of
      // success is confirmation enough.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      leaving.current = true;
      leaveEditor();
    } catch {
      if (task.isCurrent() && (isFixture || currentOwner())) Alert.alert("Couldn’t save goals", "Try again in a moment.");
    } finally {
      task.finish();
      if (savePending.current === task) {
        savePending.current = null;
        if (task.isCurrent() && (isFixture || currentOwner())) setLoading(false);
      }
    }
  };

  return (
    <FormScreen style={styles.screen}>
      <FormHeader
        title="Daily goals"
        onBack={leaveEditor}
        onSave={handleSave}
        saveTitle="Update"
        saving={loading}
        saveDisabled={isFetching || Boolean(loadError) || !changed}
        backDisabled={loading}
      />
      <FormScrollView
        // Re-measure RN text after a live Dynamic Type change; keep draft state
        // in this screen so remounting the scroll content never reloads goals.
        key={`goals-text-${fontScale}`}
        contentContainerStyle={settingsStyles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={settingsStyles.lead}>Slide to set what you aim for each day. Today’s rings fill toward these.</Text>
        <SettingsSection label="Your goals" cardStyle={styles.goalCard}>
          {isFetching ? (
            <View style={styles.loading} accessibilityLiveRegion="polite">
              <ActivityIndicator color={COLORS.primary} />
              <Text style={settingsStyles.footnote}>Loading your goals…</Text>
            </View>
          ) : loadError ? (
            <View style={styles.errorFeedback} accessibilityLiveRegion="polite">
              <Text style={[styles.helpTitle, styles.centeredText]}>Couldn’t load your goals</Text>
              <Text style={[styles.description, styles.centeredText]}>Try again in a moment.</Text>
              <GlassButton title="Try again" symbol="arrow.clockwise"
                onPress={() => setLoadAttempt(value => value + 1)} style={{ alignSelf: "stretch" }} />
            </View>
          ) : GOAL_FIELDS.map(({ key, ...field }, index) => (
            <View key={key}>
              {index > 0 && <View style={styles.divider} />}
              <GoalSliderRow
                {...field}
                value={goals[key]}
                onChange={(value) => handleChange(key, value)}
                disabled={loading || Boolean(loadError)}
              />
            </View>
          ))}
        </SettingsSection>
        {isFixture && fixtureMode !== "ui-goals" && (
          <View style={{ gap: 4 }}>
            <Text style={styles.fixtureStatus}>Synthetic profile loads: {loadCount.current}</Text>
            {["ui-goals-save", "ui-goals-save-error"].includes(fixtureMode) &&
              <Text style={styles.fixtureStatus}>Synthetic save attempts: {saveCount.current}</Text>}
          </View>
        )}
        {fixtureSaved && (
          <Text style={styles.fixtureStatus} accessibilityLiveRegion="polite">
            Test goals updated locally. Your saved goals were not changed.
          </Text>
        )}
        <SettingsSection label="Not sure?">
          <SettingsRow title="Suggest goals" subtitle="A 1-minute survey for calories and macros" icon="sparkles" tint="leaf"
            disabled={loading || isFetching} accessibilityHint="Opens the goals survey"
            onPress={() => {
              if (isFixture) {
                Alert.alert("Isolated UI test", "The survey is available in the normal app. This test stays local and does not open your profile or change your goals.");
                return;
              }
              router.push("/goals-survey");
            }} />
        </SettingsSection>
      </FormScrollView>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  description: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  goalCard: { paddingHorizontal: 18, paddingVertical: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: SETTINGS.hairline },
  loading: { minHeight: 280, alignItems: "center", justifyContent: "center", gap: 14 },
  errorFeedback: { alignItems: "center", paddingVertical: 20, gap: 12 },
  centeredText: { textAlign: "center" },
  helpTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  fixtureStatus: { ...TYPOGRAPHY.caption, color: COLORS.primary },
});
