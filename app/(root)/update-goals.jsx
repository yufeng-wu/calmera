import { TYPOGRAPHY } from "@/constants/typography";
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import Constants from "expo-constants";
import { useRouter, useLocalSearchParams } from "expo-router";
import { USERS_API_URL } from "@/constants/api";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { Ionicons } from "@expo/vector-icons";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { useAuth } from "@clerk/clerk-expo";
import { FormHeader, FormCard, GlassButton } from "@/components/GlassForm";
import GoalSliderRow from "@/components/GoalSliderRow";
import { goalInputValue, goalSaveValue } from "@/lib/goalSlider.mjs";
import { fetchGoalProfile, saveGoalProfile } from "@/lib/goalProfile.mjs";

const EMPTY_GOALS = { calorieGoal: "", proteinGoal: "", carbsGoal: "", fatGoal: "" };
const FIXTURE_GOALS = { calorieGoal: "2000", proteinGoal: "150", carbsGoal: "200", fatGoal: "50" };
const FRACTIONAL_FIXTURE_GOALS = { calorieGoal: 2425.6, proteinGoal: 50.25, carbsGoal: 290.75, fatGoal: 88.1 };
const GOAL_FIELDS = [
  { key: "calorieGoal", label: "Calories", unit: "kcal", maximum: 5000, rangeIncrement: 500, step: 25 },
  { key: "proteinGoal", label: "Protein", unit: "g", maximum: 300, rangeIncrement: 50, step: 1 },
  { key: "carbsGoal", label: "Carbs", unit: "g", maximum: 600, rangeIncrement: 100, step: 1 },
  { key: "fatGoal", label: "Fat", unit: "g", maximum: 200, rangeIncrement: 25, step: 1 },
];

