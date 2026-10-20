import { useUser, useAuth } from "@clerk/clerk-expo";
import {
  Text,
  ActivityIndicator,
  Pressable,
  View,
  Platform,
  UIManager,
  ScrollView,
  RefreshControl,
  Alert,
  Animated,
  Easing,
  Dimensions,
  Linking,
} from "react-native";
import { useEffect, useState, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useDailyNutrition } from "../../../hooks/useDailyNutrition";
import NutritionSummarySkeleton from "@/components/NutritionSummarySkeleton";
import { styles } from "@/assets/styles/home.styles";
import { useRouter } from "expo-router";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem, closeOpenMealActions } from "@/components/FoodEntryItem";
import NoRecordYet from "@/components/NoRecordYet";
import FoodwrapWordmark from "@/components/FoodwrapWordmark";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { Audio } from "expo-av";
import Constants from "expo-constants";
import { processRecordedMeal } from "@/lib/chatgpt/voiceCapture.mjs";
import { voiceFeedbackDiagnostics } from "@/lib/chatgpt/voiceFeedbackDiagnostics.mjs";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { createPlanClient } from "@/lib/chatgpt/planClient";
import { nutritionClient, transcribeMealAudio, voiceClipMetadata, getVoiceLanguage, inferenceError } from "@/lib/chatgpt/nutrition";
import { mealTimePreferences } from "@/lib/mealTimeSettings";
import { estimateVoiceMeal } from "@/lib/chatgpt/mealTimeEstimate.mjs";
import { saveEstimatedEntries } from "@/lib/chatgpt/entryPersistence.mjs";
import { getLocalTimeWithOffset } from "@/lib/utils";
import AnimatedRe, { Layout as ReLayout } from "react-native-reanimated";
import { COLORS } from "@/constants/colors";
import AddMealMenu, { ADD_MENU_OPTION_WIDTH } from "@/components/AddMealMenu";

const AnimatedMealGroupContainer = AnimatedRe.createAnimatedComponent(View);

const MealGroup = ({ title, entries, onDelete }) => {
  if (entries.length === 0) return null;

  return (
    <AnimatedMealGroupContainer
      style={styles.mealGroupContainer}
      layout={ReLayout.springify().damping(15)}
    >
      <Text style={styles.mealGroupTitle}>{title}</Text>
      {entries.map((item) => (
        <FoodEntryItem key={item.id} item={item} onDelete={onDelete} />
      ))}
    </AnimatedMealGroupContainer>
  );
};

export default function SummaryScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const floatingBarInset = Platform.OS === "ios" ? tabBarHeight : 0;
  const [refreshing, setRefreshing] = useState(false);
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

  // user.id comes from Clerk
  const { entries, summary, goals, hasData, error: dataError, profileError, retryError, isSessionActive, isLoading, loadData, deleteEntry, addEntries } =
    useDailyNutrition();

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadData(); } catch {} finally { setRefreshing(false); }
  };

  const handleDelete = (id) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this food entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteEntry(id),
        },
      ]
    );
  };

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
  const collapseFabThenNavigate = (path) => {
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
    Alert.alert("Log a meal by voice", 'Hold Voice until the timer starts, describe your meal, then release. For example: “A 16-ounce latte for breakfast.”');
  };
  const handleVoiceLongPress = () => {
    if (voiceBusyRef.current) return;
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

  const groupedEntries = entries.reduce((acc, entry) => {
    const meal = entry.mealType;
    if (!acc[meal]) {
      acc[meal] = [];
    }
    acc[meal].push(entry);
    return acc;
  }, {});

  const mealOrder = ["Breakfast", "Lunch", "Dinner", "Snack"];

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return (
    <View style={styles.container}>
      <ScrollView onScrollBeginDrag={closeOpenMealActions} directionalLockEnabled alwaysBounceHorizontal={false}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
        scrollIndicatorInsets={{ bottom: floatingBarInset }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={[styles.headerContainer, { paddingTop: 12 }]}>
          <FoodwrapWordmark style={{ marginBottom: 16 }} />
          <Text style={styles.dateText}>{formattedDate}</Text>
          {hasData ? <NutritionSummaryCard summary={summary} goals={goals} /> : <NutritionSummarySkeleton loading={isLoading} />}
          {(dataError || profileError) && <Pressable onPress={() => retryError().catch(() => {})} accessibilityRole="button" style={{ paddingVertical: 10 }}>
            <Text style={styles.macrosText}>{dataError ? "Meals couldn’t refresh. Tap to retry." : "Your nutrition goals couldn’t refresh. Tap to retry."}</Text>
          </Pressable>}
        </View>

        <View style={styles.transactionsContainer}>
          {isLoading ? <View style={{ padding: 20, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.macrosText}>Getting your meals…</Text>
          </View> : dataError && !hasData ? null : entries.length > 0 ? (
            mealOrder.map((meal) => (
              <MealGroup
                key={meal}
                title={meal}
                entries={groupedEntries[meal] || []}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <NoRecordYet />
          )}
        </View>
      </ScrollView>

      <AddMealMenu bottomInset={floatingBarInset} expanded={fabExpanded} onToggle={() => setFabExpanded((value) => !value)}
        onClose={closeMenu} onText={() => collapseFabThenNavigate("/create")}
        onPhoto={() => collapseFabThenNavigate("/photo-log")}
        onVoicePress={handleVoiceShortPress} onVoiceLongPress={handleVoiceLongPress}
        onVoicePressOut={handleVoicePressOut} recording={Boolean(recording)}
        seconds={recordingSeconds} analyzing={analyzing} voiceWidth={voiceWidthAnim}
        />
    </View>
  );
}
