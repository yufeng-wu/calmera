import {
  Text,
  Pressable,
  View,
  Platform,
  UIManager,
  Alert,
  Linking,
  StyleSheet,
  ScrollView,
} from "react-native";
import { memo, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useDailyNutrition } from "../../../hooks/useDailyNutrition";
import NutritionSummarySkeleton from "@/components/NutritionSummarySkeleton";
import { styles } from "@/assets/styles/home.styles";
import { useRouter } from "expo-router";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem, closeOpenMealActions } from "@/components/FoodEntryItem";
import TodayScene, { TodayStageHost } from "@/components/TodayScene";
import { buddyMood, daySeed, emptyTodayGreeting } from "@/lib/nutritionPresentation.mjs";
import FoodwrapWordmark from "@/components/FoodwrapWordmark";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { preloadNutritionModels } from "@/lib/chatgpt/planClient";
import { aiConnection } from "@/lib/ai/mealAI";
import { getVoiceLanguage, inferenceError } from "@/lib/chatgpt/nutrition";
import { speechEngine } from "@/lib/voice/speechEngine";
import { ensureVoicePermission } from "@/lib/voice/voiceLog.mjs";
import AnimatedRe, { useAnimatedStyle } from "react-native-reanimated";
import AddMealMenu from "@/components/AddMealMenu";
import VoiceLogSheet from "@/components/voice/VoiceLogSheet";
import DayDrop, { dayDropLift, useDayDropMotion } from "@/components/DayDrop";
import { parseLocalDate } from "@/lib/calendarMonths.mjs";
import { localDateKey } from "@/lib/nutritionStore.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import FoldAway from "@/components/FoldAway";
import { groupLeaving, rowLeaving, withLeaving, withoutLeaving } from "@/lib/mealLeaving.mjs";

const NO_ENTRIES = [];
const NOT_LEAVING = new Set();

// A deleted meal folds away before it leaves; the last one in a group takes its heading with it.
const MealGroup = memo(function MealGroup({ title, entries, onDelete, leaving, onGone }) {
  if (entries.length === 0) return null;
  const wholeGroup = groupLeaving(entries, leaving);

  return (
    <FoldAway leaving={wholeGroup} onGone={() => onGone(entries.map((item) => item.id))}>
      <View style={styles.mealGroupContainer}>
        <Text style={styles.mealGroupTitle}>{title}</Text>
        {entries.map((item) => (
          <FoldAway key={item.id} leaving={rowLeaving(item.id, leaving, wholeGroup)} onGone={() => onGone([item.id])}>
            <FoodEntryItem item={item} onDelete={onDelete} />
          </FoldAway>
        ))}
      </View>
    </FoldAway>
  );
});