export default function UpdateGoals() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const params = useLocalSearchParams();
  const isFixture = Constants.expoConfig?.extra?.calmeraFullAppTest === true
    && ["ui-goals", "ui-goals-load", "ui-goals-error", "ui-goals-rounded", "ui-goals-save", "ui-goals-save-error", "ui-goals-slow"].includes(params.calmeraFixture);
  const fixtureMode = isFixture ? params.calmeraFixture : null;
  const { setShouldRefresh, setShouldRefreshGoals } = useRefreshSignal();
  const { getToken, userId, isLoaded } = useAuth();
  // Clerk Expo 2.12 returns a new getToken wrapper every render. It is a
  // credential accessor, not a trigger to reload and overwrite the draft.
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const [goals, setGoals] = useState(isFixture ? FIXTURE_GOALS : EMPTY_GOALS);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!isFixture);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loadCount = useRef(0);
  const saveCount = useRef(0);
  const savePending = useRef(false);
  const saveController = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; saveController.current?.abort(); };
  }, []);
  const leaveEditor = () => {
    if (router.canGoBack()) router.back();
    else router.replace(isFixture ? "/form-style-check" : "/dashboard");
  };
  const [fixtureSaved, setFixtureSaved] = useState(false);
  const hasAnimated = useRef(false);

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
      setIsFetching(false);
      setLoadError(false);
      setFixtureSaved(false);
      return;
    }
    if (!isLoaded || !userId) return;
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
              else resolve(fixtureMode === "ui-goals-rounded" ? { ...FRACTIONAL_FIXTURE_GOALS } : { ...FIXTURE_GOALS });
            }, fixtureMode === "ui-goals-slow" ? 10000 : 200);
          });
        } else {
          data = await fetchGoalProfile({ getToken: () => tokenRef.current(),
            url: `${USERS_API_URL}/get-user`, signal: controller.signal });
        }
        if (active) setGoals({
          calorieGoal: goalInputValue(data.calorieGoal),
          proteinGoal: goalInputValue(data.proteinGoal),
          carbsGoal: goalInputValue(data.carbsGoal),
          fatGoal: goalInputValue(data.fatGoal),
        });
      } catch (error) {
        if (active) setLoadError(error.message === "goals_request_timeout" ? "timeout" : "failed");
      } finally {
        if (active) setIsFetching(false);
      }
    };
    load();
    return () => { active = false; controller.abort(); clearTimeout(fixtureTimer); };
  }, [fixtureMode, userId, isLoaded, loadAttempt]);

  const handleChange = (field, value) => {
    const sanitized = goalInputValue(value);
    setFixtureSaved(false);
    setGoals((prev) => ({ ...prev, [field]: sanitized }));
  };

  const handleSave = async () => {
    if (savePending.current || loading || isFetching || loadError) return;
    if (Object.values(goals).some((value) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
      Alert.alert("Check your goals", "Please enter a valid amount of zero or more for each goal.");
      return;
    }
    // QA uses the real editor, but cannot read or update the user's profile.
    const exerciseSave = isFixture && ["ui-goals-save", "ui-goals-save-error"].includes(fixtureMode);
    if (isFixture && !exerciseSave) {
      setFixtureSaved(true);
      return;
    }
    savePending.current = true;
    saveController.current = new AbortController();
    setLoading(true);
    try {
      const body = {
        calorieGoal: goalSaveValue(goals.calorieGoal),
        proteinGoal: goalSaveValue(goals.proteinGoal),
        carbsGoal: goalSaveValue(goals.carbsGoal),
        fatGoal: goalSaveValue(goals.fatGoal),
        localDate: new Date().toLocaleDateString("en-CA"),
      };
      const options = { getToken: () => tokenRef.current(), url: `${USERS_API_URL}/update-user`,
        body, signal: saveController.current.signal };
      if (exerciseSave) {
        options.getToken = async () => "synthetic-token";
        options.fetchImpl = async () => {
          saveCount.current += 1;
          await new Promise(resolve => setTimeout(resolve, 300));
          return { ok: fixtureMode !== "ui-goals-save-error" || saveCount.current > 1 };
        };
      }
      await saveGoalProfile(options);
      if (!mounted.current) return;
      Alert.alert("Success", "Goals updated successfully", [{
        text: "OK",
        onPress: () => {
          if (!isFixture) {
            setShouldRefresh(true);
            setShouldRefreshGoals(true);
          }
          leaveEditor();
        },
      }]);
    } catch (e) {
      if (mounted.current) Alert.alert("Couldn’t save goals", e.message === "goals_request_timeout"
        ? "The request took too long. Your changes are still here; please try again."
        : "Your changes are still here. Please try saving again.");
    } finally {
      savePending.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <FormHeader
        title="Edit Goals"
        onBack={leaveEditor}
        onSave={handleSave}
        saving={loading}
        saveDisabled={isFetching || Boolean(loadError)}
        backDisabled={loading}
      />
      <ScrollView
        // Re-measure RN text after a live Dynamic Type change; keep draft state
        // in this screen so remounting the scroll content never reloads goals.
        key={`goals-text-${fontScale}`}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={styles.eyebrow}>DAILY TARGETS</Text>
        <Text style={styles.description}>Adjust your daily goals with the sliders.</Text>
        <FormCard style={styles.goalCard}>
          {isFetching ? (
            <View style={styles.loading} accessibilityLiveRegion="polite">
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.description}>Loading your goals…</Text>
            </View>
          ) : loadError ? (
            <View style={styles.loading} accessibilityLiveRegion="polite">
              <Text style={styles.helpTitle}>Couldn’t load your goals</Text>
              <Text style={styles.description}>{loadError === "timeout"
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
        </FormCard>
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
        <FormCard style={styles.helpCard}>
          <View style={styles.helpHeading}>
            <Ionicons name="sparkles" size={19} color={COLORS.primary} />
            <Text style={styles.helpTitle}>Need some help?</Text>
          </View>
          <Text style={styles.helpDescription}>
            Take a 1-minute survey for suggested calories and macros.
          </Text>
          <GlassButton
            title="Take the survey"
            symbol="arrow.right"
            onPress={() => {
              if (isFixture) {
                Alert.alert("Isolated UI test", "The survey is available in the normal app. This test stays local and does not open your profile or change your goals.");
                return;
              }
              router.push("/goals-survey");
            }}
            disabled={loading || isFetching}
            style={styles.surveyButton}
            accessibilityLabel="Take the goals survey"
          />
        </FormCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 12 },
  eyebrow: { ...TYPOGRAPHY.eyebrow, color: COLORS.textLight,},
  description: { ...TYPOGRAPHY.body, color: COLORS.textLight,},
  goalCard: { paddingHorizontal: 18, paddingVertical: 6, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#EDE6DF" },
  loading: { minHeight: 280, alignItems: "center", justifyContent: "center", gap: 14 },
  helpCard: { padding: 18, gap: 12 },
  helpHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  helpTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text,},
  helpDescription: { ...TYPOGRAPHY.body, color: COLORS.textLight,},
  surveyButton: { minHeight: 46, alignSelf: "stretch" },
  fixtureStatus: { ...TYPOGRAPHY.caption, color: COLORS.primary,},
});
