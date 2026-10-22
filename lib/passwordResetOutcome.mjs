// Per-mounted-form outcome only; no password/token persistence. This does
// not add SDK timeouts or cancellation; callers supply presentation activity.
export function createPasswordResetOutcome() {
  let inFlight = null;
  let resetComplete = false;
  let finalOutcome = null;
  return {
    hasCompletedReset: () => resetComplete,
    getOutcome: () => finalOutcome,
    run({ resetPassword, activateSession, onResetComplete, isActive = () => true }) {
      if (inFlight) return inFlight;
      if (resetComplete) return Promise.resolve(finalOutcome);
      const request = Promise.resolve().then(async () => {
        if (!isActive()) return { kind: "inactive" };
        let result;
        try { result = await resetPassword(); }
        catch { return { kind: "reset-failed" }; }
        if (result?.status !== "complete") return { kind: "reset-incomplete" };
        // Password reset is irreversible even if subsequent activation fails.
        resetComplete = true;
        try {
          onResetComplete?.();
          if (!isActive()) { finalOutcome = { kind: "activation-failed" }; return finalOutcome; }
          await activateSession(result.createdSessionId);
          finalOutcome = { kind: "complete" };
        } catch { finalOutcome = { kind: "activation-failed" }; }
        return finalOutcome;
      });
      const pending = request.finally(() => { if (inFlight === pending) inFlight = null; });
      inFlight = pending;
      return pending;
    },
  };
}