export default function SummaryScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const floatingBarInset = Platform.OS === "ios" ? tabBarHeight : 0;
  const { setShouldRefresh } = useRefreshSignal();
  const [fabExpanded, setFabExpanded] = useState(false);
  // The voice sheet, opened with the user's voice language once access is confirmed.
  const [voice, setVoice] = useState(null);
  const voiceOpening = useRef(false);
  const SCROLL_BOTTOM_PADDING = 116 + floatingBarInset;

  // A past day the user picked; null follows today, including across midnight.
  const [pickedDate, setPickedDate] = useState(null);
  // One Date per day, so the calendar and the meals below don't see a new day on every render.
  const todayKey = localDateKey();
  const selectedDate = useMemo(() => pickedDate ?? new Date(), [pickedDate, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps -- todayKey rolls today over at midnight.
  const isToday = localDateKey(selectedDate) === todayKey;

  const { dateKey, entries, summary, goals, hasData, error: dataError, profileError, goalsLoading, retryError, retrying, isSessionActive, deleteEntry, addEntries,
    profile, dataByDate, historyLoading, historyError, historyPending, retryHistory, loadCalendar } =
    useDailyNutrition(selectedDate);
  // Today's card waits for its goals, so it never rewrites its own numbers when they land a moment later.
  const summaryReady = hasData && !(isToday && goalsLoading);
  const startDate = useMemo(() => profile?.createdAtLocalDate ? parseLocalDate(profile.createdAtLocalDate) : null,
    [profile?.createdAtLocalDate]);

  const stageHost = useRef(null);
  // The page below the calendar slides with its edge as it opens and closes.
  const calendarMotion = useDayDropMotion();
  const belowCalendarStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dayDropLift(calendarMotion) }] }));
  // Meals confirmed for deletion fold away first; each leaves the store (and the totals) once it has folded.
  const [leaving, setLeaving] = useState(NOT_LEAVING);
  const leavingNow = useRef(leaving);
  leavingNow.current = leaving;
  const mealsGone = useCallback((ids) => {
    const going = ids.filter((id) => leavingNow.current.has(id));
    if (!going.length) return;
    leavingNow.current = withoutLeaving(leavingNow.current, going);
    setLeaving((current) => withoutLeaving(current, going));
    going.forEach((id) => deleteEntry(id));
  }, [deleteEntry]);
  const handleDelete = useCallback((id) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this food entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => setLeaving((current) => withLeaving(current, id)),
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
  useFocusEffect(useCallback(() => () => closeMenu(), [closeMenu]));
  const prepareMeal = () => { void preloadNutritionModels(LOCAL_OWNER); };
  const toggleAddMenu = () => {
    if (!fabExpanded) prepareMeal();
    setFabExpanded((value) => !value);
  };
  const collapseFabThenNavigate = (path) => {
    prepareMeal();
    setFabExpanded(false);
    router.push(path);
  };

  // ---------------- Voice Log ----------------
  // A tap opens the voice sheet. iOS is asked for the microphone and speech recognition the first
  // time; if they've been turned off, Settings is the only way back, so offer it.
  const openVoice = async () => {
    if (voiceOpening.current || voice) return;
    voiceOpening.current = true;
    prepareMeal();
    setFabExpanded(false);
    try {
      if (!await aiConnection(LOCAL_OWNER).read()) {
        inferenceError(new Error("ai_connection_required"), router);
        return;
      }
      const speech = speechEngine();
      const access = await ensureVoicePermission(speech).catch(() => "unavailable");
      if (access === "unavailable") {
        Alert.alert("Voice logging unavailable", "This version of calmera can’t listen yet. Use Text or Photo instead.");
        return;
      }
      if (access !== "granted") {
        Alert.alert("Allow microphone and speech", "Voice logging listens on your iPhone to write down what you ate. Turn on Microphone and Speech Recognition for calmera in Settings.", [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => (Platform.OS === "ios" ? Linking.openURL("app-settings:") : Linking.openSettings()).catch(() => {}) },
        ]);
        return;
      }
      const language = await getVoiceLanguage(LOCAL_OWNER, { isActive: isSessionActive }).catch(() => undefined);
      if (!isSessionActive()) return;
      setVoice({ language, key: Date.now() });
    } catch (error) {
      inferenceError(error, router);
    } finally {
      voiceOpening.current = false;
    }
  };
  const closeVoice = useCallback(() => setVoice(null), []);
  const voiceSaved = useCallback((savedEntries) => {
    if (savedEntries?.length) addEntries(savedEntries);
    setShouldRefresh(true);
    setPickedDate(null);
  }, [addEntries, setShouldRefresh]);

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
    ? emptyTodayGreeting(new Date().getHours(), Boolean(startDate) && localDateKey(startDate) === dateKey, seed)
    : { title: "No meals logged", text: "Nothing was logged on this day." };

  return (
    <View style={styles.container}>
      {/* The page's layers change order as the orange drops in front of the page and back. They get a view of
          their own, kept unflattened, so the voice sheet below is never among the views that get reordered:
          a sheet that is taken out and put back closes and reopens, which showed as a flash on save. */}
      <View collapsable={false} style={styles.container}>
      {/* The hill and the seated orange, pinned behind the page (which sits above them at zIndex 1); the scene
          below sends what it shows. */}
      <TodayStageHost ref={stageHost} />
      {/* Always vertical: without it a short day's page doesn't own vertical drags, and a meal row
          swiped open snaps shut on release. */}
      <ScrollView ref={scrollRef} onScrollBeginDrag={closeOpenMealActions} directionalLockEnabled alwaysBounceVertical alwaysBounceHorizontal={false}
        style={[styles.scrollView, { zIndex: 1 }]}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: SCROLL_BOTTOM_PADDING }}
        scrollIndicatorInsets={{ bottom: floatingBarInset }}
      >
        {/* Header and card sit above the scene, whose empty-day sky starts up behind them. */}
        <View style={[styles.headerContainer, { paddingTop: 8, zIndex: 1 }]}>
          <FoodwrapWordmark style={{ marginBottom: 4 }} />
          <DayDrop motion={calendarMotion} selectedDate={selectedDate} isToday={isToday} onSelectDate={selectDate} onToday={goToToday} onOpen={loadCalendar} onClose={scrollToTop}
            dataByDate={dataByDate} calorieGoal={goals.calorieGoal} startDate={startDate} historyLoading={historyLoading}
            historyError={historyError} historyPending={historyPending} onRetryHistory={retryHistory} />
        </View>

        {/* Fills the page so the hill reaches the bottom; the minimum keeps the page from jumping between days while the calendar stays open. */}
        <AnimatedRe.View style={[{ flexGrow: 1, minHeight: 360 }, belowCalendarStyle]}>
        <View style={[styles.headerContainer, { zIndex: 1 }]}>
          {/* A past day without meals has no saved goal to measure against. */}
          {!summaryReady ? <NutritionSummarySkeleton loading={!dataError} />
            : (isToday || entries.length > 0) && <NutritionSummaryCard summary={summary} goals={isToday ? goals : summary.goals || goals} />}
          {(dataError || profileError) && <Pressable onPress={() => retryError().catch(() => {})} disabled={retrying}
            accessibilityRole="button" accessibilityState={{ disabled: retrying, busy: retrying }} style={{ paddingVertical: 10 }}>
            <Text style={styles.macrosText} accessibilityLiveRegion="polite">{retrying ? "Retrying…"
              : dataError ? "Meals couldn’t load. Tap to retry."
                : "Your nutrition goals couldn’t load. Tap to retry."}</Text>
          </Pressable>}
        </View>

        {/* Keyed by day so switching dates swaps meals without spring layout animations.
            Kept unflattened so the meal springs measure from here, not from the page the calendar moves. */}
        <View key={dateKey} collapsable={false} style={styles.sceneContainer}>
          {/* The first meal's drop waits for the voice sheet that saved it to be gone. */}
          {hasData && <TodayScene stageHost={stageHost} hasMeals={entries.length > 0} holdDrop={Boolean(voice)} isToday={isToday} greeting={emptyGreeting} bottomInset={SCROLL_BOTTOM_PADDING}
            mood={mood}>
            {mealOrder.map((meal) => (
              <MealGroup
                key={meal}
                title={meal}
                entries={groupedEntries[meal] || NO_ENTRIES}
                onDelete={handleDelete}
                leaving={leaving}
                onGone={mealsGone}
              />
            ))}
          </TodayScene>}
        </View>
        </AnimatedRe.View>
      </ScrollView>

      {/* Meals always log to today. Above the page, which sits above the pinned scene. */}
      {isToday && <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 3 }]}><AddMealMenu bottomInset={floatingBarInset} expanded={fabExpanded} onToggle={toggleAddMenu}
        onClose={closeMenu} onText={() => collapseFabThenNavigate("/create")}
        onPhoto={() => collapseFabThenNavigate("/photo-log")}
        onVoicePress={openVoice}
        /></View>}
      </View>
      <VoiceLogSheet key={voice?.key} open={Boolean(voice)} language={voice?.language} onClose={closeVoice} onSaved={voiceSaved} />
    </View>
  );
}
