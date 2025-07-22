import { useEffect, useRef, useState, useCallback } from "react";
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
  Image,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { useAuth } from "@clerk/clerk-expo";
import { SESSIONS_API_URL } from "@/constants/api";
import PageLoader from "@/components/PageLoader";
import { cameraStyles } from "@/assets/styles/camera.styles";
import { SessionLogCard } from "@/components/SessionLogCard";
import { getLocalTimeWithOffset } from "@/lib/utils";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";

const FRAME_UPLOAD_INTERVAL_MS = 500; // How often to send frames to backend (ms)
const BLANK_FRAME_COUNT_THRESHOLD = 4; // Number of consecutive frames that have no valid weight reading to show "Detecting Scale Reading..." message
const PAUSE_POLL_INTERVAL_MS = 1000; // How often to poll session log during pause (ms)
const MAX_PAUSE_POLLS = 8; // Maximum number of polls during pause period (reset to 0 once the session resumes)
const FRAME_RESIZE_DIMENSIONS = 450; // Frame resize width and height (px)
const FRAME_COMPRESSION_QUALITY = 0.3; // Frame compression quality (0-1, lower = more compression)

// Enable LayoutAnimation on Android for smooth/bouncy list updates
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RAINBOW_COLORS = ["#7694f8", "#7094f8", "#ac70a2", "#da808d", "#a85863"];

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const hasPermission = permission?.granted;

  // Session states
  const [sessionId, setSessionId] = useState(null);
  const [isRunning, setIsRunning] = useState(false); // capturing frames
  const [logEntries, setLogEntries] = useState([]);
  // Ref to track how many post-pause polls have been performed (<= MAX_PAUSE_POLLS)
  const pausePollCountRef = useRef(0);
  const [mealType, setMealType] = useState("Dinner"); // updated when user selects during end-session flow
  const [isLoading, setIsLoading] = useState(false);
  // Detection states
  const [currentWeight, setCurrentWeight] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const isCapturingRef = useRef(false);
  // Counts consecutive frames that have no valid weight reading.
  const blankFrameCountRef = useRef(0);
  // Blinking animation for live indicator
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const blinkLoopRef = useRef(null);
  // Context to signal dashboard refresh after session ends
  const { setShouldRefresh } = useRefreshSignal();

  // Clerk authentication helper for attaching the bearer token to protected API calls
  const { getToken } = useAuth();

  // Request permission if not granted (first render)
  useEffect(() => {
    if (permission === null) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Capture & upload loop
  useEffect(() => {
    let interval;
    if (isRunning && sessionId) {
      interval = setInterval(captureAndUploadFrame, FRAME_UPLOAD_INTERVAL_MS);
    }
    return () => clearInterval(interval);
  }, [isRunning, sessionId]);

  // Start/stop blinking based on running state
  useEffect(() => {
    if (isRunning) {
      blinkAnim.setValue(0);
      // Prevent multiple loops
      if (blinkLoopRef.current) {
        blinkLoopRef.current.stop();
      }
      blinkLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 800,
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
      // Stop blinking and hide indicator
      if (blinkLoopRef.current) {
        blinkLoopRef.current.stop();
        blinkLoopRef.current = null;
      }
      blinkAnim.setValue(0);
    }

    return () => {
      if (blinkLoopRef.current) {
        blinkLoopRef.current.stop();
        blinkLoopRef.current = null;
      }
    };
  }, [isRunning, blinkAnim]);

  // Smoothly animate transitions between "Detecting" and "123 g" states
  const animateWeightChange = () =>
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const updateDetectionState = (weight, confidence) => {
    animateWeightChange();
    setCurrentWeight(weight);
    setDetectionConfidence(confidence);
  };

  const startSession = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(SESSIONS_API_URL, { method: "POST" });
      if (!res.ok) throw new Error("Unable to create session");
      const data = await res.json();
      setSessionId(data.sessionId);
      // Smoothly animate the controls changing from "Start" to "Pause/End"
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsRunning(true);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const pauseSession = () => {
    if (isRunning) {
      // Pausing – simply stop the capture loop. Periodic polling handled via useEffect above.
      setIsRunning(false);
    } else {
      // Resuming capture – polling interval will auto-cleanup via dependency change.
      setIsRunning(true);
    }
  };

  // Prompt user to pick a meal type before confirming end-session
  const endSession = () => {
    if (!sessionId) return;

    // If no logs, end session directly without asking for meal type
    if (logEntries.length === 0) {
      Alert.alert("End Live Session", "No logs to save. End session?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: () => discardSession(),
        },
      ]);
      return;
    }

    const MEAL_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Snack"];

    // User has picked a meal type – immediately end the session without extra confirmation
    const handleSelected = (selectedMeal) => {
      sendEndSession(selectedMeal);
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
                  onPress: () => discardSession(),
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
          onPress: () => discardSession(),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  // Discard session without saving logs
  const discardSession = async () => {
    try {
      // Stop capture loop immediately to prevent extra uploads after deletion
      setIsRunning(false);
      setIsLoading(true);

      const token = await getToken();
      const res = await fetch(`${SESSIONS_API_URL}/${sessionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          discard: true,
          endedAt: getLocalTimeWithOffset(),
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to discard session");
      }

      await res.json();
      // Reset session state
      setSessionId(null);
      setLogEntries([]);

      // Navigate back without refreshing dashboard since we discarded
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Actually send the end-session request
  const sendEndSession = async (selectedMeal) => {
    try {
      // Stop capture loop immediately to prevent extra uploads after deletion
      setIsRunning(false);
      setIsLoading(true);

      setMealType(selectedMeal); // keep state consistent

      const token = await getToken();
      const res = await fetch(`${SESSIONS_API_URL}/${sessionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mealType: selectedMeal,
          endedAt: getLocalTimeWithOffset(),
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to end session");
      }

      await res.json();
      // Reset session state
      setSessionId(null);
      setLogEntries([]);

      // Signal the dashboard to refresh its data and navigate back
      setShouldRefresh(true);
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const captureAndUploadFrame = async () => {
    if (!cameraRef.current || !cameraReady || isCapturingRef.current) return;
    isCapturingRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        skipProcessing: true,
        shutterSound: false,
      });

      // single pass: resize + compress
      const { uri: resizedUri } = await ImageManipulator.manipulateAsync(
        photo.uri,
        [
          {
            resize: {
              width: FRAME_RESIZE_DIMENSIONS,
              height: FRAME_RESIZE_DIMENSIONS,
            },
          },
        ],
        {
          compress: FRAME_COMPRESSION_QUALITY, // lower quality for faster upload and LLM inference
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Print the file size of the resized frame (bytes)
      const fileInfo = await FileSystem.getInfoAsync(resizedUri);
      console.log(`Captured frame size: ${fileInfo.size} bytes`);

      await uploadFrame(resizedUri);
      // Clean up temporary files
      FileSystem.deleteAsync(resizedUri, { idempotent: true }).catch(() => {});
    } catch (e) {
      if (e?.message?.includes("Camera unmounted")) {
        // Ignore benign race condition when the camera is shutting down.
      } else {
        console.error("Capture error", e);
      }
    } finally {
      isCapturingRef.current = false;
    }
  };

  const uploadFrame = async (uri) => {
    if (!sessionId) return;
    const formData = new FormData();
    formData.append("image", {
      uri,
      name: `frame.jpg`,
      type: "image/jpeg",
    });
    try {
      const res = await fetch(`${SESSIONS_API_URL}/${sessionId}/frame`, {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      if (!res.ok) {
        console.warn("Failed to upload frame", await res.text());
        return;
      }

      // The backend returns { frame, log }
      const json = await res.json();
      const { frame, log } = json || {};

      // Update the UI immediately with the latest weight/confidence.
      if (frame) {
        const numericWeight = Number(frame.weight);
        let minConf = null;

        if (frame.weight == null || isNaN(numericWeight)) {
          // Invalid reading ─ bump the blank-frame counter.  Only after
          // three consecutive blanks do we clear the weight on-screen.
          blankFrameCountRef.current += 1;
          if (blankFrameCountRef.current >= BLANK_FRAME_COUNT_THRESHOLD) {
            updateDetectionState(null, null);
          }
        } else {
          // Got a valid reading: reset the blank-frame counter
          blankFrameCountRef.current = 0;

          // 0, positive or negative numbers are treated as valid
          const digitDetails = frame.metadata?.digitDetails ?? [];

          if (digitDetails.length) {
            // Determine overall confidence as the LOWEST confidence across all detected digits
            const confidences = digitDetails
              .map((d) => d.confidence)
              .filter((c) => c !== undefined && c !== null);

            if (confidences.length) {
              minConf = Math.min(...confidences);
            }
          }

          updateDetectionState(numericWeight, minConf);
        }
      }

      // Update the log list with the server-provided snapshot.
      if (log) {
        const entriesArray = Array.isArray(log) ? log : Object.values(log);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setLogEntries(entriesArray);
      }
    } catch (e) {
      console.error("Upload error", e);
    }
  };

  // ------------------------------------------------------------
  // Fetch helpers – used sparingly for the two explicit cases below
  // ------------------------------------------------------------
  const fetchSessionLog = useCallback(async () => {
    console.log("Inside fetchSessionLog()");
    if (!sessionId) return;
    try {
      const res = await fetch(`${SESSIONS_API_URL}/${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      const entries = data?.log ? Object.values(data.log) : [];
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLogEntries(entries);
    } catch (err) {
      console.error("fetchSessionLog error", err);
    }
  }, [sessionId]);

  // Case 1: When navigating back from the edit screen, pull the latest log once.
  useFocusEffect(
    useCallback(() => {
      if (sessionId) fetchSessionLog();
    }, [sessionId, fetchSessionLog])
  );

  // Case 2: When the session is paused, poll every second *up to* MAX_PAUSE_POLLS times.
  useEffect(() => {
    if (!sessionId) return;

    if (!isRunning) {
      // Reset counter at the start of each pause period
      pausePollCountRef.current = 0;

      const interval = setInterval(async () => {
        if (pausePollCountRef.current >= MAX_PAUSE_POLLS) {
          clearInterval(interval);
          return;
        }
        await fetchSessionLog();
        pausePollCountRef.current += 1;
      }, PAUSE_POLL_INTERVAL_MS);

      // Cleanup if component unmounts or session resumes
      return () => clearInterval(interval);
    }
  }, [isRunning, sessionId, fetchSessionLog]);

  // Delete a single log entry inside the active session
  const deleteLogEntry = async (logId) => {
    if (!sessionId || !logId) return;
    try {
      const res = await fetch(`${SESSIONS_API_URL}/${sessionId}/log/${logId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        console.warn("Failed to delete log entry", await res.text());
        return;
      }

      // Optimistically remove the entry from local state with animation
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLogEntries((prev) => prev.filter((e) => e.id !== logId));
    } catch (err) {
      console.error("Delete log entry error", err);
    }
  };

  // Navigate to the edit screen for this log entry and automatically pause
  const editLogEntry = (logId) => {
    if (!logId) return;
    // Pause capture loop while user is editing
    if (isRunning) setIsRunning(false);

    router.push({
      pathname: "/session-log-edit/[id]",
      params: { id: logId, sessionId },
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

        {/* Live Star Indicator */}
        {/* Live Star Indicator will now be embedded inside the weight indicator */}

        {/* Detection Status Overlay */}
        {sessionId && (
          <View style={cameraStyles.detectionOverlay}>
            <View style={cameraStyles.weightIndicator}>
              {/* Embedded Live Star */}
              <Animated.View
                style={{
                  opacity: isRunning ? blinkAnim : 0,
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

              {currentWeight !== null ? (
                <View style={{ alignItems: "flex-start" }}>
                  <Text
                    style={cameraStyles.weightText}
                  >{`${currentWeight}g`}</Text>
                  {detectionConfidence && (
                    <Text style={cameraStyles.confidenceText}>
                      {Math.round(detectionConfidence * 100)}% confident
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
          {sessionId ? (
            <>
              <TouchableOpacity
                style={cameraStyles.controlBtn}
                onPress={pauseSession}
                activeOpacity={0.5}
                disabled={isLoading}
              >
                <Ionicons
                  name={isRunning ? "pause" : "play"}
                  size={14}
                  color="#fff"
                />
                <Text style={cameraStyles.controlText}>
                  {isRunning ? " Pause" : " Resume"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cameraStyles.controlBtn, cameraStyles.endBtn]}
                onPress={endSession}
                activeOpacity={0.5}
                disabled={isLoading}
              >
                <Text style={cameraStyles.controlText}>Finish</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={cameraStyles.startBtn}
              onPress={startSession}
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
      </View>

      {/* Live Log */}
      <View style={cameraStyles.logContainer}>
        <FlatList
          data={logEntries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionLogCard
              entry={item}
              onDelete={deleteLogEntry}
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
