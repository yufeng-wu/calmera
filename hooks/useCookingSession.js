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
  const [currentWeight, setCurrentWeight] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(null);
  const [logEntries, setLogEntries] = useState([]);

  const updateDetectionState = (w, conf) => {
    setCurrentWeight(w);
    setDetectionConfidence(conf);
  };

  const cleanupFiles = async () => {
    const uris = Array.from(fileUrisRef.current);
    await Promise.all(
      uris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }))
    );
    fileUrisRef.current.clear();
  };

  const startSession = () => {
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
              createdAt: getLocalTimeWithOffset(new Date(entry.timestamp)),
            };

            return fetch(FOOD_ENTRIES_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(foodEntryData),
            });
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

      // 1. Local weight detection (ROI + digits)
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

      // 2. Push frame into local buffer
      const frame = new Frame({
        timestamp: new Date().toISOString(),
        imagePath: jpegUri,
        weight: numericWeight,
        metadata: weightInfo,
      });
      sessionRef.current.addFrame(frame);

      // 3. Stable-state detection
      const newState = detectNewState(sessionRef.current, frame);
      if (!newState) return;

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
        form.append("newImage", {
          uri: newState.imagePath,
          name: "new.jpg",
          type: "image/jpeg",
        });
        form.append("prevImage", {
          uri: prevState.imagePath,
          name: "prev.jpg",
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
          console.warn("Gemini endpoint error", await res.text());
        }
      } catch (err) {
        console.warn("Gemini request failed", err);
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
