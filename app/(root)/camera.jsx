import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  ActionSheetIOS,
  Animated,
  useWindowDimensions,
  Image, // DELETE LATER: for displaying debug images
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import ProgressRing from "@/components/ProgressRing";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import PageLoader from "@/components/PageLoader";
import { cameraStyles } from "@/assets/styles/camera.styles";
import { SessionLogCard } from "@/components/SessionLogCard";
import { useCookingSession } from "@/hooks/useCookingSession";
import { useDailyNutrition } from "@/hooks/useDailyNutrition";
import { useUser } from "@clerk/clerk-expo";
import { useAuth } from "@clerk/clerk-expo";
import { USERS_API_URL } from "@/constants/api";
import { COLORS, RAINBOW_COLORS } from "@/constants/colors";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import {
  FRAME_RESIZE_DIM_FOR_WEIGHT_DETECTION,
  FRAME_COMPRESSION_QUALITY,
  BLANK_FRAME_TOLERANCE,
} from "@/lib/scale/constants";

// Small helper to zero-fill macro objects
const zeroMacros = () => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });

// Enable LayoutAnimation on Android for smooth/bouncy list updates
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =====================
// Macros Swiper Component (extracted to preserve state across re-renders)
// =====================
const MacrosSwiper = React.memo(function MacrosSwiper({
  sessionTotals,
  dailyTotals,
  goals,
}) {
  const { width: windowWidth } = useWindowDimensions();

  // Define gaps and card width based on screen size
  const SIDE_GAP = windowWidth * 0.02; // 2% margin on each side
  const GAP_BETWEEN_CARDS = SIDE_GAP * 2; // 4% gap between cards
  const CARD_WIDTH = windowWidth - 2 * SIDE_GAP;

  const [page, setPage] = useState(0);
  const data = [sessionTotals, dailyTotals];

  const CardContainer = ({ children }) => (
    <View
      style={{
        width: CARD_WIDTH,
        backgroundColor: "#fff",
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 10,
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "center",
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );

  return (
    <View style={{ marginBottom: 6 }}>
      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, idx) => String(idx)}
        snapToInterval={CARD_WIDTH + GAP_BETWEEN_CARDS}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE_GAP }}
        ItemSeparatorComponent={() => (
          <View style={{ width: GAP_BETWEEN_CARDS }} />
        )}
        onMomentumScrollEnd={(e) => {
          const newPage = Math.round(
            e.nativeEvent.contentOffset.x / (CARD_WIDTH + GAP_BETWEEN_CARDS)
          );
          setPage(newPage);
        }}
        renderItem={({ item, index }) => {
          if (index === 0) {
            // ------ Session Totals Card ------
            return (
              <CardContainer>
                <Text
                  style={{
                    alignSelf: "center",
                    fontSize: 14,
                    fontWeight: "500",
                    marginBottom: 12,
                  }}
                >
                  Session Total
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-around",
                    width: "100%",
                  }}
                >
                  {/* Calories */}
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontWeight: "600", fontSize: 14 }}>
                      {item.calories % 1 === 0
                        ? Math.round(item.calories)
                        : item.calories.toFixed(1)}{" "}
                      kcal
                    </Text>
                    <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                      Calories
                    </Text>
                  </View>
                  {/* Protein */}
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontWeight: "600", fontSize: 14 }}>
                      {item.protein % 1 === 0
                        ? Math.round(item.protein)
                        : item.protein.toFixed(1)}{" "}
                      g
                    </Text>
                    <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                      Protein
                    </Text>
                  </View>
                  {/* Carbs */}
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontWeight: "600", fontSize: 14 }}>
                      {item.carbs % 1 === 0
                        ? Math.round(item.carbs)
                        : item.carbs.toFixed(1)}{" "}
                      g
                    </Text>
                    <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                      Carbs
                    </Text>
                  </View>
                  {/* Fat */}
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontWeight: "600", fontSize: 14 }}>
                      {item.fat % 1 === 0
                        ? Math.round(item.fat)
                        : item.fat.toFixed(1)}{" "}
                      g
                    </Text>
                    <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                      Fat
                    </Text>
                  </View>
                </View>
              </CardContainer>
            );
          }

          // ------ Today's Total Card ------
          const calorieColor =
            goals.calorieGoal > 0 && item.calories > goals.calorieGoal
              ? COLORS.expense // red over goal
              : COLORS.income; // green within goal

          return (
            <CardContainer>
              <Text
                style={{
                  alignSelf: "center",
                  fontSize: 14,
                  fontWeight: "500",
                  marginBottom: 12,
                }}
              >
                Today's Total
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-around",
                  width: "100%",
                  alignItems: "center",
                }}
              >
                {/* Calories */}
                <View style={{ alignItems: "center" }}>
                  <ProgressRing
                    size={20}
                    strokeWidth={4}
                    value={item.calories}
                    goal={goals.calorieGoal}
                    color={calorieColor}
                    style={{ marginTop: 4 }}
                  />
                  <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                    Calories
                  </Text>
                </View>
                {/* Protein */}
                <View style={{ alignItems: "center" }}>
                  <ProgressRing
                    size={20}
                    strokeWidth={4}
                    value={item.protein}
                    goal={goals.proteinGoal}
                    color={RAINBOW_COLORS[1]}
                    style={{ marginTop: 4 }}
                  />
                  <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                    Protein
                  </Text>
                </View>
                {/* Carbs */}
                <View style={{ alignItems: "center" }}>
                  <ProgressRing
                    size={20}
                    strokeWidth={4}
                    value={item.carbs}
                    goal={goals.carbsGoal}
                    color={RAINBOW_COLORS[2]}
                    style={{ marginTop: 4 }}
                  />
                  <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                    Carbs
                  </Text>
                </View>
                {/* Fat */}
                <View style={{ alignItems: "center" }}>
                  <ProgressRing
                    size={20}
                    strokeWidth={4}
                    value={item.fat}
                    goal={goals.fatGoal}
                    color={RAINBOW_COLORS[3]}
                    style={{ marginTop: 4 }}
                  />
                  <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                    Fat
                  </Text>
                </View>
              </View>
            </CardContainer>
          );
        }}
      />

      {/* Page indicators */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          marginTop: 6,
        }}
      >
        {[0, 1].map((i) => (
          <View
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              marginHorizontal: 3,
              backgroundColor: i === page ? "#333" : "#bbb",
            }}
          />
        ))}
      </View>
    </View>
  );
});

