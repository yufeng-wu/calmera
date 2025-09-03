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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
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
import { useUser, useAuth } from "@clerk/clerk-expo";
import { USERS_API_URL } from "@/constants/api";
import { RAINBOW_COLORS } from "@/constants/colors";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import {
  FRAME_RESIZE_DIM_FOR_WEIGHT_DETECTION,
  FRAME_COMPRESSION_QUALITY,
  BLANK_FRAME_TOLERANCE,
} from "@/lib/scale/constants";
import StatusBar from "@/components/StatusBar";

// Small helper to zero-fill macro objects
const zeroMacros = () => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });

// Helper for smooth size/position changes (scaleXY provides nicer width/height interpolation)
const smoothLayout = () =>
  LayoutAnimation.configureNext({
    duration: 220,
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.scaleXY,
    },
  });

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
const MacrosCard = React.memo(function MacrosCard({ sessionTotals }) {
  const { width: windowWidth } = useWindowDimensions();

  // Match the width of <View style={cameraStyles.cameraWrapper}> which is 96% of screen width
  const CARD_WIDTH = windowWidth * 0.96;

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
        marginBottom: 0,
        marginTop: 0,
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
    <View style={{ marginBottom: 6, alignItems: "center" }}>
      <CardContainer>
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
              {sessionTotals.calories % 1 === 0
                ? Math.round(sessionTotals.calories)
                : sessionTotals.calories.toFixed(1)}{" "}
              kcal
            </Text>
            <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              Calories
            </Text>
          </View>
          {/* Protein */}
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontWeight: "600", fontSize: 14 }}>
              {sessionTotals.protein % 1 === 0
                ? Math.round(sessionTotals.protein)
                : sessionTotals.protein.toFixed(1)}{" "}
              g
            </Text>
            <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              Protein
            </Text>
          </View>
          {/* Carbs */}
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontWeight: "600", fontSize: 14 }}>
              {sessionTotals.carbs % 1 === 0
                ? Math.round(sessionTotals.carbs)
                : sessionTotals.carbs.toFixed(1)}{" "}
              g
            </Text>
            <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              Carbs
            </Text>
          </View>
          {/* Fat */}
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontWeight: "600", fontSize: 14 }}>
              {sessionTotals.fat % 1 === 0
                ? Math.round(sessionTotals.fat)
                : sessionTotals.fat.toFixed(1)}{" "}
              g
            </Text>
            <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              Fat
            </Text>
          </View>
        </View>
      </CardContainer>
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
  // Flag to determine if we are still checking the user's profile
  const [checkingUser, setCheckingUser] = useState(true);

  // Local paused flag for immediate UI feedback
  const [uiPaused, setUiPaused] = useState(false);

  // Fetch user's preferred scale type once on mount
  const { user } = useUser();
  const { getToken } = useAuth();

  // Ref mirror for quick synchronous checks inside async functions
  const pausedRef = useRef(false);

  useEffect(() => {
    const fetchScaleType = async () => {
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
        if (data.scaleType) setScaleType(data.scaleType);
        console.log("data.scaleType", data.scaleType);
        if (!data.scaleType) {
          // First-time user: show welcome & scale selector
          router.replace("/(root)/calmera-welcome");
          return;
        }
        setCheckingUser(false);
      } catch (err) {
        console.warn("Failed to fetch user scale type", err);
      }
    };

    if (user?.id) fetchScaleType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    statusBar,
    statusMeta,
  } = useCookingSession(scaleType);

  // Displayed weight/confidence with 2-blank-frame tolerance
  const [displayedWeight, setDisplayedWeight] = useState(null);
  const [displayedConfidence, setDisplayedConfidence] = useState(null);
  const blankCountRef = useRef(0);
  const [frameTick, setFrameTick] = useState(0);

  // Keep local flag in sync once the real pause state updates
  useEffect(() => {
    setUiPaused(isPaused);
  }, [isPaused]);

  // Update visible weight based on consecutive blank frames
  useEffect(() => {
    // Trigger smooth layout transition whenever weight visibility is about to change
    smoothLayout();

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

  // Smoothly animate overlay size changes when paused or weight display toggles
  useEffect(() => {
    smoothLayout();
  }, [isPaused, displayedWeight]);

  // Signal other screens (Dashboard, History) to refresh after session ends
  const { setShouldRefresh } = useRefreshSignal();

  const [isLoading, setIsLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const isCapturingRef = useRef(false);

  // Blinking animation for live indicator
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const blinkLoopRef = useRef(null);

  // Scale animation for status bullet
  const indicatorScale = useRef(new Animated.Value(1)).current;

  // Trigger a subtle pop animation whenever paused state or displayedWeight changes
  useEffect(() => {
    indicatorScale.setValue(0.92);
    Animated.spring(indicatorScale, {
      toValue: 1,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [isPaused, displayedWeight]);

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

  // Whether there are any logs recorded in the current session
  const hasLogs = logEntries.length > 0;

  // Handle back (<) press – replaces previous Exit/Save button
  const handleBackPress = () => {
    if (!isSessionActive) {
      // Not in session – simply navigate back
      if (router.canGoBack?.()) {
        router.back();
      } else {
        router.replace("/(root)/(tabs)/dashboard");
      }
      return;
    }

    if (!hasLogs) {
      // End session without saving and leave
      endSession(false).then(() => setSessionEnded(true));
      return;
    }

    // Auto-pause to stop further processing while user decides
    if (!isPaused) {
      togglePause();
    }

    // If logs exist, reuse existing flow to ask meal type
    endSessionFlow();
  };

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
        // Stop the animation and keep the star visible
        blinkAnim.setValue(1);
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
    // Trigger smooth bullet resize before state changes
    smoothLayout();
    animateControls();
    // Immediately set real pause state for consistent logic
    togglePause();
    // Reflect UI instantly (it now matches isPaused value)
    setUiPaused((prev) => !prev);
    // Keep star bright when pausing
    if (!isPaused) {
      blinkAnim.setValue(1);
    }
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
              "Discard Food Logs",
              "Are you sure? This action cannot be undone.",
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

  // --- NEW: Open Guide ---
  const openGuide = () => {
    if (isSessionActive && !isPaused) {
      togglePause();
    }
    router.push("/(root)/calmera-guide");
  };

  const captureAndProcessFrame = async () => {
    // Skip if paused or currently capturing
    if (
      !cameraRef.current ||
      !cameraReady ||
      isCapturingRef.current ||
      pausedRef.current
    )
      return;
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

      // Double-check before heavy processing
      if (!pausedRef.current) {
        await processFrame(bytes, resizedUri); // save the compressed image for each Frame
      }

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

  if (checkingUser || permission === null) {
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
      {/* Top Navigation Bar */}
      <View style={cameraStyles.topBar}>
        <TouchableOpacity
          style={cameraStyles.navBtn}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          {hasLogs ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="chevron-back" size={24} color="#000" />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: "#000",
                  marginLeft: 2,
                }}
              >
                Save & Exit
              </Text>
            </View>
          ) : (
            <Ionicons name="chevron-back" size={28} color="#000" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={cameraStyles.navBtn}
          onPress={openGuide}
          activeOpacity={0.7}
        >
          <Ionicons name="help-circle-outline" size={26} color="#000" />
        </TouchableOpacity>
      </View>

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

        {/* Status Bar */}
        <StatusBar status={statusBar} meta={statusMeta} />

        {/* Detection Status Overlay */}
        {isSessionActive && (
          <View style={cameraStyles.detectionOverlay}>
            <Animated.View
              style={[
                cameraStyles.weightIndicator,
                { transform: [{ scale: indicatorScale }] },
              ]}
            >
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

              {uiPaused ? (
                <Text
                  style={[
                    cameraStyles.weightText,
                    { fontSize: 13, textAlign: "left" },
                  ]}
                >
                  Paused
                </Text>
              ) : displayedWeight !== null ? (
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
            </Animated.View>
          </View>
        )}

        {/* Controls Overlay */}
        <View style={cameraStyles.controlsOverlay}>
          {isSessionActive ? (
            <TouchableOpacity
              style={cameraStyles.controlBtn}
              onPress={handlePauseToggle}
              activeOpacity={0.4}
              disabled={isLoading}
            >
              <Ionicons
                name={!isPaused ? "pause" : "play"}
                size={18}
                color="#fff"
                style={isPaused ? { marginLeft: 1.8 } : null}
              />
            </TouchableOpacity>
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
                  <Ionicons name="sparkles" size={12} color="#fff" />
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
      <MacrosCard sessionTotals={sessionTotals} />

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
            <View style={{ alignItems: "center" }}>
              <Text style={cameraStyles.emptyText}>
                {"\n\n"}No entries yet{"\n\n"}
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}
