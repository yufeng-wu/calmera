// The languages voice logging can listen in, with the names Settings shows for them.
export const VOICE_LANGUAGES = Object.freeze([{ value: "en-US", label: "English" }, { value: "zh-CN", label: "中文" }]);

// Device-local preference only. Actual writes outlive the page observing them;
// abandoning a read never releases an unfinished write or retries persistence.
export function createVoiceLanguagePreferences(storage) {
  const owners = new Map();
  const failure = code => {
    const error = new Error(code);
    error.code = code;
    error.timedOut = code === "voice_language_timeout";
    error.cancelled = code === "voice_language_cancelled";
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
        throw failure("voice_language_load_failed");
      }
      if (signal?.aborted || !isActive()) throw failure("voice_language_cancelled");
      const key = `calmera.voice.${userId}`;
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
      const onAbort = () => stop("voice_language_cancelled");
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
      const timer = setTimeout(() => stop("voice_language_timeout"), timeoutMs);
      const check = () => {
        if (stoppedCode) throw failure(stoppedCode);
        if (signal?.aborted || !isActive()) throw failure("voice_language_cancelled");
        if (Date.now() >= expiresAt) {
          stop("voice_language_timeout");
          throw failure("voice_language_timeout");
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
          catch { check(); throw failure("voice_language_load_failed"); }
          check();
          // A write started while getItem was pending. Its old snapshot cannot
          // become the confirmed selection, even if that write already settled.
          if (state.revision !== revision) continue;
          return value || "en-US";
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
    save(userId, language) {
      if (!VOICE_LANGUAGES.some(({ value }) => value === language)) return Promise.reject(new Error("invalid_voice_language"));
      const key = `calmera.voice.${userId}`;
      const state = stateFor(key);
      state.revision += 1;
      const task = (state.pending || Promise.resolve()).catch(() => {})
        .then(() => storage.setItem(key, language))
        .catch(() => { throw failure("voice_language_save_failed"); });
      state.pending = task;
      const settled = () => {
        if (state.pending === task) state.pending = null;
        release(key, state);
      };
      task.then(settled, settled);
      return task;
    },
  };
}
