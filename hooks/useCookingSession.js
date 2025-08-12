import { useCallback, useRef, useState, useEffect } from "react";
import { Session } from "@/lib/scale/classes";
import { Frame, LogEntry } from "@/lib/scale/classes";
import { detectNewState, addLogEntry } from "@/lib/scale/stateManager";
import {
  setActiveSession,
  clearActiveSession,
} from "@/lib/scale/sessionManager";
import { FRAME_BUFFER_SIZE } from "@/lib/scale/constants";
import { detectWeightFromImage } from "@/lib/scale/weightDetector";
import { VISION_API_URL, FOOD_ENTRIES_API_URL } from "@/constants/api";
import { useAuth } from "@clerk/clerk-expo";
import { getLocalTimeWithOffset } from "@/lib/utils";
import * as FileSystem from "expo-file-system";
import { DeviceEventEmitter } from "react-native";

/**
 * Centralised hook that owns live cooking session state, including frame buffer,
 * stable state detection and nutrition look-up via the backend.
 */
export function useCookingSession() {
  const { getToken } = useAuth();
  const sessionRef = useRef(new Session(FRAME_BUFFER_SIZE)); // TODO: what is sessionRef.current?
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isProcessing = useRef(false);
  // Keep track of all frame URIs created in this session
  const fileUrisRef = useRef(new Set());
  // Map<uri, number> – simple ref-count so we don't delete a file while still in use
  const fileRefCountsRef = useRef({});
  const [currentWeight, setCurrentWeight] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(null);
  const [logEntries, setLogEntries] = useState([]);

  const updateDetectionState = (w, conf) => {
    setCurrentWeight(w);
    setDetectionConfidence(conf);
  };

  const addRef = (uri) => {
    if (!uri) return;
    fileRefCountsRef.current[uri] = (fileRefCountsRef.current[uri] || 0) + 1;
  };

  /**
   * Decrements the ref-count for a uri and deletes the underlying file once the
   * count reaches 0.  Errors from deleteAsync are swallowed because files may
   * already be removed by the OS or another cleanup pass (idempotent).
   */
  const releaseRef = (uri) => {
    if (!uri || !fileRefCountsRef.current[uri]) return;
    fileRefCountsRef.current[uri] -= 1;
    if (fileRefCountsRef.current[uri] <= 0) {
      delete fileRefCountsRef.current[uri];
      // Fire-and-forget – we don't want to block the main flow for deletes.
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  };

  /**
   * Release all refs held (typically when a session ends or the component
   * unmounts).  This will delete every remaining cached file.
   */
  const cleanupFiles = async () => {
    const uris = Object.keys(fileRefCountsRef.current);
    for (const u of uris) {
      while (fileRefCountsRef.current[u] && fileRefCountsRef.current[u] > 0) {
        releaseRef(u);
      }
    }
    fileUrisRef.current.clear();
  };

  const startSession = () => {
    // Reset createdAt to now for a fresh session
    sessionRef.current.createdAt = new Date();
    // Also clear files from any previous (cleanup-failed) session
    cleanupFiles();
    sessionRef.current.clear();
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
        const savePromise = Promise.all(
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

            const res = await fetch(FOOD_ENTRIES_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(foodEntryData),
            });
            return res;
          })
        );

        // Add timeout of 5 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Save timeout")), 5000);
        });

        // Race between save and timeout
        await Promise.race([savePromise, timeoutPromise]);
      } catch (err) {
        console.warn("Failed to save food entries or timeout occurred", err);
      }
    }

    await cleanupFiles();
    setIsSaving(false);
    clearActiveSession();
  };

  // Delete a log entry from the current session by id
  const deleteLogEntry = (logId) => {
    if (!logId || !sessionRef.current?.log?.[logId]) return;
    delete sessionRef.current.log[logId];
    setLogEntries(Object.values(sessionRef.current.log));
  };

  const processFrame = useCallback(async (jpegUri, base64Data) => {
    isProcessing.current = true;

    try {
      // Add new URI to the set so it can be cleaned up later
      fileUrisRef.current.add(jpegUri);
      addRef(jpegUri);

      // 1. Local weight detection
      const weightInfo = await detectWeightFromImage(jpegUri, base64Data);
      const numericWeight = Number(weightInfo.weight);
      const digitConfs = (weightInfo.digitDetails || []).map(
        (d) => d.confidence
      );
      const minConf = digitConfs.length ? Math.min(...digitConfs) : null;
      updateDetectionState(
        Number.isNaN(numericWeight) ? null : numericWeight,
        minConf
      );

      // 2. Push frame into local buffer (with manual eviction tracking)
      let evictedImageUri = null;
      if (sessionRef.current.frameBuffer.length >= FRAME_BUFFER_SIZE) {
        // The frame about to be evicted is at index 0 (oldest)
        evictedImageUri = sessionRef.current.frameBuffer[0].imagePath;
      }

      const frame = new Frame({
        timestamp: new Date().toISOString(),
        imagePath: jpegUri,
        weight: numericWeight,
        metadata: weightInfo,
      });
      sessionRef.current.addFrame(frame);

      if (evictedImageUri) {
        // Frame was evicted from buffer so release its ref
        releaseRef(evictedImageUri);
        fileUrisRef.current.delete(evictedImageUri);
      }

      // 3. Stable-state detection – protect the frame image while we decide
      addRef(jpegUri); // temporary ref for state evaluation

      const newState = detectNewState(sessionRef.current, frame);

      if (!newState) {
        // Not a new stable state → drop the temporary ref
        releaseRef(jpegUri);
        return;
      }

      // prevState still points to the old object at the moment
      // which we can use to releaseRef later.
      const prevState = sessionRef.current.currentState;
      sessionRef.current.currentState = newState;

      if (!prevState) return; // first state, nothing to compare

      const absDeltaWeight = Math.abs(newState.weight - prevState.weight);
      if (absDeltaWeight === 0) return;
      const direction = newState.weight > prevState.weight ? "add" : "remove";

      // 4. Remote nutrition lookup via backend API
      let foodName = "N/A";
      let nutrition = {};

      try {
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
        const res = await fetch(`${VISION_API_URL}/compare`, {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          const json = await res.json();
          foodName = json.foodName;
          nutrition = json.nutrition;
        } else {
          const errText = await res.text();
          console.warn("[Session] /compare error", res.status, errText);
        }
      } catch (err) {
        console.warn("[Session] /compare request failed", err);
      }

      // The previous state's image is no longer needed after the compare request
      if (prevState?.imagePath) {
        releaseRef(prevState.imagePath);
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
    } finally {
      // Always reset processing flag so endSession can continue
      isProcessing.current = false;
    }
  }, []);

  // Make sure we clean up if the user navigates away mid-session
  useEffect(() => {
    return () => {
      cleanupFiles();
    };
  }, []);

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
    deleteLogEntry,
  };
}
