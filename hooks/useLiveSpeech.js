import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { speechEngine } from "@/lib/voice/speechEngine";
import { joinTranscript, levelFromVolume, VOICE_LIMIT_MS } from "@/lib/voice/voiceLog.mjs";

// Live, on-device dictation for the voice sheet. Audio never leaves the phone: only the words
// are kept, and pausing ends a recognition session so the next one's words follow on.
// status: idle → starting → listening → stopping → paused (and back to starting on resume).
export default function useLiveSpeech({ language, onLevel }) {
  const engine = useRef(speechEngine()).current;
  const [status, setStatus] = useState("idle");
  const [committed, setCommitted] = useState("");
  const [segment, setSegment] = useState("");
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const statusRef = useRef("idle");
  const committedRef = useRef("");
  const segmentRef = useRef("");
  const startedAt = useRef(0);
  const listenedMs = useRef(0);
  const endWaiters = useRef([]);
  const level = useRef(onLevel);
  level.current = onLevel;
  const mounted = useRef(true);

  const moveTo = useCallback(next => {
    statusRef.current = next;
    if (mounted.current) setStatus(next);
  }, []);

  const settle = useCallback(() => {
    if (startedAt.current) listenedMs.current += Date.now() - startedAt.current;
    startedAt.current = 0;
    committedRef.current = joinTranscript(committedRef.current, segmentRef.current);
    segmentRef.current = "";
    level.current?.(0);
    if (mounted.current) { setCommitted(committedRef.current); setSegment(""); setElapsed(listenedMs.current); }
    moveTo("paused");
    const waiters = endWaiters.current;
    endWaiters.current = [];
    waiters.forEach(resolve => resolve());
  }, [moveTo]);

  useEffect(() => {
    mounted.current = true;
    if (!engine) return undefined;
    const subscriptions = [
      engine.addListener("start", () => {
        startedAt.current = Date.now();
        if (statusRef.current === "starting") moveTo("listening");
      }),
      engine.addListener("result", event => {
        const text = event?.results?.[0]?.transcript;
        if (typeof text !== "string" || statusRef.current === "idle") return;
        segmentRef.current = text;
        if (mounted.current) setSegment(text);
      }),
      engine.addListener("volumechange", event => {
        if (statusRef.current === "listening") level.current?.(levelFromVolume(event?.value));
      }),
      engine.addListener("error", event => {
        const code = event?.error;
        if (code === "aborted") return;
        if (mounted.current) setError(code || "unavailable");
      }),
      engine.addListener("end", () => { if (statusRef.current !== "idle") settle(); }),
    ];
    return () => {
      mounted.current = false;
      subscriptions.forEach(subscription => subscription?.remove?.());
      if (["starting", "listening", "stopping"].includes(statusRef.current)) {
        try { engine.abort(); } catch { /* Already stopped. */ }
      }
      statusRef.current = "idle";
      endWaiters.current.forEach(resolve => resolve());
      endWaiters.current = [];
    };
  }, [engine, moveTo, settle]);

  const start = useCallback(() => {
    if (!engine) { setError("unavailable"); return; }
    if (["starting", "listening", "stopping"].includes(statusRef.current)) return;
    setError(null);
    moveTo("starting");
    try {
      engine.start({
        lang: language || "en-US", interimResults: true, continuous: true, addsPunctuation: true,
        requiresOnDeviceRecognition: true, iosTaskHint: "dictation",
        volumeChangeEventOptions: { enabled: true, intervalMillis: 50 },
      });
    } catch {
      setError("unavailable");
      moveTo("paused");
    }
  }, [engine, language, moveTo]);

  const pause = useCallback(() => {
    if (!["starting", "listening"].includes(statusRef.current)) return;
    moveTo("stopping");
    level.current?.(0);
    try { engine.stop(); } catch { settle(); }
  }, [engine, moveTo, settle]);

  // Stops listening and resolves with everything heard, waiting briefly for the final words.
  const finish = useCallback(async () => {
    if (["starting", "listening", "stopping"].includes(statusRef.current)) {
      const ended = new Promise(resolve => endWaiters.current.push(resolve));
      if (statusRef.current !== "stopping") { moveTo("stopping"); try { engine.stop(); } catch { settle(); } }
      const late = setTimeout(() => {
        if (statusRef.current !== "stopping") return;
        try { engine.abort(); } catch { /* Already stopped. */ }
        settle();
      }, 2500);
      await ended;
      clearTimeout(late);
    }
    return committedRef.current;
  }, [engine, moveTo, settle]);

  // While paused the words can be corrected by hand; resuming adds to the corrected text.
  const editText = useCallback(text => {
    if (statusRef.current !== "paused") return;
    committedRef.current = text;
    setCommitted(text);
  }, []);

  // Leaving the app (home screen, app switcher, a call) pauses listening, so the mic is never
  // on behind the user's back. The words stay, and Resume picks up where they left off.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => { if (state !== "active") pause(); });
    return () => subscription.remove();
  }, [pause]);

  // Listening pauses itself at the limit.
  useEffect(() => {
    if (status !== "listening") return undefined;
    const timer = setInterval(() => {
      const total = listenedMs.current + (startedAt.current ? Date.now() - startedAt.current : 0);
      setElapsed(total);
      if (total >= VOICE_LIMIT_MS) { setError("limit"); pause(); }
    }, 250);
    return () => clearInterval(timer);
  }, [status, pause]);

  const text = joinTranscript(committed, segment);
  return { available: Boolean(engine), status, text, committed, error, elapsed, start, pause, finish, editText, clearError: () => setError(null) };
}
