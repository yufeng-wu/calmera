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
} from "react-native";
import { useEffect, useState, useCallback, useRef } from "react";
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
import { COLORS } from "@/constants/colors";
import { useAuth } from "@clerk/clerk-expo";
import { Audio } from "expo-av";
import { VOICE_LOG_API_URL } from "@/constants/api";

// Animated Touchable wrapper
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const MealGroup = ({ title, entries, onDelete }) => {
  if (entries.length === 0) return null;

  return (
    <View style={styles.mealGroupContainer}>
      <Text style={styles.mealGroupTitle}> {title}</Text>
      {entries.map((item) => (
        <FoodEntryItem key={item.id} item={item} onDelete={onDelete} />
      ))}
    </View>
  );
};

export default function SummaryScreen() {
  const { user } = useUser();
  const { getToken, isLoaded } = useAuth();
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
  const [analyzing, setAnalyzing] = useState(false);
  const longPressTriggered = useRef(false);
  const voiceWidthAnim = useRef(new Animated.Value(110)).current;
  const timerRef = useRef(null);
  const recordingRef = useRef(null);
  // removed isLongPressing; we'll control start/stop directly via handlers
  const fabAnim = useRef(new Animated.Value(0)).current;
  // Animated width for main FAB
  const fabWidthAnim = useRef(new Animated.Value(80)).current; // starts at expanded width

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
  const { entries, summary, isLoading, loadData, deleteEntry } =
    useDailyNutrition(user.id);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
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

  // Refresh list when edit screen signals update
  useEffect(() => {
    if (!isLoaded) return;
    if (shouldRefresh) {
      loadData();
      setShouldRefresh(false);
    }
  }, [isLoaded, shouldRefresh, loadData, setShouldRefresh]);

  useEffect(() => {
    // Enable LayoutAnimation on Android
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const handleFabToggle = () => {
    if (fabExpanded) {
      // Collapse: animate out, then unmount
      // If analyzing is ongoing, cancel it when collapsing FAB
      if (analyzing) {
        setAnalyzing(false);
      }
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

  const handleManualAdd = () => {
    setFabExpanded(false);
    router.push("/create");
  };

  const handleCameraAdd = () => {
    setFabExpanded(false);
    router.push("/camera"); // TODO: implement camera screen
  };

  // ---------------- Voice Log handlers ----------------
  const startRecording = async () => {
    if (recordingRef.current) {
      console.warn("Recording already in progress");
      return;
    }
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Microphone permission is required to record audio."
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

      // Phase 1: Immediate jump to 160px
      voiceWidthAnim.setValue(120);
      Animated.timing(voiceWidthAnim, {
        toValue: 150,
        duration: 100,
        useNativeDriver: false,
      }).start(() => {
        // Phase 2: Linear growth to 200px over 30 seconds
        const screenWidth = Dimensions.get("window").width;
        const maxButtonWidth = screenWidth * 0.7;
        Animated.timing(voiceWidthAnim, {
          toValue: maxButtonWidth,
          duration: 30000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start();
      });

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

    try {
      const rec = recordingRef.current;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      console.log("uri:::", uri);
      recordingRef.current = null;
      setRecording(null);

      // clear interval first
      timerRef.current && clearInterval(timerRef.current);
      timerRef.current = null;

      // animate width back to original quickly
      Animated.timing(voiceWidthAnim, {
        toValue: 110,
        duration: 250,
        useNativeDriver: false,
      }).start();

      // ---- NEW: send audio to backend ----
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

        console.log("formData:::", formData.get("audio"));

        const response = await fetch(VOICE_LOG_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        console.log("response:::", response);
        const data = await response.json();
        console.log("data:::", data);
        if (!response.ok) {
          if (data?.errorCode === "FOOD_NAME_NOT_DETECTED") {
            Alert.alert("Oops", "Food name not detected");
          } else {
            Alert.alert("Error", data?.error || "Voice analysis failed");
          }
        } else {
          // Success – refresh today's data
          await loadData();
          setShouldRefresh(true); // notify other screens
        }
      } catch (err) {
        console.error("Voice log API error", err);
        Alert.alert("Error", "Failed to analyze voice log");
      } finally {
        setAnalyzing(false);
      }
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
      "\n*Hold down* this button and start speaking (up to 30 seconds): \n\ne.g. 'I had a 16 oz iced latte with oatmilk for breakfast.'\n\n✨ AI will analyze and log it automatically."
    );
  };
  const handleVoiceLongPress = () => {
    if (recordingRef.current || analyzing) return; // already recording or analyzing
    longPressTriggered.current = true;
    startRecording();
  };

  const handleVoicePressOut = () => {
    if (recordingRef.current) {
      stopRecording();
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
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image
                source={require("../../../assets/images/logo.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.usernameText}>{username}</Text>
              </View>
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
            <AnimatedTouchable
              style={[
                styles.fabOption,
                {
                  width: voiceWidthAnim,
                },
              ]}
              onPress={handleVoiceShortPress}
              onLongPress={handleVoiceLongPress}
              onPressOut={handleVoicePressOut}
              activeOpacity={0.8}
              disabled={analyzing}
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
                  right: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "center",
                }}
              >
                {!analyzing && (
                  <Ionicons name="mic-outline" size={16} color={COLORS.white} />
                )}
                <Text style={styles.fabText}>
                  {analyzing ? "Analyzing..." : "Voice Log"}
                </Text>
              </View>
            </AnimatedTouchable>
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
              <Text style={styles.fabText}>Calmera AI</Text>
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
              <Ionicons name="create-outline" size={16} color={COLORS.white} />
              <Text style={styles.fabText}>Quick Add</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      {/* Voice Log button when recording or analyzing (separate from FAB options) */}
      {(recording || analyzing) && !fabExpanded && (
        <AnimatedTouchable
          style={[
            styles.fabOption,
            {
              bottom: voiceBottom,
              width: voiceWidthAnim,
              justifyContent: "flex-end",
            },
          ]}
          onPress={handleVoiceShortPress}
          onLongPress={handleVoiceLongPress}
          onPressOut={handleVoicePressOut}
          activeOpacity={0.8}
          disabled={analyzing}
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
              right: 16,
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "center",
            }}
          >
            {!analyzing && (
              <Ionicons name="mic-outline" size={16} color={COLORS.white} />
            )}
            <Text style={styles.fabText}>
              {analyzing ? "Analyzing..." : "Voice Log"}
            </Text>
          </View>
        </AnimatedTouchable>
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
