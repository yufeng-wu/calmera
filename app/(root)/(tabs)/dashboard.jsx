import { useUser, useAuth } from "@clerk/clerk-expo";
import {
  Text,
  Pressable,
  View,
  Platform,
  UIManager,
  Alert,
  Animated,
  Easing,
  Dimensions,
  Linking,
  StyleSheet,
} from "react-native";
import { memo, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useDailyNutrition } from "../../../hooks/useDailyNutrition";
import NutritionSummarySkeleton from "@/components/NutritionSummarySkeleton";
import { styles } from "@/assets/styles/home.styles";
import { useRouter } from "expo-router";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem, closeOpenMealActions } from "@/components/FoodEntryItem";
import TodayScene, { TodayStageHost } from "@/components/TodayScene";
import { buddyMood, daySeed, emptyTodayGreeting } from "@/lib/nutritionPresentation.mjs";
import FoodwrapRefreshScrollView from "@/components/FoodwrapRefreshScrollView";
import FoodwrapWordmark from "@/components/FoodwrapWordmark";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { Audio } from "expo-av";
import Constants from "expo-constants";
import { processRecordedMeal } from "@/lib/chatgpt/voiceCapture.mjs";
import { voiceFeedbackDiagnostics } from "@/lib/chatgpt/voiceFeedbackDiagnostics.mjs";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { createPlanClient, preloadNutritionModels } from "@/lib/chatgpt/planClient";
import { nutritionClient, transcribeMealAudio, voiceClipMetadata, getVoiceLanguage, inferenceError } from "@/lib/chatgpt/nutrition";
import { mealTimePreferences } from "@/lib/mealTimeSettings";
import { estimateVoiceMeal } from "@/lib/chatgpt/mealTimeEstimate.mjs";
import { saveEstimatedEntries } from "@/lib/chatgpt/entryPersistence.mjs";
import { getLocalTimeWithOffset } from "@/lib/utils";
import AnimatedRe, { Layout as ReLayout, useAnimatedStyle } from "react-native-reanimated";
import AddMealMenu, { ADD_MENU_OPTION_WIDTH } from "@/components/AddMealMenu";
import DayDrop, { dayDropLift, useDayDropMotion } from "@/components/DayDrop";
import { parseLocalDate } from "@/lib/calendarMonths.mjs";
import { localDateKey } from "@/lib/nutritionStore.mjs";

const AnimatedMealGroupContainer = AnimatedRe.createAnimatedComponent(View);

// Only while a meal is being removed, so what's below springs up to fill its place. The rest of the time the groups
// have no layout animation: a row opening moves the page every frame, and a spring restarted that often only trails.
const MEAL_LAYOUT = ReLayout.springify().damping(15);
const MEAL_SPRING_MS = 900;
const NO_ENTRIES = [];

const MealGroup = memo(function MealGroup({ title, entries, onDelete, springs }) {
  if (entries.length === 0) return null;

  return (
    <AnimatedMealGroupContainer
      style={styles.mealGroupContainer}
      layout={springs ? MEAL_LAYOUT : undefined}
    >
      <Text style={styles.mealGroupTitle}>{title}</Text>
      {entries.map((item) => (
        <FoodEntryItem key={item.id} item={item} onDelete={onDelete} />
      ))}
    </AnimatedMealGroupContainer>
  );
});

