import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Keyboard, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Animated, { Easing, FadeIn, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue,
  withRepeat, withSequence, withSpring, withTiming, Extrapolation, cancelAnimation } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import GlassSurface from "@/components/GlassSurface";
import { GlassButton } from "@/components/GlassForm";
import MealReview from "@/components/meals/MealReview";
import CitrusBuddy from "@/components/brand/CitrusBuddy";
import VoiceWave from "@/components/voice/VoiceWave";
import VoiceThinking from "@/components/voice/VoiceThinking";
import useLiveSpeech from "@/hooks/useLiveSpeech";
import useVoiceKeyboardHeight from "@/hooks/useVoiceKeyboardHeight";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { useDataStore } from "@/lib/store";
import { estimateMacros, inferenceError } from "@/lib/chatgpt/nutrition";
import { mealAI } from "@/lib/ai/mealAI";
import { createMealReview, reviewTotals, saveMealReview, updateReviewFood } from "@/lib/meals/mealReview.mjs";
import { getLocalTimeWithOffset } from "@/lib/utils";
import { formatElapsed, voiceHint, VOICE_LIMIT_MS } from "@/lib/voice/voiceLog.mjs";

const INSET = 8;
const RADIUS = 40;
// The transcript's padding above and below its words.
const WORDS_PADDING = 8;
const SPRING = { damping: 22, stiffness: 190, mass: 0.9 };
const SHOW = { duration: 380, easing: Easing.bezier(0.32, 0.72, 0, 1) };
const HIDE = { duration: 240, easing: Easing.bezier(0.32, 0.72, 0, 1) };
const PHASES = { listen: 0, thinking: 1, review: 2, saved: 3 };
// The glass stays clear while listening and fills with cream as there's more to read.
const TINT = [0.28, 0.6, 0.95, 0.7];
const haptic = run => { run().catch(() => {}); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const SAVED_HOLD_MS = 900;
let hintSeed = Math.floor(Math.random() * 100);

const NOTICES = {
  "no-speech": "Didn’t catch anything. Tap Resume and try again.",
  stopped: "Listening paused. Your words are kept — Resume or send.",
  limit: "That’s the one-minute limit. Send it, or tap the words to edit.",
  "no-food": "No food in that. Try naming what you ate.",
  empty: "Say what you ate first.",
  "not-allowed": "Microphone or Speech Recognition is off for calmera.",
  "language-not-supported": "Voice logging isn’t available in your voice language on this phone. Try another in Settings.",
  "service-not-allowed": "Voice logging isn’t available in your voice language on this phone. Try another in Settings.",
};

// The voice log: a Liquid Glass sheet over Today. It listens as soon as it opens, shows the words
// as they're heard over a wave that follows the voice, then on Send grows to show the estimate
// and the review, the same one Text and Photo logs end in.
export default function VoiceLogSheet({ open, ...props }) {
  if (!open) return null;
  return <VoiceSheet {...props} />;
}

function VoiceSheet({ language, onClose, onSaved }) {
  const { height: screenHeight } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const userId = LOCAL_OWNER;
  const data = useDataStore();
  const { rememberIcons } = useFoodIcons();
  const level = useSharedValue(0);
  const onLevel = useCallback(value => { level.value = withTiming(value, { duration: 70 }); }, [level]);
  const speech = useLiveSpeech({ language, onLevel });
  const [phase, setPhase] = useState("listen");
  const [editingWords, setEditingWords] = useState(false);
  const [notice, setNotice] = useState(null);
  const [stage, setStage] = useState("sending");
  const [model, setModel] = useState(null);
  const [aiType, setAiType] = useState(null);
  const [estimateDone, setEstimateDone] = useState(false);
  const [sentText, setSentText] = useState("");
  const [review, setReview] = useState(null);
  const [estimatingId, setEstimatingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [hint] = useState(() => voiceHint(hintSeed++));
  const operation = useRef(null);
  const mounted = useRef(true);
  const closing = useRef(false);
  const transcriptScroll = useRef(null);
  // The room the words have in the resting sheet, and how tall the words are now.
  const wordsRoom = useRef(null);
  const [wordsHeight, setWordsHeight] = useState(0);
  useEffect(() => () => { mounted.current = false; operation.current?.abort(); }, []);

  // Sizes: about a third of the screen to listen, two thirds once there's something to show,
  // and nearly full while the keyboard is up during review.
  const listenHeight = Math.round(Math.min(Math.max(screenHeight * 0.38, 320), 380));
  const largeHeight = Math.round(screenHeight * 0.68);
  const fullHeight = Math.round(screenHeight - top - INSET * 2);
  // While listening the sheet grows with the words, a line at a time, so what was said earlier stays in view.
  // Past the large size the words scroll instead.
  const wordsOver = wordsRoom.current == null ? 0 : Math.max(0, Math.ceil(wordsHeight + WORDS_PADDING - wordsRoom.current));
  const listenTarget = Math.min(listenHeight + wordsOver, Math.max(listenHeight, largeHeight));
  const shown = useSharedValue(reducedMotion ? 1 : 0);
  const size = useSharedValue(listenHeight);
  const phaseCode = useSharedValue(0);
  const tint = useSharedValue(TINT[0]);
  const drag = useSharedValue(0);
  const keyboardHeight = useVoiceKeyboardHeight(screenHeight);
  useEffect(() => {
    const code = PHASES[phase];
    phaseCode.value = code;
    const target = phase === "listen" ? listenTarget : phase === "saved" ? listenHeight : largeHeight;
    size.value = reducedMotion ? target : withSpring(target, SPRING);
    tint.value = reducedMotion ? TINT[code] : withTiming(TINT[code], { duration: 360 });
  }, [phase, listenHeight, listenTarget, largeHeight, reducedMotion, size, tint, phaseCode]);

  const sheetStyle = useAnimatedStyle(() => {
    const raised = keyboardHeight.value;
    const reviewing = phaseCode.value === PHASES.review;
    const lift = reviewing ? 0 : raised;
    // Lifted over the keyboard, a sheet grown tall with words still has to fit under the status bar.
    const height = reviewing ? interpolate(raised, [0, 260], [size.value, Math.max(size.value, fullHeight)], Extrapolation.CLAMP)
      : Math.min(size.value, Math.max(listenHeight, fullHeight - lift));
    return { height, transform: [{ translateY: (1 - shown.value) * (height + INSET * 2) - lift + drag.value }] };
  });
  const tintStyle = useAnimatedStyle(() => ({ opacity: tint.value }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: shown.value * (1 - Math.min(1, drag.value / 400)) }));

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    operation.current?.abort();
    Keyboard.dismiss();
    const finish = () => onClose?.();
    if (reducedMotion) { finish(); return; }
    shown.value = withTiming(0, HIDE, done => { if (done) runOnJS(finish)(); });
  }, [onClose, reducedMotion, shown]);

  const hasWords = Boolean(speech.text.trim());
  const requestClose = useCallback(() => {
    if (closing.current || saving) return;
    const unsaved = phase === "review" ? Boolean(review?.entries.length) : phase === "listen" && hasWords;
    if (!unsaved) { dismiss(); return; }
    Alert.alert(phase === "review" ? "Discard this meal?" : "Discard what you said?", "Nothing has been saved.", [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: dismiss },
    ]);
  }, [dismiss, hasWords, phase, review, saving]);

  const resetDrag = () => { drag.value = withSpring(0, { damping: 24, stiffness: 260 }); };
  const pan = Gesture.Pan().activeOffsetY(8).failOffsetX([-24, 24])
    .onUpdate(event => { drag.value = Math.max(0, event.translationY); })
    .onEnd(event => {
      if (event.translationY > 110 || event.velocityY > 900) { runOnJS(requestClose)(); runOnJS(resetDrag)(); }
      else drag.value = withSpring(0, { damping: 24, stiffness: 260 });
    });

  const begin = () => {
    if (!reducedMotion) shown.value = withTiming(1, SHOW);
    listen();
  };
  const listen = () => {
    setEditingWords(false);
    setNotice(null);
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    speech.start();
  };

  // Recognizer errors arrive as codes; show them as a line above the buttons.
  useEffect(() => { if (speech.error) setNotice(speech.error); }, [speech.error]);
  // At the limit with every word deleted there's nothing to send; the prompt says to close instead.
  // A long silence after some words isn't "nothing caught": the words stay, ready to resume or send.
  const noticeKey = notice === "no-speech" && hasWords ? "stopped" : notice;
  const noticeText = !noticeKey || (noticeKey === "limit" && !hasWords) ? null : NOTICES[noticeKey] || "Listening stopped. Tap Resume to keep going.";

  const send = async () => {
    if (operation.current || closing.current) return;
    Keyboard.dismiss();
    const said = (await speech.finish()).trim();
    if (!mounted.current || closing.current) return;
    if (!said) { setNotice("empty"); return; }
    const controller = new AbortController();
    operation.current = controller;
    const alive = () => mounted.current && !closing.current && operation.current === controller && !controller.signal.aborted;
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    setNotice(null); setSentText(said); setStage("sending"); setEstimateDone(false); setPhase("thinking");
    try {
      const ai = await mealAI(userId);
      if (!alive()) return;
      setModel(ai.label); setAiType(ai.type);
      const createdAt = getLocalTimeWithOffset();
      const result = await ai.estimate({ text: said,
        signal: controller.signal, onProgress: next => { if (alive()) setStage(next); } });
      if (!alive()) return;
      if (!result.length) throw new Error("no_food_detected");
      const draft = createMealReview(result, userId, createdAt);
      setEstimateDone(true);
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      // Let the Done beat play before the review takes its place.
      await wait(reducedMotion ? 150 : 1150);
      if (!alive()) return;
      setReview(draft);
      setPhase("review");
    } catch (error) {
      if (!alive()) return;
      setPhase("listen");
      if (/no_food/.test(error?.message || "")) setNotice("no-food");
      else inferenceError(error, router, { inSheet: true });
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  };

  const reestimate = async id => {
    const values = review?.entries.find(entry => entry.id === id);
    if (!values?.foodName.trim() || !values.quantity.trim() || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setEstimatingId(id);
    try {
      const result = await estimateMacros(userId, values.foodName.trim(), values.quantity.trim(), { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      setReview(current => updateReviewFood(current, id, { ...values, ...result, quantity: result.normalizedQuantity || values.quantity }));
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) inferenceError(error, router, { inSheet: true });
    } finally {
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setEstimatingId(null);
    }
  };

  const save = async (mealType, draft) => {
    if (saving || operation.current || !draft?.entries.length) return;
    const controller = new AbortController();
    operation.current = controller;
    setSaving(true);
    const meal = { ...draft, mealType };
    try {
      const savedEntries = await saveMealReview(meal, userId, data, { signal: controller.signal,
        isActive: () => mounted.current });
      rememberIcons(savedEntries, meal.entries).catch(() => {});
      onSaved?.(savedEntries);
      if (!mounted.current) return;
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      setSaved({ mealType, count: meal.entries.length, calories: reviewTotals(meal).calories });
      setPhase("saved");
      // Long enough for "Saved" to register, short enough that the orange's drop follows soon after.
      await wait(reducedMotion ? 600 : SAVED_HOLD_MS);
      if (mounted.current) dismiss();
    } catch (error) {
      const message = error?.message || "";
      const mayHaveSaved = error?.mayHaveSaved === true || message === "meal_save_uncertain" || Boolean(error?.savedEntries?.length);
      if (mayHaveSaved) {
        onSaved?.(error?.savedEntries || []);
        inferenceError(error, router, { inSheet: true });
        if (mounted.current) dismiss();
      } else if (/meal_save/.test(message)) {
        Alert.alert("Couldn’t save meal", "Your meal is still here. Try again.");
      } else inferenceError(error, router, { inSheet: true });
    } finally {
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setSaving(false);
    }
  };

  const listening = speech.status === "listening" || speech.status === "starting";
  const paused = speech.status === "paused" || speech.status === "idle";
  const statusLabel = speech.status === "starting" ? "Starting…" : speech.status === "stopping" ? "Finishing…" : listening ? "Listening" : "Paused";
  const contentBottom = Math.max(bottom - INSET, 14);

  return <Modal visible transparent animationType="none" statusBarTranslucent onShow={begin} onRequestClose={requestClose}>
    <GestureHandlerRootView style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityRole="button" accessibilityLabel="Close voice log" />
      </Animated.View>
      <Animated.View style={[styles.sheet, sheetStyle]} accessibilityViewIsModal onAccessibilityEscape={requestClose}>
        <GlassSurface cornerRadius={RADIUS} />
        <Animated.View pointerEvents="none" style={[styles.tint, tintStyle]} />
        <View style={styles.clip}>
          <GestureDetector gesture={pan}>
            <View collapsable={false} style={styles.header}>
              <View style={styles.grabber} />
              <View style={styles.headerRow}>
                {phase === "listen" ? <View style={styles.status} accessibilityLiveRegion="polite">
                  <PulseDot active={listening} reducedMotion={reducedMotion} />
                  <Text style={styles.statusText}>{statusLabel}</Text>
                  <Text style={styles.timer}>{formatElapsed(speech.elapsed)}</Text>
                </View> : <Text style={styles.headerTitle} accessibilityRole="header">{phase === "review" ? "Review" : phase === "saved" ? "Saved" : "Voice log"}</Text>}
                <Pressable onPress={requestClose} disabled={saving} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"
                  style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}>
                  <Ionicons name="close" size={18} color={COLORS.text} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          {phase === "listen" && <View style={[styles.listen, { paddingBottom: contentBottom }]}>
            <ScrollView ref={transcriptScroll} style={styles.transcript} contentContainerStyle={styles.transcriptContent}
              onLayout={({ nativeEvent }) => { if (wordsRoom.current == null) wordsRoom.current = nativeEvent.layout.height; }}
              onContentSizeChange={() => { if (listening) transcriptScroll.current?.scrollToEnd({ animated: !reducedMotion }); }}
              keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View onLayout={({ nativeEvent }) => setWordsHeight(nativeEvent.layout.height)}>
              {paused && (hasWords || editingWords) ? <TranscriptInput text={speech.committed} onChangeText={speech.editText}
                onFocus={() => setEditingWords(true)} onBlur={() => setEditingWords(false)} />
                : hasWords ? <Text style={styles.words} accessibilityLiveRegion="polite">{speech.text}</Text>
                  : <View style={styles.empty}>
                    <Text style={styles.prompt}>{listening ? "Tell me what you ate" : speech.elapsed >= VOICE_LIMIT_MS ? "Close to start a new voice log" : "Tap Resume to keep talking"}</Text>
                    <Text style={styles.hint}>{hint}</Text>
                  </View>}
              </View>
            </ScrollView>
            <VoiceWave level={level} active={listening} />
            <View style={styles.noticeRow}>
              {noticeText ? <Animated.Text entering={reducedMotion ? undefined : FadeIn.duration(200)} style={styles.notice} numberOfLines={2}>{noticeText}</Animated.Text>
                : paused && hasWords ? <Text style={styles.tip}>Tap the words to fix anything</Text> : null}
              {notice === "not-allowed" && <Pressable onPress={() => Linking.openURL("app-settings:").catch(() => {})} hitSlop={8} accessibilityRole="button">
                <Text style={styles.link}>Open Settings</Text></Pressable>}
            </View>
            <View style={styles.controls}>
              <GlassButton title={listening ? "Pause" : "Resume"} symbol={listening ? "pause.fill" : "mic.fill"}
                onPress={listening ? speech.pause : listen}
                disabled={speech.status === "stopping" || !speech.available || (!listening && speech.elapsed >= VOICE_LIMIT_MS)}
                accessibilityLabel={listening ? "Pause listening" : "Resume listening"} style={styles.secondary} />
              <GlassButton title="Send" symbol="arrow.up" role="accent" onPress={send}
                disabled={!hasWords || speech.status === "stopping"} accessibilityLabel="Send for estimation" style={styles.primary} />
            </View>
          </View>}

          {phase === "thinking" && <View style={[styles.fill, { paddingBottom: contentBottom }]}>
            <VoiceThinking stage={stage} model={model} provider={aiType} transcript={sentText} done={estimateDone} />
          </View>}

          {phase === "review" && review && <View style={styles.fill}>
            <MealReview embedded text={sentText} review={review} setReview={value => { if (!saving) setReview(value); }}
              busy={saving || Boolean(estimatingId)} estimating={estimatingId} selecting={false} mealSaved={false} uncertain={false}
              onBack={requestClose} onSave={save} onReestimate={reestimate} onViewMeals={dismiss}
              onChangeInput={() => { if (saving || estimatingId) return; setReview(null); setPhase("listen"); }} />
          </View>}

          {phase === "saved" && saved && <View style={[styles.fill, styles.savedWrap, { paddingBottom: contentBottom }]} accessibilityLiveRegion="polite">
            <CitrusBuddy mood="happy" cheerSignal={1} />
            <Text style={styles.savedTitle}>{saved.mealType} logged</Text>
            <Text style={styles.savedDetail}>{saved.count} {saved.count === 1 ? "food" : "foods"} · {Math.round(saved.calories)} kcal</Text>
          </View>}
        </View>
      </Animated.View>
    </GestureHandlerRootView>
  </Modal>;
}

function TranscriptInput({ text, onChangeText, onFocus, onBlur }) {
  // UIKit owns the text and caret while editing. The speech log still receives every edit.
  const initialText = useRef(text);
  return <TextInput defaultValue={initialText.current} onChangeText={onChangeText} onFocus={onFocus} onBlur={onBlur}
    multiline maxLength={3000} accessibilityLabel="What you said" accessibilityHint="Edit the words before sending"
    returnKeyType="done" submitBehavior="blurAndSubmit" style={[styles.words, styles.wordsInput]} />;
}

// A small live light beside "Listening" that breathes while the microphone is on.
function PulseDot({ active, reducedMotion }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!active || reducedMotion) { glow.value = withTiming(0, { duration: 200 }); return undefined; }
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1, false);
    return () => cancelAnimation(glow);
  }, [active, reducedMotion, glow]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.35 * glow.value, transform: [{ scale: 1 + glow.value * 0.9 }] }));
  return <View style={styles.dotWrap}>
    <Animated.View style={[styles.dotRing, ringStyle]} />
    <View style={[styles.dot, !active && styles.dotPaused]} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: "rgba(52,30,16,0.22)" },
  sheet: { position: "absolute", left: INSET, right: INSET, bottom: INSET, borderRadius: RADIUS,
    shadowColor: "#3B2214", shadowOpacity: 0.16, shadowRadius: 28, shadowOffset: { width: 0, height: 10 } },
  tint: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS, backgroundColor: "#FFFBF9" },
  clip: { flex: 1, borderRadius: RADIUS, overflow: "hidden" },
  header: { paddingTop: 6, paddingHorizontal: 20 },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: "rgba(74,52,40,0.18)" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40, marginTop: 4 },
  headerTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  status: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusText: { ...TYPOGRAPHY.button, color: COLORS.text },
  timer: { ...TYPOGRAPHY.captionMedium, color: COLORS.textLight, fontVariant: ["tabular-nums"] },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(74,52,40,0.08)" },
  dotWrap: { width: 12, height: 12, alignItems: "center", justifyContent: "center" },
  dotRing: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: "#E87524" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E87524" },
  dotPaused: { backgroundColor: "#C9B6A8" },
  listen: { flex: 1, paddingHorizontal: 20, gap: 8 },
  transcript: { flex: 1 },
  transcriptContent: { flexGrow: 1, justifyContent: "center", paddingVertical: WORDS_PADDING / 2 },
  words: { fontSize: 20, lineHeight: 27, fontWeight: "500", color: COLORS.text, letterSpacing: -0.2 },
  wordsInput: { padding: 0, margin: 0 },
  empty: { alignItems: "center", gap: 4 },
  prompt: { fontSize: 20, lineHeight: 27, fontWeight: "600", color: COLORS.text, textAlign: "center", letterSpacing: -0.2 },
  hint: { ...TYPOGRAPHY.body, color: COLORS.textLight, textAlign: "center" },
  noticeRow: { minHeight: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  notice: { ...TYPOGRAPHY.captionMedium, color: "#A2470F", textAlign: "center", flexShrink: 1 },
  tip: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  link: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary, textDecorationLine: "underline" },
  controls: { flexDirection: "row", gap: 12 },
  secondary: { flex: 1, minHeight: 52 },
  primary: { flex: 1.25, minHeight: 52 },
  fill: { flex: 1 },
  savedWrap: { alignItems: "center", justifyContent: "center", gap: 8 },
  savedTitle: { ...TYPOGRAPHY.sectionTitle, fontSize: 18, lineHeight: 24, color: COLORS.text, marginTop: 8 },
  savedDetail: { ...TYPOGRAPHY.body, color: COLORS.textLight },
});
