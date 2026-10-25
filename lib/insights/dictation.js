import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

const speech = requireOptionalNativeModule("ExpoSpeechRecognition");

// Live dictation into the chat box. Like voice logging, recognition runs on the
// phone only, so the audio never leaves it. finish() keeps the text; cancel() drops it.
export function useDictation({ language = "en-US", onDone }) {
  const [state, setState] = useState({ recording: false, transcript: "", level: 0 });
  const keep = useRef(false);
  const transcriptRef = useRef("");
  const subscriptions = useRef([]);

  const cleanup = useCallback(() => {
    subscriptions.current.forEach((item) => item.remove());
    subscriptions.current = [];
  }, []);
  useEffect(() => () => { cleanup(); speech?.abort?.(); }, [cleanup]);

  const start = useCallback(async () => {
    if (!speech?.supportsOnDeviceRecognition?.()) {
      Alert.alert("Dictation unavailable", "On-device speech recognition isn't available on this device.");
      return;
    }
    const permissions = await speech.requestPermissionsAsync();
    if (!permissions.granted) {
      Alert.alert("Microphone access", "Allow microphone and speech recognition in Settings to dictate.");
      return;
    }
    cleanup();
    keep.current = false;
    transcriptRef.current = "";
    subscriptions.current = [
      speech.addListener("result", (event) => {
        const text = event.results?.[0]?.transcript;
        if (typeof text === "string") { transcriptRef.current = text; setState((current) => ({ ...current, transcript: text })); }
      }),
      speech.addListener("volumechange", (event) => {
        // Reported roughly from -2 (silence) to 10 (loud).
        setState((current) => ({ ...current, level: Math.max(0, Math.min(1, (event.value + 2) / 12)) }));
      }),
      speech.addListener("error", (event) => {
        if (event.error !== "aborted" && event.error !== "no-speech") Alert.alert("Dictation stopped", "Couldn't hear that. Try again.");
      }),
      speech.addListener("end", () => {
        cleanup();
        const text = transcriptRef.current.trim();
        if (keep.current && text) onDone(text);
        setState({ recording: false, transcript: "", level: 0 });
      }),
    ];
    setState({ recording: true, transcript: "", level: 0 });
    try {
      speech.start({ lang: language, interimResults: true, continuous: true, requiresOnDeviceRecognition: true,
        addsPunctuation: true, volumeChangeEventOptions: { enabled: true, intervalMillis: 100 } });
    } catch {
      cleanup();
      setState({ recording: false, transcript: "", level: 0 });
    }
  }, [cleanup, language, onDone]);

  const finish = useCallback(() => { keep.current = true; speech?.stop(); }, []);
  const cancel = useCallback(() => { keep.current = false; speech?.abort(); }, []);
  return { ...state, available: Boolean(speech), start, finish, cancel };
}
