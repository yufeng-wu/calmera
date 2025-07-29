import { useCallback, useRef, useState, useEffect } from "react";
import { Session } from "@/lib/scale/classes";
import { Frame, LogEntry } from "@/lib/scale/classes";
import { detectNewState, addLogEntryHelper } from "@/lib/scale/stateManager";
import { FRAME_BUFFER_SIZE } from "@/lib/scale/constants";
import { detectWeightFromImage } from "@/lib/scale/weightDetector";
import { VISION_API_URL } from "@/constants/api";
import * as FileSystem from "expo-file-system";

/**
 * Centralised hook that owns live cooking session state, including frame buffer,
 * stable state detection and nutrition look-up via the backend.
 */
export function useCookingSession() {
  const sessionRef = useRef(new Session(FRAME_BUFFER_SIZE));
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
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
    console.log(`Cleaning up ${uris.length} files...`);
    await Promise.all(
      uris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }))
    );
    fileUrisRef.current.clear();
  };

  const startSession = () => {
    // Also clear files from any previous (cleanup-failed) session
    cleanupFiles();
    sessionRef.current.clear();
    setLogEntries([]);
    setIsRunning(true);
    setIsPaused(false);
  };

  const pauseSession = () => setIsPaused((prev) => !prev);

  const endSession = async (shouldSave = true) => {
    setIsRunning(false);
    setIsPaused(false);

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
        await fetch(`${SESSIONS_API_URL}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ log: Object.values(sessionRef.current.log) }),
        });
      } catch (err) {
        console.warn("Failed to save session log", err);
      }
    }
    await cleanupFiles();
  };

  const processFrame = useCallback(async (jpegUri) => {
    isProcessing.current = true;
    // Add new URI to the set so it can be cleaned up later
    fileUrisRef.current.add(jpegUri);

    // 1. Local weight detection (ROI + digits)
    const weightInfo = await detectWeightFromImage(jpegUri);
    const numericWeight = Number(weightInfo.weight);
    const digitConfs = (weightInfo.digitDetails || []).map((d) => d.confidence);
    const minConf = digitConfs.length ? Math.min(...digitConfs) : null;
    updateDetectionState(
      Number.isNaN(numericWeight) ? null : numericWeight,
      minConf
    );

    // 2. Push frame into local buffer
    console.log(
      `Session frame buffer size: ${sessionRef.current.frameBuffer.length}, ` +
        `Current state: ${sessionRef.current.currentState?.type}, ` +
        `Log entries: ${Object.keys(sessionRef.current.log).length}`
    );

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
      addLogEntryHelper(sessionRef.current, entry);
      setLogEntries(Object.values(sessionRef.current.log));
    }
    isProcessing.current = false;
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
    startSession,
    pauseSession,
    endSession,
    processFrame,
    logEntries,
    currentWeight,
    detectionConfidence,
  };
}