export default function CameraScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const hasPermission = permission?.granted;

  // User's kitchen scale type ("integer", "1-decimal", "2-decimal")
  const [scaleType, setScaleType] = useState("integer");

  // Session logic handled by custom hook
  const {
    isSessionActive,
    isPaused,
    isSaving,
    startSession,
    pauseSession: togglePause,
    endSession,
    processFrame,
    logEntries,
    currentWeight,
    detectionConfidence,
    deleteLogEntry,
    isAnalyzing,
    debugImages, // DELETE LATER: debug images
  } = useCookingSession(scaleType);

  // Displayed weight/confidence with 2-blank-frame tolerance
  const [displayedWeight, setDisplayedWeight] = useState(null);
  const [displayedConfidence, setDisplayedConfidence] = useState(null);
  const blankCountRef = useRef(0);
  const [frameTick, setFrameTick] = useState(0);

  // Update visible weight based on consecutive blank frames
  useEffect(() => {
    if (currentWeight !== null) {
      blankCountRef.current = 0;
      setDisplayedWeight(currentWeight);
      setDisplayedConfidence(detectionConfidence);
    } else {
      blankCountRef.current += 1;
      if (blankCountRef.current >= BLANK_FRAME_TOLERANCE) {
        setDisplayedWeight(null);
        setDisplayedConfidence(null);
      }
    }
  }, [frameTick, currentWeight, detectionConfidence]);

  // Signal other screens (Dashboard, History) to refresh after session ends
  const { setShouldRefresh } = useRefreshSignal();

  const [isLoading, setIsLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const isCapturingRef = useRef(false);

  // Blinking animation for live indicator
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const blinkLoopRef = useRef(null);

  // Clerk user (for fetching daily nutrition)
  const { user } = useUser();
  const { getToken } = useAuth();

  // =====================
  // User Goals
  // =====================
  const [goals, setGoals] = useState({
    calorieGoal: 0,
    proteinGoal: 0,
    carbsGoal: 0,
    fatGoal: 0,
  });
  // Fetch goals once user is available
  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${USERS_API_URL}/get-user`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        setGoals({
          calorieGoal: data.calorieGoal || 0,
          proteinGoal: data.proteinGoal || 0,
          carbsGoal: data.carbsGoal || 0,
          fatGoal: data.fatGoal || 0,
        });
        // Save scale type if available
        if (data.scaleType) {
          setScaleType(data.scaleType);
        }
      } catch (err) {
        console.warn("Failed to fetch user goals", err);
      }
    };

    if (user?.id) fetchGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Daily nutrition hook – fetch once when user is available
  const { summary: dailySummary, loadData: loadDailyNutrition } =
    useDailyNutrition(user?.id);

  useEffect(() => {
    if (user?.id) {
      loadDailyNutrition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // =====================
  // Nutrition calculations
  // =====================
  const sessionTotals = useMemo(() => {
    return logEntries.reduce((tot, entry) => {
      if (entry.direction !== "add") return tot; // this is a sanity check
      const n = entry.nutritionInfo || {};
      return {
        calories: tot.calories + Number(n.calories || 0),
        protein: tot.protein + Number(n.protein || 0),
        carbs: tot.carbs + Number(n.carbs || 0),
        fat: tot.fat + Number(n.fat || 0),
      };
    }, zeroMacros());
  }, [logEntries]);

  const dailyTotals = useMemo(() => {
    const backend = dailySummary?.dailyTotals || zeroMacros();
    return {
      calories: backend.calories + sessionTotals.calories,
      protein: backend.protein + sessionTotals.protein,
      carbs: backend.carbs + sessionTotals.carbs,
      fat: backend.fat + sessionTotals.fat,
    };
  }, [dailySummary, sessionTotals]);

  // Dimensions
  const { width: windowWidth } = useWindowDimensions();

  // Request permission if not granted (first render)
  useEffect(() => {
    if (permission === null) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Disable swipe-back gesture during an active session to prevent accidental navigation
  useEffect(() => {
    if (navigation?.setOptions) {
      navigation.setOptions({ gestureEnabled: !isSessionActive });
    }
  }, [isSessionActive, navigation]);

  // Capture & upload loop – start a new capture immediately after the previous
  useEffect(() => {
    let cancelled = false;

    const loop = async () => {
      // Stop the loop if the effect has been cleaned up or session paused/stopped
      if (cancelled || !isSessionActive || isPaused) return;

      // Await capture; captureAndProcessFrame already guards against concurrent
      // invocations with isCapturingRef.
      await captureAndProcessFrame();

      // Schedule the next capture in the next event loop tick so React can
      // process any state updates first.
      setTimeout(loop, 0);
    };

    if (isSessionActive && !isPaused) {
      loop();
    }

    return () => {
      cancelled = true;
    };
  }, [isSessionActive, isPaused]);

  // Start/stop blinking based on running state
  useEffect(() => {
    if (isSessionActive && !isPaused) {
      blinkAnim.setValue(0);
      // Prevent multiple loops
      if (blinkLoopRef.current) {
        blinkLoopRef.current.stop();
      }
      blinkLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
      blinkLoopRef.current.start();
    } else {
      // Stop blinking when paused or session ends
      if (blinkLoopRef.current) {
        blinkLoopRef.current.stop();
      }
      if (isPaused) {
        // Stop the animation and freeze the star at its current opacity
        blinkAnim.stopAnimation();
      } else if (!isSessionActive) {
        // Hide indicator only when session ends
        blinkAnim.setValue(0);
      }
    }

    return () => {
      if (blinkLoopRef.current) {
        blinkLoopRef.current.stop();
        blinkLoopRef.current = null;
      }
    };
  }, [isSessionActive, isPaused, blinkAnim]);

  // Navigate to dashboard when session ends
  useEffect(() => {
    if (sessionEnded && !isSaving) {
      // Notify other screens to reload their data
      setShouldRefresh(true);
      // Pop the Camera screen off the stack so there is no previous screen
      // left to swipe back to. If, for some reason, the stack is already
      // empty (e.g. user opened Camera directly via deep-link), fall back
      // to a replace.
      if (router.canGoBack?.()) {
        router.back();
      } else {
        router.replace("/(root)/(tabs)/dashboard");
      }
    }
  }, [sessionEnded, isSaving, router]);

  // --- Control Buttons Animation Helpers ---
  const animateControls = () =>
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  // Animate on pause/resume toggle to avoid abrupt shift
  const handlePauseToggle = () => {
    animateControls();
    // If currently running (not paused), stop the blinking animation instantly
    if (!isPaused) {
      if (blinkLoopRef.current) {
        blinkLoopRef.current.stop();
      }
      blinkAnim.stopAnimation();
    }
    togglePause();
  };

  // Animate the transition between Start ↔ Pause/Done
  const handleStartSession = async () => {
    animateControls();
    try {
      setIsLoading(true);
      setSessionEnded(false);
      startSession();
    } finally {
      setIsLoading(false);
    }
  };

  // Prompt user to pick a meal type before confirming end-session
  const endSessionFlow = () => {
    if (!logEntries.length) {
      Alert.alert("End Live Session", "No logs to save. End session?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: async () => {
            await endSession(false); // don't save
            setSessionEnded(true);
          },
        },
      ]);
      return;
    }

    const MEAL_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Snack"];

    // User has picked a meal type – immediately end the session without extra confirmation
    const handleSelected = async (selectedMeal) => {
      await endSession(true, selectedMeal); // save with selected meal type
      setSessionEnded(true);
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...MEAL_OPTIONS, "Discard", "Cancel"],
          cancelButtonIndex: MEAL_OPTIONS.length + 1,
          destructiveButtonIndex: MEAL_OPTIONS.length,
          title: "Select meal type",
        },
        (buttonIndex) => {
          if (buttonIndex === MEAL_OPTIONS.length + 1) return; // Cancel
          if (buttonIndex === MEAL_OPTIONS.length) {
            // Discard option
            Alert.alert(
              "Discard Session",
              "Are you sure you want to discard all logs? This action cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Discard",
                  style: "destructive",
                  onPress: async () => {
                    await endSession(false); // don't save
                    setSessionEnded(true);
                  },
                },
              ]
            );
            return;
          }
          handleSelected(MEAL_OPTIONS[buttonIndex]);
        }
      );
    } else {
      // Fallback using Alert with multiple buttons (Android supports many buttons)
      Alert.alert("Select Meal Type", "What type of meal is this?", [
        ...MEAL_OPTIONS.map((mt) => ({
          text: mt,
          onPress: () => handleSelected(mt),
        })),
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            await endSession(false); // don't save
            setSessionEnded(true);
            router.replace("/(root)/(tabs)/dashboard");
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const captureAndProcessFrame = async () => {
    // When the camera is still capturing (i.e., when isCapturingRef.current is true), we don't capture another frame
    if (!cameraRef.current || !cameraReady || isCapturingRef.current) return;
    isCapturingRef.current = true;
    try {
      const captured = await cameraRef.current.takePictureAsync({
        skipProcessing: true,
        shutterSound: false,
      });

      // Decide which edge is longer and resize accordingly while preserving aspect ratio
      const resizeAction =
        captured.width >= captured.height
          ? { resize: { width: FRAME_RESIZE_DIM_FOR_WEIGHT_DETECTION } }
          : { resize: { height: FRAME_RESIZE_DIM_FOR_WEIGHT_DETECTION } };

      // Resize + compress
      // Use new ImageManipulator contextual API (avoids deprecated manipulateAsync)
      const context = ImageManipulator.ImageManipulator.manipulate(
        captured.uri
      );
      context.resize(resizeAction.resize);
      const imageRef = await context.renderAsync();
      const { uri: resizedUri } = await imageRef.saveAsync({
        compress: FRAME_COMPRESSION_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      });

      const response = await fetch(resizedUri);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      await processFrame(bytes, resizedUri);

      setFrameTick((t) => t + 1);
    } catch (e) {
      if (e?.message?.includes("Camera unmounted")) {
        // Ignore benign race condition
      } else {
        console.error("Capture error", e);
      }
    } finally {
      isCapturingRef.current = false;
    }
  };

  // Delete a single log entry inside the active session
  const handleDeleteLogEntry = (logId) => {
    const entry = logEntries.find((e) => e.id === logId);

    Alert.alert(
      "Delete Log Entry",
      `Are you sure you want to delete \"${entry?.foodName || "this item"}\"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            try {
              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut
              );
              deleteLogEntry(logId);
            } catch (err) {
              console.error("Delete log entry error", err);
            }
          },
        },
      ]
    );
  };

  // Navigate to the edit screen for this log entry and automatically pause
  const editLogEntry = (logId) => {
    router.push({
      pathname: "/session-log-edit/[id]",
      params: {
        id: logId,
        sessionId: logEntries.find((e) => e.id === logId)?.sessionId,
      },
    });
  };

  if (permission === null) {
    return <PageLoader />;
  }
  if (!hasPermission) {
    return (
      <View style={cameraStyles.center}>
        <Text>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={cameraStyles.container}>
      {/* Camera Preview */}
      <View style={cameraStyles.cameraWrapper}>
        {/*
          Use `mode="video"` so the sensor stays in a continuous 30 fps pipeline. We
          can then grab single frames with `takePictureAsync` (with
          `skipProcessing: true`) without actually recording a video file.  This makes
          each capture fast and, on displays refreshed at 50/60 Hz, prevents the
          digit-flicker you noticed when shooting still photos.
        */}
        <CameraView
          ref={cameraRef}
          style={cameraStyles.camera}
          facing="back"
          mode="video"
          animateShutter={false}
          videoStabilizationMode="off"
          onCameraReady={() => setCameraReady(true)}
        />

        {/* Detection Status Overlay */}
        {isSessionActive && (
          <View style={cameraStyles.detectionOverlay}>
            <View style={cameraStyles.weightIndicator}>
              {/* Embedded Live Star */}
              <Animated.View
                style={{
                  opacity: blinkAnim,
                  marginRight: 4,
                  marginTop: 2,
                }}
              >
                <MaskedView
                  style={{
                    width: 24,
                    height: 24,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  maskElement={
                    <Ionicons name="sparkles" size={20} color="white" />
                  }
                >
                  <LinearGradient
                    colors={RAINBOW_COLORS}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, width: "100%" }}
                  />
                </MaskedView>
              </Animated.View>

              {displayedWeight !== null ? (
                <View style={{ alignItems: "flex-start" }}>
                  <Text
                    style={cameraStyles.weightText}
                  >{`${displayedWeight} g`}</Text>
                  {displayedConfidence && (
                    <Text style={cameraStyles.confidenceText}>
                      {Math.round(displayedConfidence * 100)}% confident
                    </Text>
                  )}
                </View>
              ) : (
                <Text
                  style={[
                    cameraStyles.weightText,
                    { fontSize: 12, textAlign: "left", lineHeight: 16.2 },
                  ]}
                >
                  Detecting{"\n"}kitchen scale...
                </Text>
              )}
            </View>
          </View>
        )}
        {isAnalyzing && (
          <View
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.7)",
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <ActivityIndicator
              size="small"
              color="#fff"
              style={{ transform: [{ scale: 0.75 }] }}
            />
            <Text
              style={{
                color: "#fff",
                marginLeft: 4,
                fontSize: 12,
                fontWeight: "bold",
              }}
            >
              Analyzing...
            </Text>
          </View>
        )}

        {/* DELETE LATER: Debug overlay showing images being sent to vision backend */}
        {debugImages?.length > 0 && (
          <View
            style={{
              position: "absolute",
              bottom: 100, // above control buttons
              left: 10,
              flexDirection: "row",
              backgroundColor: "rgba(0,0,0,0.3)",
              padding: 4,
              borderRadius: 6,
            }}
          >
            {debugImages.map(({ uri, label }, idx) => (
              <View
                key={idx}
                style={{
                  alignItems: "center",
                  marginRight: idx !== debugImages.length - 1 ? 4 : 0,
                }}
              >
                <Image
                  source={{ uri }}
                  style={{
                    width: 60,
                    height: 60,
                    borderColor: "#fff",
                    borderWidth: 1,
                  }}
                />
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 10,
                    marginTop: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        )}
        {/* DELETE LATER END */}

        {/* Controls Overlay */}
        <View style={cameraStyles.controlsOverlay}>
          {isSessionActive ? (
            <>
              <TouchableOpacity
                style={cameraStyles.controlBtn}
                onPress={handlePauseToggle}
                activeOpacity={0.5}
                disabled={isLoading}
              >
                <Ionicons
                  name={!isPaused ? "pause" : "play"}
                  size={14}
                  color="#fff"
                />
                <Text style={cameraStyles.controlText}>
                  {!isPaused ? " Pause" : " Resume"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cameraStyles.controlBtn, cameraStyles.endBtn]}
                onPress={endSessionFlow}
                activeOpacity={0.5}
                disabled={isLoading}
              >
                <Text style={cameraStyles.controlText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={cameraStyles.startBtn}
              onPress={handleStartSession}
              activeOpacity={0.5}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="play" size={12} color="#fff" />
                  <Text style={cameraStyles.controlText}> Start </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Saving Overlay */}
        {isSaving && (
          <View style={cameraStyles.savingOverlay}>
            <View style={cameraStyles.savingContent}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={cameraStyles.savingText}>Saving session...</Text>
            </View>
          </View>
        )}
      </View>

      {/* Macros Swiper */}
      <MacrosSwiper
        sessionTotals={sessionTotals}
        dailyTotals={dailyTotals}
        goals={goals}
      />

      {/* Live Log */}
      <View style={cameraStyles.logContainer}>
        <FlatList
          data={logEntries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionLogCard
              entry={item}
              onDelete={handleDeleteLogEntry}
              onEdit={editLogEntry}
            />
          )}
          ListEmptyComponent={
            <Text style={cameraStyles.emptyText}>
              No entries yet.{"\n\n"}AI detection may lag a few seconds.{"\n\n"}
              Using a phone stand to stabilize the phone is recommended.
            </Text>
          }
        />
      </View>
    </View>
  );
}
