import { DEFAULT_MEAL_TIMES, validMealTimes } from "./mealTimes.mjs";

// Device-local preference only. Actual writes outlive the page observing them;
// abandoning a read never releases an unfinished write or retries persistence.
export function createMealTimePreferences(storage) {
  const owners = new Map();
  const failure = code => {
    const error = new Error(code);
    error.code = code;
    error.timedOut = code === "meal_times_timeout";
    error.cancelled = code === "meal_times_cancelled";
    if (error.cancelled) error.name = "AbortError";
    return error;
  };
  const stateFor = key => {
    if (!owners.has(key)) owners.set(key, { pending: null, revision: 0, readers: 0 });
    return owners.get(key);
  };
  const release = (key, state) => {
    if (!state.pending && !state.readers && owners.get(key) === state) owners.delete(key);
  };

  return {
    async load(userId, { signal, isActive = () => true, timeoutMs = 20000 } = {}) {
      if (typeof isActive !== "function" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw failure("meal_times_load_failed");
      }
      if (signal?.aborted || !isActive()) throw failure("meal_times_cancelled");
      if (!/^[\w:-]{1,180}$/.test(userId || "")) throw failure("meal_times_owner_required");
      const key = `calmera.meal-times.${userId}`;
      const state = stateFor(key);
      state.readers += 1;
      const expiresAt = Date.now() + timeoutMs;
      let stoppedCode = null;
      let rejectStopped;
      const stopped = new Promise((_, reject) => { rejectStopped = reject; });
      const stop = code => {
        if (stoppedCode) return;
        stoppedCode = code;
        rejectStopped(failure(code));
      };
      const onAbort = () => stop("meal_times_cancelled");
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
      const timer = setTimeout(() => stop("meal_times_timeout"), timeoutMs);
      const check = () => {
        if (stoppedCode) throw failure(stoppedCode);
        if (signal?.aborted || !isActive()) throw failure("meal_times_cancelled");
        if (Date.now() >= expiresAt) {
          stop("meal_times_timeout");
          throw failure("meal_times_timeout");
        }
      };
      const read = (async () => {
        for (;;) {
          check();
          if (state.pending) {
            // Re-read the pending slot after every write: another selection may
            // have joined the same owner's queue while this read was waiting.
            await state.pending.catch(() => {});
            check();
            continue;
          }
          const revision = state.revision;
          let value;
          try { value = await storage.getItem(key); }
          catch { check(); throw failure("meal_times_load_failed"); }
          check();
          // A write started while getItem was pending. Its old snapshot cannot
          // become the confirmed selection, even if that write already settled.
          if (state.revision !== revision) continue;
          if (!value) return { ...DEFAULT_MEAL_TIMES };
          try {
            const times = JSON.parse(value);
            return validMealTimes(times) ? { ...times } : { ...DEFAULT_MEAL_TIMES };
          } catch { return { ...DEFAULT_MEAL_TIMES }; }
        }
      })();
      try { return await Promise.race([read, stopped]); }
      finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        state.readers -= 1;
        release(key, state);
      }
    },
    save(userId, times, { timeoutMs = 20000 } = {}) {
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(failure("meal_times_save_failed"));
      if (!/^[\w:-]{1,180}$/.test(userId || "")) return Promise.reject(failure("meal_times_owner_required"));
      if (!validMealTimes(times)) return Promise.reject(new Error("invalid_meal_times"));
      const snapshot = JSON.stringify(times);
      const key = `calmera.meal-times.${userId}`;
      const state = stateFor(key);
      state.revision += 1;
      const task = (state.pending || Promise.resolve()).catch(() => {})
        .then(() => storage.setItem(key, snapshot))
        .catch(() => { throw failure("meal_times_save_failed"); });
      state.pending = task;
      const settled = () => {
        if (state.pending === task) state.pending = null;
        release(key, state);
      };
      task.then(settled, settled);
      // A UI deadline never releases the underlying native-write barrier.
      let timer;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(failure("meal_times_timeout")), timeoutMs); });
      return Promise.race([task, timeout]).finally(() => clearTimeout(timer));
    },
  };
}
