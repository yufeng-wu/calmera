import { useCallback, useRef, useState, useEffect } from "react";
import { Session } from "@/lib/scale/classes";
import { Frame, LogEntry } from "@/lib/scale/classes";
import { detectNewState, addLogEntry } from "@/lib/scale/stateManager";
import {
  setActiveSession,
  clearActiveSession,
} from "@/lib/scale/sessionManager";
import {
  WEIGHT_BUFFER_SIZE,
  IMAGE_BUFFER_SIZE,
  LOW_CONFIDENCE_THRESHOLD,
} from "@/lib/scale/constants";
import { detectWeightFromImage } from "@/lib/scale/weightDetector";
import { VISION_API_URL, FOOD_ENTRIES_API_URL } from "@/constants/api";
import { useAuth } from "@clerk/clerk-expo";
import { getLocalTimeWithOffset, fetchWithTimeout } from "@/lib/utils";
import { DeviceEventEmitter } from "react-native";
import { releaseImage } from "@/lib/scale/imageManager";
import { STATUS } from "@/constants/statusBar";

/*
 * Centralised hook that owns live cooking session state, including frame buffer,
 * stable state detection and nutrition look-up via the backend.
 */
export function useCookingSession(scaleType) {
  const { getToken } = useAuth();
  const sessionRef = useRef(new Session(WEIGHT_BUFFER_SIZE, IMAGE_BUFFER_SIZE));
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isProcessing = useRef(false);
  const [currentWeight, setCurrentWeight] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(null);
  const [logEntries, setLogEntries] = useState([]);
  const [statusBar, setStatusBar] = useState(null);
  const [statusMeta, setStatusMeta] = useState({});

  const updateDetectionState = (w, conf) => {
    setCurrentWeight(w);
    setDetectionConfidence(conf);
  };

  const startSession = () => {
    sessionRef.current.clear(); // initialization: clear the frame buffer and current state
    setActiveSession(sessionRef.current);
    setLogEntries([]);
    setIsSessionActive(true);
    setIsPaused(false);
    // Show initializing state after user pressed Start
    setStatusBar(STATUS.INIT);
    setStatusMeta({});
  };

  const pauseSession = () => setIsPaused((prev) => !prev);

  const endSession = async (shouldSave = true, mealType = "Snack") => {
    setIsSessionActive(false);
    setIsPaused(false);
    setIsSaving(true);

    // Wait for any pending frame processing to complete
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!isProcessing.current) {
          clearInterval(interval);
          resolve();
        }
      }, 200);
    });

    if (shouldSave) {
      try {
        const entries = Object.values(sessionRef.current.log).filter(
          (e) => e.direction === "add"
        );

        const token = await getToken();

        // Create a promise that resolves when all entries are saved or times out
        await Promise.all(
          entries.map(async (entry) => {
            const foodEntryData = {
              foodName: entry.foodName,
              quantity: `${entry.absDeltaWeight} g`,
              calories: entry.nutritionInfo.calories,
              protein: entry.nutritionInfo.protein,
              carbs: entry.nutritionInfo.carbs,
              fat: entry.nutritionInfo.fat,
              mealType: mealType,
              // Use consistent timestamp = session start time
              createdAt: getLocalTimeWithOffset(
                new Date(sessionRef.current.createdAt)
              ),
            };

            const res = await fetchWithTimeout(
              FOOD_ENTRIES_API_URL,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(foodEntryData),
              },
              8000
            );
            return res;
          })
        );
      } catch (err) {
        console.warn("Failed to save food entries or timeout occurred", err);
      }
    }

    setIsSaving(false);
    clearActiveSession();
    // Clean up the current state's image (if any)
    if (sessionRef.current.currentState?.imagePath) {
      releaseImage(sessionRef.current.currentState.imagePath);
    }
    sessionRef.current.clear();
    // Hide status bar when session ends
    setStatusBar(null);
  };

  // Delete a log entry from the current session by id
  const deleteLogEntry = (logId) => {
    if (!logId || !sessionRef.current?.log?.[logId]) return;
    delete sessionRef.current.log[logId];
    setLogEntries(Object.values(sessionRef.current.log));
  };

  const processFrame = useCallback(
    async (imageBytes, imageUri) => {
      isProcessing.current = true;

      try {
        // 1. Local weight detection on user's device
        const weightInfo = await detectWeightFromImage(imageBytes, scaleType);
        const numericWeight = Number(weightInfo.weight);
        const digitConfs = (weightInfo.digitDetails || []).map(
          (d) => d.confidence
        );
        const minConf = digitConfs.length ? Math.min(...digitConfs) : null;

        // Ignore detections with low confidence
        const finalWeight =
          minConf < LOW_CONFIDENCE_THRESHOLD ? NaN : numericWeight;

        updateDetectionState(
          Number.isNaN(finalWeight) ? null : finalWeight,
          minConf
        );

        // 2. Push frame into local buffer (done in addFrame)
        //    ReleaseImage and memory management is done in addFrame
        const frame = new Frame({
          weight: finalWeight,
          uri: imageUri,
        });
        sessionRef.current.addFrame(frame);

        // initialization check: require ≥2 ~0 g frames (|w|<1) in last 5 and no positive weight
        if (!sessionRef.current.isInitialized) {
          const WINDOW = 3;
          const recent = sessionRef.current.frameBuffer.slice(-WINDOW);
          const isZero = (w) => Number.isFinite(w) && Math.abs(w) < 1;
          const zeroCount = recent.filter((f) => isZero(f.weight)).length;
          const hasPositive = recent.some(
            (f) => Number.isFinite(f.weight) && f.weight >= 1
          );
          if (zeroCount >= 2 && !hasPositive) {
            sessionRef.current.isInitialized = true;
            setStatusBar(STATUS.READY);
          }
        }

        // 3. Stable-state detection
        const newState = detectNewState(sessionRef.current, frame, imageUri);

        if (!newState) {
          return;
        }

        // grab the previous state, update the current state to the new state
        const prevState = sessionRef.current.currentState;
        sessionRef.current.currentState = newState;

        // If this is the first detected stable state after initialisation, prevState is null.
        // Treat the previous weight as 0g so the very first food addition/removal is captured.
        const effectivePrevState = prevState || {
          weight: 0,
          imagePath: null,
          timestamp: newState.timestamp,
        };

        const absDeltaWeight = Math.abs(
          newState.weight - effectivePrevState.weight
        );
        if (absDeltaWeight === 0) return;
        const direction =
          newState.weight > effectivePrevState.weight ? "add" : "remove";

        // If not initialized yet, ignore weight changes
        if (!sessionRef.current.isInitialized) {
          return;
        }

        // Update status for weight change
        setStatusBar(STATUS.WEIGHT_CHANGED);
        setStatusMeta({
          deltaStr: `${direction === "add" ? "+" : "-"}${absDeltaWeight}g`,
        });

        // 4. Remote nutrition lookup via backend API

        let foodName = "N/A";
        let nutrition = {};

        try {
          const form = new FormData();
          if (effectivePrevState.imagePath) {
            form.append("prevImage", {
              uri: effectivePrevState.imagePath,
              name: "prev.jpg",
              type: "image/jpeg",
            });
          }
          form.append("newImage", {
            uri: newState.imagePath,
            name: "new.jpg",
            type: "image/jpeg",
          });
          form.append("absDeltaWeight", String(absDeltaWeight));
          form.append(
            "existingFoodNames",
            JSON.stringify(
              Object.values(sessionRef.current.log).map((e) => e.foodName)
            )
          );

          const res = await fetchWithTimeout(
            `${VISION_API_URL}/compare`,
            {
              method: "POST",
              body: form,
            },
            10000
          );

          if (res.ok) {
            const json = await res.json();
            foodName = json.foodName;
            nutrition = json.nutrition;
          } else {
            const errText = await res.text();
            console.warn("[Session] /compare error", res.status, errText);
          }
        } catch (err) {
          if (err.name === "AbortError") {
            console.warn("[Session] /compare request timed out...");
          } else {
            console.warn("[Session] /compare request failed...", err);
          }
        }

        // Status bar update based on result
        if (foodName !== "N/A") {
          setStatusBar(STATUS.FOOD_LOGGED);
          const foodLines = `${
            direction === "add" ? "+" : "-"
          } ${absDeltaWeight}g ${foodName}`;
          setStatusMeta({ foodLines });
        } else {
          setStatusBar(STATUS.WEIGHT_CHANGE_IGNORED);
          setStatusMeta({
            deltaStr: `${direction === "add" ? "+" : "-"}${absDeltaWeight}g`,
          });
        }

        // Clean up the previous state's image asynchronously (if we actually had one)
        if (effectivePrevState?.imagePath) {
          releaseImage(effectivePrevState.imagePath);
        }

        // 5. Create log entry and update session log
        if (foodName !== "N/A") {
          const entry = new LogEntry({
            timestamp: newState.timestamp,
            absDeltaWeight,
            direction,
            foodName,
            nutritionInfo: nutrition,
          });
          addLogEntry(sessionRef.current, entry);
          setLogEntries(Object.values(sessionRef.current.log));
        }

        return; // early return after handling first state logic
      } catch (err) {
        // Ensure temp image is not leaked on any error
        releaseImage(imageUri);
        throw err; // re-throw so upstream can handle/log
      } finally {
        // reset processing flag so endSession can continue
        isProcessing.current = false;
      }
    },
    [scaleType]
  );

  // Listen for external log entry updates (e.g., edits from another screen)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("sessionLogUpdated", () => {
      setLogEntries(Object.values(sessionRef.current.log));
    });
    return () => sub.remove();
  }, []);

  return {
    isSessionActive,
    isPaused,
    isSaving,
    startSession,
    pauseSession,
    endSession,
    processFrame,
    logEntries,
    currentWeight,
    detectionConfidence,
    deleteLogEntry,
    statusBar,
    statusMeta,
  };
}