export default function SummaryScreen() {
  const isFocused = useIsFocused();
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const floatingBarInset = Platform.OS === "ios" ? tabBarHeight : 0;
  const { setShouldRefresh } = useRefreshSignal();
  const [fabExpanded, setFabExpanded] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const longPressTriggered = useRef(false);
  const INITIAL_VOICE_WIDTH = ADD_MENU_OPTION_WIDTH;
  const voiceWidthAnim = useRef(
    new Animated.Value(INITIAL_VOICE_WIDTH)
  ).current;
  // No translation needed; button is anchored to right so it grows leftwards


  const timerRef = useRef(null);
  const recordingRef = useRef(null);
  const recordingAttemptRef = useRef(0);
  const recorderReadyRef = useRef(false);
  const recordingStartedAtRef = useRef(null);
  const voiceBusyRef = useRef(false);
  const processingRef = useRef(false);
  // Flag to request an early stop when the user lifts finger before the recorder is ready
  const stopRequestedRef = useRef(false);
  // Animation refs to cancel queued animations cleanly
  const voicePhase1AnimRef = useRef(null);
  const voiceGrowAnimRef = useRef(null);
  const SCROLL_BOTTOM_PADDING = 116 + floatingBarInset;

  // A past day the user picked; null follows today, including across midnight.
  const [pickedDate, setPickedDate] = useState(null);
  // One Date per day, so the calendar and the meals below don't see a new day on every render.
  const todayKey = localDateKey();
  const selectedDate = useMemo(() => pickedDate ?? new Date(), [pickedDate, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps -- todayKey rolls today over at midnight.
  const isToday = localDateKey(selectedDate) === todayKey;

  // user.id comes from Clerk
  const { dateKey, entries, summary, goals, hasData, error: dataError, profileError, refreshFailed, goalsLoading, retryError, retrying, isSessionActive, loadData, deleteEntry, addEntries,
    profile, dataByDate, historyLoading, historyError, historyPending, retryHistory, loadCalendar } =
    useDailyNutrition(selectedDate);
  // Today's card waits for its goals, so it never rewrites its own numbers when they land a moment later.
  const summaryReady = hasData && !(isToday && goalsLoading);
  const signUpDate = useMemo(() => profile?.createdAtLocalDate ? parseLocalDate(profile.createdAtLocalDate) : null,
    [profile?.createdAtLocalDate]);

  const stageHost = useRef(null);
  // The page below the calendar slides with its edge as it opens and closes.
  const calendarMotion = useDayDropMotion();
  const belowCalendarStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dayDropLift(calendarMotion) }] }));
  const [mealsSpring, setMealsSpring] = useState(false);
  const springEnds = useRef(null);
  useEffect(() => () => clearTimeout(springEnds.current), []);
  // Removed only once the spring has been committed, so the page always has it when it changes.
  const [pendingDelete, setPendingDelete] = useState(null);
  useEffect(() => {
    if (!pendingDelete || !mealsSpring) return;
    setPendingDelete(null);
    deleteEntry(pendingDelete);
  }, [pendingDelete, mealsSpring, deleteEntry]);
  const handleDelete = useCallback((id) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this food entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setMealsSpring(true);
            setPendingDelete(id);
            clearTimeout(springEnds.current);
            springEnds.current = setTimeout(() => setMealsSpring(false), MEAL_SPRING_MS);
          },
        },
      ]
    );
  }, []);

  useEffect(() => {
    // Enable LayoutAnimation on Android
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const closeMenu = useCallback(() => setFabExpanded(false), []);
  const selectDate = useCallback((date) => {
    closeMenu();
    closeOpenMealActions();
    setPickedDate(localDateKey(date) === localDateKey() ? null : date);
  }, [closeMenu]);
  const goToToday = useCallback(() => setPickedDate(null), []);
  // Closing shortens the page, so leave the scrolled position before it clamps.
  const scrollRef = useRef(null);
  const scrollToTop = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []);
  useFocusEffect(useCallback(() => () => {
    closeMenu();
    recordingAttemptRef.current += 1;
    if (!processingRef.current) voiceBusyRef.current = false;
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (rec && recorderReadyRef.current) rec.stopAndUnloadAsync().catch(() => {});
    recorderReadyRef.current = false;
    stopRequestedRef.current = false;
    setRecording(null);
    if (timerRef.current) clearInterval(timerRef.current);
    voicePhase1AnimRef.current?.stop();
    voiceGrowAnimRef.current?.stop();
  }, [closeMenu]));
  const prepareMeal = () => { void preloadNutritionModels(user?.id); };
  const toggleAddMenu = () => {
    if (!fabExpanded) prepareMeal();
    setFabExpanded((value) => !value);
  };
  const collapseFabThenNavigate = (path) => {
    prepareMeal();
    setFabExpanded(false);
    router.push(path);
  };

  // ---------------- Voice Log handlers ----------------
  const markVoice = (code, duration) => {
    if (Constants.expoConfig?.extra?.calmeraFullAppTest === true) voiceFeedbackDiagnostics.mark(code, duration);
  };
  const stopVoiceAnimations = () => {
    voicePhase1AnimRef.current?.stop();
    voiceGrowAnimRef.current?.stop();
    voiceWidthAnim.stopAnimation();
    Animated.timing(voiceWidthAnim, { toValue: ADD_MENU_OPTION_WIDTH, duration: 280, useNativeDriver: false }).start();
  };
  const showProcessing = () => {
    setRecording(null);
    setAnalyzing(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecordingSeconds(0);
    stopVoiceAnimations();
  };
  const shortRecording = () => Alert.alert("Nothing recorded yet", "Hold Voice until the timer starts, describe your meal, then release.");

  const stopRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    showProcessing();
    if (!recorderReadyRef.current) { stopRequestedRef.current = true; return; }
    // Claim this recorder once, including a release racing the 30-second limit.
    recordingRef.current = null;
    recorderReadyRef.current = false;
    processingRef.current = true;
    try {
      const recordedAt = recordingStartedAtRef.current || new Date();
      const createdAt = getLocalTimeWithOffset();
      const savedEntries = await processRecordedMeal({
        recording: rec, isActive: isSessionActive,
        onStage: (stage) => markVoice(stage), onDuration: (duration) => markVoice("duration", duration),
        inspectClip: voiceClipMetadata, onFileDuration: (duration) => markVoice("file_duration", duration),
        transcribe: async (uri) => {
          const language = await getVoiceLanguage(user.id, { isActive: isSessionActive });
          if (!isSessionActive()) throw new Error("voice_operation_cancelled");
          return transcribeMealAudio(uri, language);
        },
        estimate: transcript => estimateVoiceMeal({ userId: user.id, transcript, recordedAt,
          isActive: isSessionActive, loadMealTimes: (owner, options) => mealTimePreferences.load(owner, options),
          getNutritionClient: nutritionClient }),
        save: (entries) => saveEstimatedEntries(entries, {
          createdAt, getToken: async () => {
            const token = await getToken();
            return isSessionActive() ? token : null;
          }, url: FOOD_ENTRIES_API_URL, isActive: isSessionActive,
        }),
      });
      if (savedEntries && isSessionActive()) {
        addEntries(savedEntries);
        setShouldRefresh(true);
        setFabExpanded(false);
        setPickedDate(null);
      }
    } catch (error) {
      markVoice(error.message === "voice_clip_too_short" ? "too_short" : "failed");
      if (isSessionActive()) {
        if (error.message === "voice_clip_too_short") shortRecording();
        else {
          if (error.savedEntries?.length) { addEntries(error.savedEntries); setShouldRefresh(true); }
          inferenceError(error, router);
        }
      }
    } finally {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      setRecording(null);
      setAnalyzing(false);
      processingRef.current = false;
      voiceBusyRef.current = false;
      stopRequestedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      markVoice("idle");
    }
  };

  const startRecording = async () => {
    const attempt = ++recordingAttemptRef.current;
    let rec;
    let started = false;
    try {
      if (!await createPlanClient(user.id).connected()) {
        inferenceError(new Error("chatgpt_sign_in_required"), router);
        return;
      }
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Microphone Access Required", "To use voice logging, please grant microphone permission in your device settings.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Platform.OS === "ios" ? Linking.openURL("app-settings:") : Linking.openSettings() },
        ]);
        return;
      }
      if (attempt !== recordingAttemptRef.current || !isSessionActive()) return;
      if (stopRequestedRef.current) { markVoice("too_short"); shortRecording(); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      if (attempt !== recordingAttemptRef.current) return;
      rec = new Audio.Recording();
      recorderReadyRef.current = false;
      recordingRef.current = rec;
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      if (attempt !== recordingAttemptRef.current) return;
      if (stopRequestedRef.current) { markVoice("too_short"); shortRecording(); return; }
      recordingStartedAtRef.current = new Date();
      await rec.startAsync();
      if (attempt !== recordingAttemptRef.current) return;
      started = true;
      recorderReadyRef.current = true;
      markVoice("recording");
      // A release during native startup still gets immediate Processing feedback.
      if (stopRequestedRef.current) { await stopRecording(); return; }
      setRecording(rec);
      setRecordingSeconds(0);
      voiceWidthAnim.setValue(ADD_MENU_OPTION_WIDTH);
      const phase1 = Animated.timing(voiceWidthAnim, {
        toValue: ADD_MENU_OPTION_WIDTH + 40, duration: 200, useNativeDriver: false,
      });
      voicePhase1AnimRef.current = phase1;
      phase1.start(({ finished }) => {
        if (!finished || stopRequestedRef.current || recordingRef.current !== rec) return;
        const grow = Animated.timing(voiceWidthAnim, {
          toValue: Dimensions.get("window").width * 0.7, duration: 30000,
          easing: Easing.out(Easing.quad), useNativeDriver: false,
        });
        voiceGrowAnimRef.current = grow;
        grow.start();
      });
      timerRef.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
      setTimeout(() => { if (recordingRef.current === rec) stopRecording(); }, 30000);
    } catch {
      markVoice("failed");
      if (attempt === recordingAttemptRef.current) Alert.alert("Voice recording unavailable", "The recorder could not start. Please try again.");
    } finally {
      if (!started) {
        if (rec) await rec.stopAndUnloadAsync().catch(() => {});
        if (attempt === recordingAttemptRef.current) {
          recordingRef.current = null;
          recorderReadyRef.current = false;
          voiceBusyRef.current = false;
          stopRequestedRef.current = false;
          setRecording(null);
          setAnalyzing(false);
          stopVoiceAnimations();
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
          markVoice("idle");
        }
      }
    }
  };

  const handleVoiceShortPress = () => {
    if (voiceBusyRef.current || longPressTriggered.current) return;
    prepareMeal();
    Alert.alert("Log a meal by voice", 'Hold Voice until the timer starts, describe your meal, then release. For example: “A 16-ounce latte for breakfast.”');
  };
  const handleVoiceLongPress = () => {
    if (voiceBusyRef.current) return;
    prepareMeal();
    voiceBusyRef.current = true;
    stopRequestedRef.current = false;
    longPressTriggered.current = true;
    markVoice("starting");
    startRecording();
  };
  const handleVoicePressOut = () => {
    if (!longPressTriggered.current) return;
    longPressTriggered.current = false;
    if (!voiceBusyRef.current) return; // The automatic time limit may have already completed.
    stopRequestedRef.current = true;
    markVoice("released");
    showProcessing();
    if (recordingRef.current) stopRecording();
  };

  const groupedEntries = useMemo(() => entries.reduce((acc, entry) => {
    const meal = entry.mealType;
    if (!acc[meal]) {
      acc[meal] = [];
    }
    acc[meal].push(entry);
    return acc;
  }, {}), [entries]);

  const mealOrder = ["Breakfast", "Lunch", "Dinner", "Snack"];
  // The orange's mood, by this day's calories against that day's goal.
  const seed = daySeed(selectedDate);
  const dayGoals = isToday ? goals : summary.goals || goals;
  const mood = !entries.length ? (isToday ? "awake" : "asleep")
    : buddyMood({ calories: Number(summary.calories ?? summary.dailyTotals?.calories ?? 0), goal: dayGoals.calorieGoal, loggedMeals: Object.keys(groupedEntries) });
  const emptyGreeting = entries.length ? null : isToday
    ? emptyTodayGreeting(new Date().getHours(), Boolean(signUpDate) && localDateKey(signUpDate) === dateKey, seed)
    : { title: "No meals logged", text: "Nothing was logged on this day." };

  return (
    <View style={styles.container}>
      {/* The hill and the seated orange, pinned behind the page (which sits above them at zIndex 1); the scene
          below sends what it shows. */}
      <TodayStageHost ref={stageHost} />
      <FoodwrapRefreshScrollView scrollRef={scrollRef} active={isFocused} onRefresh={loadData} onScrollBeginDrag={closeOpenMealActions} directionalLockEnabled alwaysBounceHorizontal={false}
        style={[styles.scrollView, { zIndex: 1 }]}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: SCROLL_BOTTOM_PADDING }}
        scrollIndicatorInsets={{ bottom: floatingBarInset }}
      >
        {/* Header and card sit above the scene, whose empty-day sky starts up behind them. */}
        <View style={[styles.headerContainer, { paddingTop: 8, zIndex: 1 }]}>
          <FoodwrapWordmark style={{ marginBottom: 4 }} />
          <DayDrop motion={calendarMotion} selectedDate={selectedDate} isToday={isToday} onSelectDate={selectDate} onToday={goToToday} onOpen={loadCalendar} onClose={scrollToTop}
            dataByDate={dataByDate} calorieGoal={goals.calorieGoal} signUpDate={signUpDate} historyLoading={historyLoading}
            historyError={historyError} historyPending={historyPending} onRetryHistory={retryHistory} />
        </View>

        {/* Fills the page so the hill reaches the bottom; the minimum keeps the page from jumping between days while the calendar stays open. */}
        <AnimatedRe.View style={[{ flexGrow: 1, minHeight: 360 }, belowCalendarStyle]}>
        <View style={[styles.headerContainer, { zIndex: 1 }]}>
          {/* A past day without meals has no saved goal to measure against. */}
          {!summaryReady ? <NutritionSummarySkeleton loading={!dataError} />
            : (isToday || entries.length > 0) && <NutritionSummaryCard summary={summary} goals={isToday ? goals : summary.goals || goals} />}
          {(dataError || profileError || refreshFailed) && <Pressable onPress={() => (dataError || profileError ? retryError() : loadData()).catch(() => {})} disabled={retrying}
            accessibilityRole="button" accessibilityState={{ disabled: retrying, busy: retrying }} style={{ paddingVertical: 10 }}>
            <Text style={styles.macrosText} accessibilityLiveRegion="polite">{retrying ? "Retrying…"
              : dataError ? "Meals couldn’t load. Tap to retry."
                : profileError ? "Your nutrition goals couldn’t load. Tap to retry." : "Couldn’t refresh. Tap to retry."}</Text>
          </Pressable>}
        </View>

        {/* Keyed by day so switching dates swaps meals without spring layout animations.
            Kept unflattened so the meal springs measure from here, not from the page the calendar moves. */}
        <View key={dateKey} collapsable={false} style={styles.sceneContainer}>
          {hasData && <TodayScene stageHost={stageHost} hasMeals={entries.length > 0} isToday={isToday} printSeed={seed} greeting={emptyGreeting} bottomInset={SCROLL_BOTTOM_PADDING}
            mood={mood}>
            {mealOrder.map((meal) => (
              <MealGroup
                key={meal}
                title={meal}
                entries={groupedEntries[meal] || NO_ENTRIES}
                onDelete={handleDelete}
                springs={mealsSpring}
              />
            ))}
          </TodayScene>}
        </View>
        </AnimatedRe.View>
      </FoodwrapRefreshScrollView>

      {/* Meals always log to today. A voice meal still in progress keeps its status visible. */}
      {/* Above the page, which sits above the pinned scene. */}
      {(isToday || recording || analyzing) && <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 3 }]}><AddMealMenu bottomInset={floatingBarInset} expanded={fabExpanded} onToggle={toggleAddMenu}
        onClose={closeMenu} onText={() => collapseFabThenNavigate("/create")}
        onPhoto={() => collapseFabThenNavigate("/photo-log")}
        onVoicePress={handleVoiceShortPress} onVoiceLongPress={handleVoiceLongPress}
        onVoicePressOut={handleVoicePressOut} recording={Boolean(recording)}
        seconds={recordingSeconds} analyzing={analyzing} voiceWidth={voiceWidthAnim}
        /></View>}
    </View>
  );
}
