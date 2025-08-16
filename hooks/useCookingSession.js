import { useCallback, useRef, useState, useEffect } from "react";
import { Session } from "@/lib/scale/classes";
import { Frame, LogEntry } from "@/lib/scale/classes";
import { detectNewState, addLogEntry } from "@/lib/scale/stateManager";
import {
  setActiveSession,
  clearActiveSession,
} from "@/lib/scale/sessionManager";
import { WEIGHT_BUFFER_SIZE, IMAGE_BUFFER_SIZE } from "@/lib/scale/constants";
import { detectWeightFromImage } from "@/lib/scale/weightDetector";
import { VISION_API_URL, FOOD_ENTRIES_API_URL } from "@/constants/api";
import { useAuth } from "@clerk/clerk-expo";
import { getLocalTimeWithOffset, fetchWithTimeout } from "@/lib/utils";
import { DeviceEventEmitter } from "react-native";
import { releaseImage } from "@/lib/utils";

/*
 * Centralised hook that owns live cooking session state, including frame buffer,
 * stable state detection and nutrition look-up via the backend.
 */
export function useCookingSession(scaleType) {
  const { getToken } = useAuth();
  const sessionRef = useRef(new Session(WEIGHT_BUFFER_SIZE, IMAGE_BUFFER_SIZE));
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isProcessing = useRef(false);
  const [currentWeight, setCurrentWeight] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logEntries, setLogEntries] = useState([]);

  const updateDetectionState = (w, conf) => {
    setCurrentWeight(w);
    setDetectionConfidence(conf);
  };

  const startSession = () => {
    sessionRef.current.clear(); // initialization: clear the frame buffer and current state
    setActiveSession(sessionRef.current);
    setLogEntries([]);
    setIsRunning(true);
    setIsPaused(false);
  };

  const pauseSession = () => setIsPaused((prev) => !prev);

  const endSession = async (shouldSave = true, mealType = "Snack") => {
    setIsRunning(false);
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
        updateDetectionState(
          Number.isNaN(numericWeight) ? null : numericWeight,
          minConf
        );

        // 2. Push frame into local buffer (done in addFrame)
        //    ReleaseImage and memory management is done in addFrame
        const frame = new Frame({
          weight: numericWeight,
          uri: imageUri,
        });
        sessionRef.current.addFrame(frame);

        // 3. Stable-state detection
        const newState = detectNewState(sessionRef.current, frame, imageUri);

        if (!newState) {
          return;
        }

        // grab the previous state, update the current state to the new state
        const prevState = sessionRef.current.currentState;
        sessionRef.current.currentState = newState;

        // If we are detecting the very first state, we don't have a previous state to compare to.
        // So we return.
        if (!prevState) return;

        const absDeltaWeight = Math.abs(newState.weight - prevState.weight);
        if (absDeltaWeight === 0) return;
        const direction = newState.weight > prevState.weight ? "add" : "remove";

        // 4. Remote nutrition lookup via backend API
        let foodName = "N/A";
        let nutrition = {};

        try {
          setIsAnalyzing(true);
          const form = new FormData();
          form.append("prevImage", {
            uri: prevState.imagePath,
            name: "prev.jpg",
            type: "image/jpeg",
          });
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
        } finally {
          setIsAnalyzing(false);
        }

        // Clean up the previous state's image asynchronously
        if (prevState?.imagePath) {
          releaseImage(prevState.imagePath);
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
    isRunning,
    isPaused,
    isSaving,
    startSession,
    pauseSession,
    endSession,
    processFrame,
    logEntries,
    currentWeight,
    detectionConfidence,
    isAnalyzing,
    deleteLogEntry,
  };
}
