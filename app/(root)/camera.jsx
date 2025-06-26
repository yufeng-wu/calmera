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
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import {
  SESSIONS_API_URL,
  FRAME_UPLOAD_INTERVAL_MS,
  LOG_POLL_INTERVAL_SEC,
} from "@/constants/api";
import PageLoader from "@/components/PageLoader";
import { cameraStyles } from "@/assets/styles/camera.styles";
import { SessionLogCard } from "@/components/SessionLogCard";
import { getLocalTimeWithOffset } from "@/lib/utils";

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

  // Session states
  const [sessionId, setSessionId] = useState(null);
  const [isRunning, setIsRunning] = useState(false); // capturing frames
  const [isFetchingLog, setIsFetchingLog] = useState(false);
  const [logEntries, setLogEntries] = useState([]);
  const [mealType, setMealType] = useState("Dinner"); // updated when user selects during end-session flow
  const [isLoading, setIsLoading] = useState(false);
  // Detection states
  const [currentWeight, setCurrentWeight] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const isCapturingRef = useRef(false);

  // Request permission if not granted (first render)
  useEffect(() => {
    if (permission === null) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Poll session info every X seconds only while the session is actively running
  useEffect(() => {
    if (!sessionId || !isRunning) return;

    const poller = setInterval(fetchSessionLog, LOG_POLL_INTERVAL_SEC * 1000);

    return () => clearInterval(poller);
  }, [sessionId, isRunning]);

  // When returning to this screen (after editing a log entry, for example),
  // fetch the latest log once.
  useFocusEffect(
    useCallback(() => {
      if (sessionId) {
        fetchSessionLog();
      }
    }, [sessionId])
  );

  // Capture & upload loop
  useEffect(() => {
    let interval;
    if (isRunning && sessionId) {
      interval = setInterval(captureAndUploadFrame, FRAME_UPLOAD_INTERVAL_MS);
    }
    return () => clearInterval(interval);
  }, [isRunning, sessionId]);

  const startSession = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(SESSIONS_API_URL, { method: "POST" });
      if (!res.ok) throw new Error("Unable to create session");
      const data = await res.json();
      setSessionId(data.sessionId);
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
      // Pausing – immediately refresh the log once.
      setIsRunning(false);
      fetchSessionLog();
    } else {
      // Resuming capture
      setIsRunning(true);
    }
  };

  // Prompt user to pick a meal type before confirming end-session
  const endSession = () => {
    if (!sessionId) return;

    const MEAL_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Snack"];

    const handleSelected = (selectedMeal) => {
      // Second confirmation alert
      Alert.alert(
        "End Session",
        `End session and import logs as ${selectedMeal}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "End",
            style: "destructive",
            onPress: () => sendEndSession(selectedMeal),
          },
        ]
      );
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...MEAL_OPTIONS, "Cancel"],
          cancelButtonIndex: MEAL_OPTIONS.length,
          title: "Select meal type",
        },
        (buttonIndex) => {
          if (buttonIndex === MEAL_OPTIONS.length) return; // Cancel
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
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  // Actually send the end-session request
  const sendEndSession = async (selectedMeal) => {
    try {
      // Stop capture loop immediately to prevent extra uploads after deletion
      setIsRunning(false);
      setIsLoading(true);

      setMealType(selectedMeal); // keep state consistent

      const res = await fetch(`${SESSIONS_API_URL}/${sessionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
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
      setSessionId(null);
      setLogEntries([]);
      Alert.alert("Session ended", "Log imported successfully.");
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
      // Grab the current video-frame as a JPEG.  Using `skipProcessing` makes
      // the operation almost instantaneous and avoids triggering the
      // still-photo pipeline that caused flicker.
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        skipProcessing: true,
        shutterSound: false,
      });
      // Resize to 640×640 then compress before upload.
      const saveOptions = {
        compress: 0.3,
        format: ImageManipulator.SaveFormat.JPEG,
      };

      let resizedUri;
      // Prefer the newer chain-based API when available (Expo SDK 53+)
      if (typeof ImageManipulator.manipulate === "function") {
        const ctx = ImageManipulator.manipulate(photo.uri);
        ctx.resize({ width: 640, height: 640 });
        const imageRef = await ctx.renderAsync();
        ({ uri: resizedUri } = await imageRef.saveAsync(saveOptions));
      } else {
        // Fallback for older SDKs
        const result = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 640, height: 640 } }],
          saveOptions
        );
        resizedUri = result.uri;
      }

      await uploadFrame(resizedUri);
      // Clean up temporary files
      FileSystem.deleteAsync(resizedUri, { idempotent: true }).catch(() => {});
      FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => {});
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

      // The backend returns an object { frame: { ... } }
      const json = await res.json();
      const frame = json?.frame;

      // Update the UI immediately with the latest weight/confidence.
      if (frame) {
        const numericWeight = Number(frame.weight);
        let minConf = null;

        if (frame.weight == null || isNaN(numericWeight)) {
          // reject only null / undefined / NaN
          setCurrentWeight(null);
          setDetectionConfidence(null);
        } else {
          // 0, positive or negative numbers are treated as valid
          setCurrentWeight(numericWeight);

          const digitDetails = frame.metadata?.digitDetails ?? [];
          if (digitDetails.length) {
            // Determine overall confidence as the LOWEST confidence across all detected digits
            const confidences = digitDetails
              .map((d) => d.confidence)
              .filter((c) => c !== undefined && c !== null);

            if (confidences.length) {
              minConf = Math.min(...confidences);
              setDetectionConfidence(minConf);
            } else {
              setDetectionConfidence(null);
            }
          } else {
            setDetectionConfidence(null);
          }
        }
      }
    } catch (e) {
      console.error("Upload error", e);
    }
  };

  const fetchSessionLog = async () => {
    if (!sessionId) return;
    setIsFetchingLog(true);
    try {
      const res = await fetch(`${SESSIONS_API_URL}/${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch session info");

      const data = await res.json();

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLogEntries(data.log ? Object.values(data.log) : []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingLog(false);
    }
  };

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
      pathname: "/log-edit/[id]",
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

        {/* Detection Status Overlay */}
        {sessionId && (
          <View style={cameraStyles.detectionOverlay}>
            {currentWeight !== null ? (
              <View style={cameraStyles.weightIndicator}>
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
              <View style={cameraStyles.weightIndicator}>
                <Text style={cameraStyles.weightText}>
                  Detecting kitchen scale...
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={cameraStyles.controlsContainer}>
        {sessionId ? (
          <>
            <TouchableOpacity
              style={[
                cameraStyles.controlBtn,
                isRunning && cameraStyles.controlBtnActive,
              ]}
              onPress={pauseSession}
              disabled={isLoading}
            >
              <Ionicons
                name={isRunning ? "pause" : "play"}
                size={24}
                color="#fff"
              />
              <Text style={cameraStyles.controlText}>
                {isRunning ? "Pause" : "Resume"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cameraStyles.controlBtn, cameraStyles.endBtn]}
              onPress={endSession}
              disabled={isLoading}
            >
              <Ionicons name="stop" size={24} color="#fff" />
              <Text style={cameraStyles.controlText}>End</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={cameraStyles.startBtn}
            onPress={startSession}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="play" size={24} color="#fff" />
                <Text style={cameraStyles.controlText}>Start</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Live Log */}
      <View style={cameraStyles.logContainer}>
        <Text style={cameraStyles.logTitle}>Live Food Log</Text>
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
