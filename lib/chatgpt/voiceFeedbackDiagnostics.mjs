// Test-build callers only. Bounded, memory-only metadata; never stores input/output.
const codes = new Set(["starting", "recording", "released", "processing", "duration",
  "file_duration", "transcribing", "estimating", "saving", "completed", "cancelled", "too_short", "failed", "idle"]);
let snapshot = [];
let startedAt = 0;
const listeners = new Set();
export const voiceFeedbackDiagnostics = {
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  getSnapshot: () => snapshot,
  mark(code, durationMs) {
    if (!codes.has(code)) return;
    if (code === "starting") { snapshot = []; startedAt = Date.now(); }
    const item = { code, elapsedMs: Math.max(0, Date.now() - startedAt) };
    if ((code === "duration" || code === "file_duration") && Number.isFinite(durationMs)) item.durationMs = Math.max(0, Math.round(durationMs));
    snapshot = [...snapshot, item].slice(-20);
    listeners.forEach(listener => listener());
  },
};
