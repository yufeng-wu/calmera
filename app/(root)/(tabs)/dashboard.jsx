import { useUser } from "@clerk/clerk-expo";
import {
  Text,
  TouchableOpacity,
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
  Pressable,
} from "react-native";
import { useEffect, useState, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useDailyNutrition } from "../../../hooks/useDailyNutrition";
import PageLoader from "@/components/PageLoader";
import { styles } from "@/assets/styles/home.styles";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { NutritionSummaryCard } from "@/components/NutritionSummaryCard";
import { FoodEntryItem } from "@/components/FoodEntryItem";
import NoRecordYet from "@/components/NoRecordYet";
import { USERS_API_URL } from "@/constants/api";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { usePremium } from "@/context/PremiumContext";
import { COLORS, RAINBOW_COLORS } from "@/constants/colors";
import { useAuth } from "@clerk/clerk-expo";
import { Audio } from "expo-av";
import { VOICE_LOG_API_URL } from "@/constants/api";
import { getLocalTimeWithOffset } from "@/lib/utils";
import { isModelLoaded, isModelWarmed } from "@/lib/tfModels";
import AnimatedRe, { Layout as ReLayout } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

// Animated Touchable wrapper
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

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
  const { getToken, isLoaded } = useAuth();
  const { isPremium, refreshPremium } = usePremium();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const {
    shouldRefresh,
    setShouldRefresh,
    shouldRefreshGoals,
    setShouldRefreshGoals,
  } = useRefreshSignal();
  const [goals, setGoals] = useState({});
  const [username, setUsername] = useState("");
  const [fabExpanded, setFabExpanded] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  // Track microphone permission to avoid prompting during a long-press gesture
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const longPressTriggered = useRef(false);
  const INITIAL_VOICE_WIDTH = 120;
  const voiceWidthAnim = useRef(
    new Animated.Value(INITIAL_VOICE_WIDTH)
  ).current;
  // No translation needed; button is anchored to right so it grows leftwards
  const voiceLogContentOpacity = useRef(new Animated.Value(1)).current;

  const rainbowAnim = useRef(new Animated.Value(0)).current;
  const rainbowBorderColor = rainbowAnim.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], // 5 colors + loop back to first
    outputRange: [...RAINBOW_COLORS, RAINBOW_COLORS[0]],
  });
  const timerRef = useRef(null);
  const recordingRef = useRef(null);
  // Flag to request an early stop when the user lifts finger before the recorder is ready
  const stopRequestedRef = useRef(false);
  // Animation refs to cancel queued animations cleanly
  const voicePhase1AnimRef = useRef(null);
  const voiceGrowAnimRef = useRef(null);
  // removed isLongPressing; we'll control start/stop directly via handlers
  const fabAnim = useRef(new Animated.Value(0)).current;
  // Animated width for main FAB
  const fabWidthAnim = useRef(new Animated.Value(80)).current; // starts at expanded width

  // NEW: start / stop rainbow border loop when analyzing toggles
  useEffect(() => {
    let animation;
    if (analyzing && fabExpanded) {
      rainbowAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(rainbowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      animation.start();
    } else {
      rainbowAnim.stopAnimation && rainbowAnim.stopAnimation();
    }
    return () => {
      animation && animation.stop();
    };
  }, [analyzing, fabExpanded]);

  // NEW: Fade-in animation for "Voice Log" text after analysis
  useEffect(() => {
    if (!analyzing) {
      voiceLogContentOpacity.setValue(0);
      Animated.timing(voiceLogContentOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start();
    }
  }, [analyzing]);

  // Opacity interpolations for Add vs Close content
  const addOpacity = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const closeOpacity = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const FAB_BOTTOM = 40;
  const FAB_HEIGHT = 56;
  const OPTION_HEIGHT = 56;
  const OPTION_SPACING = 12;

  // bottom padding for ScrollView content so last cards aren't hidden behind the FAB
  const SCROLL_BOTTOM_PADDING = FAB_BOTTOM + FAB_HEIGHT + 20;

  // Derived bottom positions
  const voiceBottom = FAB_BOTTOM + FAB_HEIGHT + OPTION_SPACING; // closest to FAB
  const manualBottom = voiceBottom + OPTION_HEIGHT + OPTION_SPACING;
  const cameraBottom = manualBottom + OPTION_HEIGHT + OPTION_SPACING;

  // user.id comes from Clerk
  const { entries, summary, isLoading, loadData, deleteEntry, addEntries } =
    useDailyNutrition(user.id);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await refreshPremium();
    setRefreshing(false);
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

  // Stable reference: do NOT include getToken in deps to prevent identity change loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchUserGoals = useCallback(async () => {
    // Avoid unauthenticated request if Clerk session not ready yet
    const token = await getToken();
    if (!token) return;
    try {
      const response = await fetch(`${USERS_API_URL}/get-user`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch user goals");

      const data = await response.json();

      setGoals({
        calorieGoal: data.calorieGoal,
        proteinGoal: data.proteinGoal,
        carbsGoal: data.carbsGoal,
        fatGoal: data.fatGoal,
      });

      setUsername(data.username);
    } catch (error) {
      console.error("Error fetching user goals", error);
    }
  }, []);

  // Initial fetch only once when Clerk is ready
  useEffect(() => {
    if (!isLoaded) return;
    fetchUserGoals();
  }, [isLoaded]);

  // Refresh goals when goal refresh signal is triggered
  useEffect(() => {
    if (!isLoaded) return;
    if (shouldRefreshGoals) {
      fetchUserGoals();
      setShouldRefreshGoals(false);
    }
  }, [isLoaded, shouldRefreshGoals, fetchUserGoals, setShouldRefreshGoals]);

  useEffect(() => {
    if (!isLoaded) return;
    loadData();
  }, [isLoaded, loadData]);

  // Refresh list when other screens signal update (silent fetch, no loader)
  useEffect(() => {
    if (!isLoaded) return;
    if (shouldRefresh) {
      loadData(true); // silent update
      setShouldRefresh(false);
    }
  }, [isLoaded, shouldRefresh, loadData, setShouldRefresh]);

  // Always refresh data silently when the Dashboard screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!isLoaded) return;
      loadData(true); // silent fetch (no loader)
    }, [isLoaded, loadData])
  );

  useEffect(() => {
    // Enable LayoutAnimation on Android
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // --------------------------------------------------
  // Request microphone permission ONCE when component mounts.
  // Doing this proactively prevents the OS permission dialog from
  // interrupting a long-press gesture which previously led to the
  // first-time recording failure described.
  // --------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Audio.getPermissionsAsync();
        if (status === "granted") {
          setHasMicPermission(true);
          return;
        }
        const request = await Audio.requestPermissionsAsync();
        setHasMicPermission(request.status === "granted");
      } catch (err) {
        console.warn("Microphone permission check failed", err);
      }
    })();
  }, []);

  const handleFabToggle = () => {
    if (fabExpanded) {
      // Collapse: animate out, then unmount (do not cancel ongoing analysis)
      Animated.timing(fabAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start(() => {
        setFabExpanded(false);
      });
    } else {
      // Expand: mount, then animate in
      setFabExpanded(true);
      Animated.timing(fabAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start();
    }

    // Animate main fab width
    Animated.timing(fabWidthAnim, {
      toValue: fabExpanded ? 80 : 56,
      duration: 200,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start();
  };

  // Ensure width anim sync with state on mount changes (in case of quick toggles)
  useEffect(() => {
    Animated.timing(fabWidthAnim, {
      toValue: fabExpanded ? 56 : 80,
      duration: 200,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start();
  }, [fabExpanded]);

  // Helper to gracefully collapse FAB and then navigate
  const collapseFabThenNavigate = (path) => {
    // If FAB already collapsed, navigate immediately
    if (!fabExpanded) {
      router.push(path);
      return;
    }

    Animated.parallel([
      Animated.timing(fabAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(fabWidthAnim, {
        toValue: 80,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setFabExpanded(false);
      router.push(path);
    });
  };

  const handleManualAdd = () => collapseFabThenNavigate("/create");

  const handleCameraAdd = () => {
    // Block non-premium users
    if (!isPremium) {
      Alert.alert(
        "Premium Feature",
        "Live AI is available for Premium users. Upgrade to unlock!"
      );
      return;
    }

    const roiReady = isModelLoaded("roi") && isModelWarmed("roi");
    const digitReady = isModelLoaded("digit") && isModelWarmed("digit");

    if (roiReady && digitReady) {
      collapseFabThenNavigate("/camera");
    } else {
      collapseFabThenNavigate("/camera-loading");
    }
  };

  // ---------------- Voice Log handlers ----------------
  const startRecording = async () => {
    // Abort early if we still don't have permission (e.g. user denied).
    if (!hasMicPermission) {
      Alert.alert(
        "Microphone Access Required",
        "Please grant microphone access in your device settings to use voice logging."
      );
      return null;
    }
    if (recordingRef.current) {
      console.warn("Recording already in progress");
      return;
    }
    try {
      // First try to request permission
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Microphone Access Required",
          "To use voice logging, please grant microphone permission in your device settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                // Open device settings for the app
                if (Platform.OS === "ios") {
                  Linking.openURL("app-settings:");
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const rec = new Audio.Recording();
      recordingRef.current = rec; // set ref immediately
      setRecording(rec); // set state for UI re-render

      await rec.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await rec.startAsync();

      // Reset and start Phase 1 width animation (guarded sequencing)
      voiceWidthAnim.stopAnimation();
      voicePhase1AnimRef.current && voicePhase1AnimRef.current.stop();
      voiceGrowAnimRef.current && voiceGrowAnimRef.current.stop();
      voiceWidthAnim.setValue(120);
      const phase1 = Animated.timing(voiceWidthAnim, {
        toValue: 160,
        duration: 200,
        useNativeDriver: false,
      });
      voicePhase1AnimRef.current = phase1;
      phase1.start(({ finished }) => {
        // Only continue if phase 1 actually finished and recording is still active
        if (!finished || stopRequestedRef.current || !recordingRef.current)
          return;
        const screenWidth = Dimensions.get("window").width;
        const maxButtonWidth = screenWidth * 0.7;
        const grow = Animated.timing(voiceWidthAnim, {
          toValue: maxButtonWidth,
          duration: 30000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        });
        voiceGrowAnimRef.current = grow;
        grow.start();
      });

      // If the user already lifted the finger, stop immediately after starting
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        stopRecording();
        return rec;
      }

      // reset seconds & start interval counter
      setRecordingSeconds(0);
      timerRef.current && clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);

      // Automatically stop after 30 seconds
      setTimeout(async () => {
        // ensure it hasn't already been stopped
        if (recordingRef.current === rec) {
          stopRecording();
        }
      }, 30000);
      return rec;
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Error", "Failed to start recording.");
      recordingRef.current = null;
      setRecording(null);
      return null;
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    // Cancel any pending width animations before shrinking
    voicePhase1AnimRef.current && voicePhase1AnimRef.current.stop();
    voiceGrowAnimRef.current && voiceGrowAnimRef.current.stop();
    voiceWidthAnim.stopAnimation();

    try {
      const rec = recordingRef.current;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      setRecording(null);

      // clear interval first
      timerRef.current && clearInterval(timerRef.current);
      timerRef.current = null;

      // animate width back to original quickly
      Animated.timing(voiceWidthAnim, {
        toValue: 120,
        duration: 250,
        useNativeDriver: false,
      }).start();

      // If recording shorter than 1 second, discard and skip analysis
      if (recordingSeconds < 1) {
        stopRequestedRef.current = false;
        return;
      }

      // ---- Send audio to backend ----
      setAnalyzing(true);
      setRecordingSeconds(0);
      try {
        const token = await getToken();
        const formData = new FormData();
        formData.append("audio", {
          uri,
          name: "voice-log.m4a",
          type: "audio/m4a",
        });
        formData.append("createdAt", getLocalTimeWithOffset());

        const response = await fetch(VOICE_LOG_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
          if (data?.errorCode === "FOOD_NAME_NOT_DETECTED") {
            Alert.alert("Oops", "Food name not detected in your voice log.");
          } else {
            Alert.alert("Error", data?.error || "Voice analysis failed");
          }
        } else {
          // Success – add entries to the list with an animation
          const entriesToAdd = Array.isArray(data.savedEntries)
            ? data.savedEntries
            : data.savedEntries
            ? [data.savedEntries]
            : [];
          addEntries(entriesToAdd);
          setShouldRefresh(true); // notify other screens
        }
      } catch (err) {
        console.error("Voice log API error", err);
        Alert.alert("Error", "Failed to analyze voice log");
      } finally {
        setAnalyzing(false);
      }
      // Ensure any pending stop requests are cleared
      stopRequestedRef.current = false;
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  // useEffect removed – we now start/stop directly in handlers

  const handleVoiceShortPress = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false; // reset flag so short press isn't fired after long press
      return;
    }
    Alert.alert(
      "How to use voice log?",
      '\nHold this button and\nstart speaking, e.g., \n\n "A 16-ounce latte for breakfast."\n\n✨ AI will log it for you ✨  \n\nPro tip: If you specify calories, AI will use that instead of estimating.'
    );
  };
  const handleVoiceLongPress = () => {
    // Block non-premium users
    if (!isPremium) {
      Alert.alert(
        "Premium Feature",
        "Voice Log is available for Premium users. Upgrade to unlock!"
      );
      return;
    }

    if (recordingRef.current || analyzing) return; // already recording or analyzing
    longPressTriggered.current = true;
    startRecording();
  };

  const handleVoicePressOut = () => {
    if (recordingRef.current) {
      stopRecording();
    } else if (longPressTriggered.current) {
      // Recording hasn't started yet; request a stop once it does
      stopRequestedRef.current = true;
      // Reset width immediately and cancel any queued animations
      voicePhase1AnimRef.current && voicePhase1AnimRef.current.stop();
      voiceGrowAnimRef.current && voiceGrowAnimRef.current.stop();
      voiceWidthAnim.stopAnimation();
      Animated.timing(voiceWidthAnim, {
        toValue: 120,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
    longPressTriggered.current = false;
  };

  if (isLoading && !refreshing) {
    return <PageLoader />;
  }

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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerContainer}>
          {/* Go Premium button */}
          <LinearGradient
            colors={RAINBOW_COLORS}
            start={{ x: 1, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={styles.premiumButton}
          >
            <TouchableOpacity
              style={{ paddingHorizontal: 10, paddingVertical: 8 }}
              onPress={() =>
                router.push(isPremium ? "/premium-plan" : "/go-premium")
              }
              activeOpacity={0.8}
            >
              <Text style={styles.premiumButtonText}>
                {isPremium ? " Premium " : "Go Premium"}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.usernameText}>{username}</Text>
              </View>
              <Image
                source={require("../../../assets/images/logo.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.dateText}> {formattedDate}</Text>
          <NutritionSummaryCard summary={summary} goals={goals} />
        </View>

        <View style={styles.transactionsContainer}>
          {entries.length > 0 ? (
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

      {/* Floating Action Button Options */}
      {fabExpanded && (
        <>
          {/* Voice Log Option */}
          <Animated.View
            style={[
              styles.fabOptionContainer,
              {
                bottom: voiceBottom,
                opacity: fabAnim,
                transform: [
                  {
                    translateY: fabAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              onPress={handleVoiceShortPress}
              onLongPress={handleVoiceLongPress}
              onPressOut={handleVoicePressOut}
              disabled={analyzing}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            >
              <Animated.View
                style={[
                  styles.fabOption,
                  {
                    width: voiceWidthAnim,
                    borderWidth: analyzing ? 3 : 0,
                    borderColor: analyzing ? rainbowBorderColor : "transparent",
                  },
                ]}
              >
                {/* Timer on left */}
                {recording && !analyzing && (
                  <Text
                    style={{
                      position: "absolute",
                      left: 16,
                      color: COLORS.white,
                      fontWeight: "600",
                      alignSelf: "center",
                    }}
                  >
                    {recordingSeconds}s
                  </Text>
                )}
                {/* Icon and Text view, absolute on the right */}
                <View
                  style={{
                    position: "absolute",
                    right: 20,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  {analyzing ? (
                    <Text style={styles.fabText}>Analyzing...</Text>
                  ) : (
                    <Animated.View
                      style={{
                        opacity: voiceLogContentOpacity,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons
                        name="mic-outline"
                        size={16}
                        color={COLORS.white}
                      />
                      <Text style={styles.fabText}>Voice Log</Text>
                    </Animated.View>
                  )}
                </View>
              </Animated.View>
            </Pressable>
          </Animated.View>

          {/* Calmera AI Option */}
          <Animated.View
            style={[
              styles.fabOptionContainer,
              {
                bottom: cameraBottom,
                opacity: fabAnim,
                transform: [
                  {
                    translateY: fabAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.fabOption}
              onPress={handleCameraAdd}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={16} color={COLORS.white} />
              <Text style={styles.fabText}>Live AI</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Add Option */}
          <Animated.View
            style={[
              styles.fabOptionContainer,
              {
                bottom: manualBottom,
                opacity: fabAnim,
                transform: [
                  {
                    translateY: fabAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.fabOption}
              onPress={handleManualAdd}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil-outline" size={16} color={COLORS.white} />
              <Text style={styles.fabText}>Quick Add</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      {/* Voice Log button visible only while recording (hidden during analysis when FAB collapsed) */}
      {recording && !fabExpanded && (
        <Pressable
          onPress={handleVoiceShortPress}
          onLongPress={handleVoiceLongPress}
          onPressOut={handleVoicePressOut}
          disabled={analyzing}
          style={({ pressed }) => [
            {
              position: "absolute",
              right: 20,
              bottom: voiceBottom,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.fabOption,
              {
                width: voiceWidthAnim,
                justifyContent: "center",
                borderWidth: analyzing ? 2 : 0,
                borderColor: analyzing ? rainbowBorderColor : "transparent",
              },
            ]}
          >
            {/* Timer – visible only while recording */}
            {recording && (
              <Text
                style={{
                  position: "absolute",
                  left: 16,
                  color: COLORS.white,
                  fontWeight: "600",
                  alignSelf: "center",
                }}
              >
                {recordingSeconds}s
              </Text>
            )}

            {/* Icon and Text view, absolute on the right */}
            <View
              style={{
                position: "absolute",
                right: 20,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons name="mic-outline" size={16} color={COLORS.white} />
              <Text style={styles.fabText}>Voice Log</Text>
            </View>
          </Animated.View>
        </Pressable>
      )}

      {/* Main Floating Action Button */}
      <AnimatedTouchable
        style={[styles.fab, { width: fabWidthAnim }]}
        onPress={handleFabToggle}
        activeOpacity={1}
      >
        {/* Add content */}
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            opacity: addOpacity,
          }}
          pointerEvents="none"
        >
          <Ionicons name="add" size={16} color={COLORS.white} />
          <Text style={styles.fabText}>Add</Text>
        </Animated.View>

        {/* Close icon */}
        <Animated.View
          style={{
            position: "absolute",
            opacity: closeOpacity,
          }}
          pointerEvents="none"
        >
          <Ionicons name="close" size={16} color={COLORS.white} />
        </Animated.View>
      </AnimatedTouchable>
    </View>
  );
}
