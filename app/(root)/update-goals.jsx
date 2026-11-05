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
import { USERS_API_URL } from "@/constants/api";
import * as Haptics from "expo-haptics";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { NUTRIENT_COLORS } from "@/constants/colors";
import { SETTINGS } from "@/constants/settingsTheme";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { profileGoals } from "@/hooks/useNutritionData";
import { useAuth } from "@clerk/clerk-expo";
import { FormScreen, FormScrollView, FormHeader, GlassButton } from "@/components/GlassForm";
import GoalSliderRow from "@/components/GoalSliderRow";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import { goalAllowed, goalInputValue, goalSaveValue } from "@/lib/goalSlider.mjs";
import { fetchGoalProfile, saveGoalProfile, goalSaveErrorMessage } from "@/lib/goalProfile.mjs";
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
  const { getToken, userId, isLoaded } = useAuth();
  // Clerk Expo 2.12 returns a new getToken wrapper every render. It is a
  // credential accessor, not a trigger to reload and overwrite the draft.
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  // Settings already holds these goals, so the page opens with them at once. It reads
  // the server only when they aren't loaded yet, or on Try again.
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
  const savePending = useRef(null);
  const scope = useFormTaskScope(isFixture ? `calmera-goals-fixture:${fixtureMode}` : userId, () => {
    savePending.current = null;
    setLoading(false);
  });
  const leaveEditor = usePageExit(isFixture ? "/form-style-check" : "/dashboard");
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
        let data;
        if (fixtureMode) {
          // Exercise the real loading lifecycle without token/network access.
          data = await new Promise((resolve, reject) => {
            fixtureTimer = setTimeout(() => {
              if (fixtureMode === "ui-goals-error" && loadAttempt === 0) reject(new Error("synthetic_load_failure"));
              else resolve(fixtureMode === "ui-goals-rounded" ? { ...FRACTIONAL_FIXTURE_GOALS }
                : fixtureMode === "ui-goals-unset" ? { calorieGoal: null, proteinGoal: null, carbsGoal: null, fatGoal: null } : { ...FIXTURE_GOALS });
            }, fixtureMode === "ui-goals-slow" ? 10000 : 200);
          });
        } else {
          data = await fetchGoalProfile({ getToken: () => tokenRef.current(),
            url: `${USERS_API_URL}/get-user`, signal: controller.signal,
            isActive: () => active && ownerRef.current === userId });
        }
        if (active && (fixtureMode || ownerRef.current === userId)) {
          setGoals(goalInputs(data));
          setSaved(goalInputs(data));
        }
      } catch (error) {
        if (active && (fixtureMode || ownerRef.current === userId)) setLoadError(error.message === "goals_request_timeout" ? "timeout" : "failed");
      } finally {
        if (active && (fixtureMode || ownerRef.current === userId)) setIsFetching(false);
      }
    };
    load();
    return () => { active = false; controller.abort(); clearTimeout(fixtureTimer); };
  }, [fixtureMode, userId, isLoaded, loadAttempt, cached]);

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
      const body = {
        calorieGoal: goalSaveValue(goals.calorieGoal),
        proteinGoal: goalSaveValue(goals.proteinGoal),
        carbsGoal: goalSaveValue(goals.carbsGoal),
        fatGoal: goalSaveValue(goals.fatGoal),
        localDate: new Date().toLocaleDateString("en-CA"),
      };
      const options = { getToken: () => tokenRef.current(), url: `${USERS_API_URL}/update-user`,
        body, signal: task.signal, isActive: () => task.isCurrent() && (isFixture || currentOwner()) };
      if (exerciseSave) {
        options.url = "https://calmera.invalid/users/update-user";
        options.getToken = async () => "synthetic-token";
        options.fetchImpl = async () => {
          const attempt = ++saveCount.current;
          await new Promise(resolve => setTimeout(resolve, 300));
          const rejected = fixtureMode === "ui-goals-save-error" && attempt === 1;
          return { ok: !rejected, status: rejected ? 400 : 200 };
        };
      }
      await saveGoalProfile(options);
      refreshSavedGoals();
      if (!task.isCurrent() || (!isFixture && !currentOwner())) return;
      // Settings and Today show the new numbers as soon as this page closes, so a tap of
      // success is confirmation enough.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      leaving.current = true;
      leaveEditor();
    } catch (error) {
      if (error.mayHaveSaved) refreshSavedGoals();
      if (task.isCurrent() && (isFixture || currentOwner())) {
        Alert.alert(error.mayHaveSaved ? "Save not confirmed" : "Couldn’t save goals", goalSaveErrorMessage(error));
      }
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
        <SettingsSection label="Daily targets" cardStyle={styles.goalCard}>
          {isFetching ? (
            <View style={styles.loading} accessibilityLiveRegion="polite">
              <ActivityIndicator color={COLORS.primary} />
              <Text style={settingsStyles.footnote}>Loading your goals…</Text>
            </View>
          ) : loadError ? (
            <View style={styles.errorFeedback} accessibilityLiveRegion="polite">
              <Text style={[styles.helpTitle, styles.centeredText]}>Couldn’t load your goals</Text>
              <Text style={[styles.description, styles.centeredText]}>{loadError === "timeout"
                ? "The request took too long. Please try again."
                : "Check your connection and try again."}</Text>
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
            Test goals updated locally. Your account was not changed.
          </Text>
        )}
        <SettingsSection label="Not sure?">
          <SettingsRow title="Suggest my goals" subtitle="A 1-minute survey for calories and macros" icon="sparkles" tint="leaf"
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
