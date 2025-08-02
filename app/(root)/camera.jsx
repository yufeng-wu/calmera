import { useEffect, useRef, useState, useMemo } from "react";
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
} from "react-native";
import Svg, { Circle } from "react-native-svg"; // leftover for other use, may remove later
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
import { RAINBOW_COLORS } from "@/constants/colors";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import React from "react";

const FRAME_UPLOAD_INTERVAL_MS = 500; // How often to send frames to backend (ms)
const FRAME_RESIZE_DIMENSIONS = 640; // Must match model input size
const FRAME_COMPRESSION_QUALITY = 0.3; // Frame compression quality (0-1, lower = more compression)
const BLANK_FRAME_TOLERANCE = 2; // Number of consecutive blank frames before we consider the scale undetected

// Small helper to zero-fill macro objects
const zeroMacros = () => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });

// Enable LayoutAnimation on Android for smooth/bouncy list updates
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const hasPermission = permission?.granted;

  // Session logic handled by custom hook
  const {
    isRunning,
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
  } = useCookingSession();

  // Displayed weight/confidence with 2-blank-frame tolerance
  const [displayedWeight, setDisplayedWeight] = useState(null);
  const [displayedConfidence, setDisplayedConfidence] = useState(null);
  const blankCountRef = useRef(0);

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
  }, [currentWeight, detectionConfidence]);

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

  // Swipable macros card component
  const MacrosSwiper = () => {
    const CARD_WIDTH = windowWidth * 0.96; // align with camera wrapper width
    const [page, setPage] = useState(0);
    const data = [sessionTotals, dailyTotals];

    // Helper component for multi-ring circular progress (daily page only)
    const MultiRingProgress = ({ totals }) => {
      const SIZE = 140;
      const STROKE_WIDTH = 10;
      const GAP = 3;
      const baseRadius = SIZE / 2 - STROKE_WIDTH / 2;

      const metrics = [
        {
          key: "calories",
          value: totals.calories,
          goal: goals.calorieGoal,
          color: "#ff3b30", // red
        },
        {
          key: "protein",
          value: totals.protein,
          goal: goals.proteinGoal,
          color: "#ff9500", // orange
        },
        {
          key: "carbs",
          value: totals.carbs,
          goal: goals.carbsGoal,
          color: "#007aff", // blue
        },
        {
          key: "fat",
          value: totals.fat,
          goal: goals.fatGoal,
          color: "#34c759", // green
        },
      ];

      return (
        <Svg width={SIZE} height={SIZE}>
          {metrics.map((m, idx) => {
            const r = baseRadius - idx * (STROKE_WIDTH + GAP);
            if (r <= 0) return null;
            const circ = 2 * Math.PI * r;
            const progress = m.goal > 0 ? Math.min(m.value / m.goal, 1) : 0;
            return (
              <React.Fragment key={m.key}>
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={r}
                  stroke="#eee"
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                />
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={r}
                  stroke={m.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={circ}
                  strokeDashoffset={circ * (1 - progress)}
                  strokeLinecap="round"
                  fill="none"
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              </React.Fragment>
            );
          })}
        </Svg>
      );
    };

    return (
      <View style={{ width: "96%", alignSelf: "center", marginBottom: 16 }}>
        <FlatList
          data={data}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, idx) => String(idx)}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
            setPage(idx);
          }}
          renderItem={({ item, index }) => {
            const ringColors = RAINBOW_COLORS || [
              "#ff3b30",
              "#ff9500",
              "#007aff",
              "#34c759",
            ];

            const CardContainer = ({ children }) => (
              <View
                style={{
                  width: CARD_WIDTH,
                  backgroundColor: "#fff",
                  borderRadius: 20,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  flexDirection: "column",
                  justifyContent: "space-between",
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

            if (index === 0) {
              // Session summary layout (no rings)
              return (
                <CardContainer>
                  <Text
                    style={{
                      alignSelf: "flex-start",
                      fontSize: 14,
                      fontWeight: "600",
                      marginBottom: 8,
                    }}
                  >
                    Session Summary
                  </Text>
                  <Text style={{ fontWeight: "700", fontSize: 16 }}>
                    {item.calories.toFixed(0)} kcal
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      width: "100%",
                      marginTop: 6,
                    }}
                  >
                    <Text style={{ fontWeight: "600", fontSize: 14 }}>
                      {item.protein.toFixed(1)} Protein
                    </Text>
                    <Text style={{ fontWeight: "600", fontSize: 14 }}>
                      {item.carbs.toFixed(1)} Carbs
                    </Text>
                    <Text style={{ fontWeight: "600", fontSize: 14 }}>
                      {item.fat.toFixed(1)} Fat
                    </Text>
                  </View>
                </CardContainer>
              );
            }

            // Daily summary layout with small inline rings
            return (
              <CardContainer>
                <Text
                  style={{
                    alignSelf: "flex-start",
                    fontSize: 14,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  Daily Summary
                </Text>

                {/* Calories row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontWeight: "700", fontSize: 16 }}>
                    {item.calories.toFixed(0)} kcal
                  </Text>
                  <ProgressRing
                    size={18}
                    strokeWidth={4}
                    value={item.calories}
                    goal={goals.calorieGoal}
                    color={ringColors[0]}
                    style={{ marginLeft: 6 }}
                  />
                </View>

                {/* Macros row with separators */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  {[
                    {
                      label: "Protein",
                      val: item.protein,
                      goal: goals.proteinGoal,
                      color: ringColors[1],
                    },
                    {
                      label: "Carbs",
                      val: item.carbs,
                      goal: goals.carbsGoal,
                      color: ringColors[2],
                    },
                    {
                      label: "Fat",
                      val: item.fat,
                      goal: goals.fatGoal,
                      color: ringColors[3],
                    },
                  ].map((m, idx) => (
                    <View
                      key={m.label}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontWeight: "600", fontSize: 12 }}>
                        {m.val.toFixed(1)} {m.label}
                      </Text>
                      <ProgressRing
                        size={14}
                        strokeWidth={3}
                        value={m.val}
                        goal={m.goal}
                        color={m.color}
                        style={{ marginLeft: 4 }}
                      />
                      {idx < 2 && (
                        <View
                          style={{
                            borderRightWidth: 1,
                            borderColor: "#ddd",
                            height: 24,
                            marginHorizontal: 6,
                          }}
                        />
                      )}
                    </View>
                  ))}
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
  };

  // Request permission if not granted (first render)
  useEffect(() => {
    if (permission === null) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Capture & upload loop
  useEffect(() => {
    let interval;
    if (isRunning && !isPaused) {
      interval = setInterval(captureAndProcessFrame, FRAME_UPLOAD_INTERVAL_MS);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  // Start/stop blinking based on running state
  useEffect(() => {
    if (isRunning && !isPaused) {
      blinkAnim.setValue(0);
      // Prevent multiple loops
      if (blinkLoopRef.current) {
        blinkLoopRef.current.stop();
      }
      blinkLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 0,
            duration: 600,
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
        blinkAnim.setValue(1); // Keep star visible but static when paused
      } else if (!isRunning) {
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
  }, [isRunning, isPaused, blinkAnim]);

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

  const handleStartSession = async () => {
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
      const photo = await cameraRef.current.takePictureAsync({
        skipProcessing: true,
        shutterSound: false,
      });

      // Decide which edge is longer and resize accordingly while preserving aspect ratio
      const resizeAction =
        photo.width >= photo.height
          ? { resize: { width: FRAME_RESIZE_DIMENSIONS } }
          : { resize: { height: FRAME_RESIZE_DIMENSIONS } };

      // Resize + compress
      const { uri: resizedUri, base64: resizedBase64 } =
        await ImageManipulator.manipulateAsync(photo.uri, [resizeAction], {
          compress: FRAME_COMPRESSION_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });

      await processFrame(resizedUri, resizedBase64);
    } catch (e) {
      if (e?.message?.includes("Camera unmounted")) {
        // Ignore benign race condition
      } else {
        console.error("Capture error", e);
      }
    } finally {
      // Reset capturing state
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
        {isRunning && (
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
                  >{`${displayedWeight}g`}</Text>
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

        {/* Controls Overlay */}
        <View style={cameraStyles.controlsOverlay}>
          {isRunning ? (
            <>
              <TouchableOpacity
                style={cameraStyles.controlBtn}
                onPress={togglePause}
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
                <Text style={cameraStyles.controlText}>Finish</Text>
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
                  <Ionicons name="play" size={14} color="#fff" />
                  <Text style={cameraStyles.controlText}>Start</Text>
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
      <MacrosSwiper />

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
