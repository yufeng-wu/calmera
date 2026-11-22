import { connectionIssue } from "../chatgpt/connectionStatus.mjs";
import { providerFor } from "./models.mjs";
import { issueOutcome } from "./connectionMethods.mjs";
import { modelValue, problemFor, switchNotice } from "./connectionPresentation.mjs";

// Everything the AI connection pages know and do, with no screen attached, so Node tests can
// drive it. The connection page and the connect page each hold one; the same transitions run
// for a ChatGPT sign-in and for a key. `services` is the live Keychain and network
// (lib/ai/connectionServices.js) or the in-memory preview (previewConnection.mjs).
//   current    undefined until read, null with nothing connected, else { type, provider?, masked? }
//   loaded     the first read has finished, ChatGPT's details included
//   account    who is signed in to ChatGPT
//   model      the model row's value
//   busy       null | "connect" | "check" | "disconnect"
//   attention  an outcome that means "connect this way again" (a sign-out, a refused key)
//   check      { outcome } from Check connection, or from the check a new key just passed
//   problem    { method, outcome, provider } from the last connect that didn't work
//   notice     { tone: "good" | "bad", text }, said once
export const INITIAL_CONNECTION = Object.freeze({ current: undefined, loaded: false, account: null, model: null,
  busy: null, attention: null, check: null, problem: null, notice: null });

const quiet = new Set(["offline", "busy", "rate-limited"]);

export function createConnectionController(services, { onChange = () => {} } = {}) {
  let state = INITIAL_CONNECTION;
  let visit = 0;
  const set = patch => { state = { ...state, ...patch }; onChange(state); };
  const scoped = () => { const mine = visit; return () => visit === mine; };

  async function refresh(isCurrent) {
    let current;
    try { current = await services.read(); } catch {
      if (isCurrent()) set({ current: null, loaded: true, account: null, model: null, attention: null,
        notice: { tone: "bad", text: "Couldn’t read your connection. Close this page and open it again." } });
      return null;
    }
    if (!isCurrent()) return current;
    if (current?.type !== "chatgpt") {
      set({ current, loaded: true, account: null, attention: null, model: current ? providerFor(current.provider)?.modelName || null : null });
      return current;
    }
    // The row shows at once; who is signed in and whether ChatGPT still answers follow.
    set({ current });
    let details;
    try { details = await services.chatgpt(); } catch (error) { details = { issue: connectionIssue(error) }; }
    if (!isCurrent()) return current;
    const outcome = issueOutcome(details?.issue);
    const problem = problemFor("chatgpt", outcome);
    set({ loaded: true, account: details?.account?.email || null, model: modelValue(details || {}),
      attention: problem?.fix === "reconnect" ? outcome : null,
      // Not reaching ChatGPT right now isn't news; anything else is shown like a check result.
      ...(problem && problem.fix !== "reconnect" && !quiet.has(outcome) ? { check: { outcome } } : {}) });
    return current;
  }

  return {
    get state() { return state; },
    // Every time a page comes into view. A sign-in begun on an earlier visit is waited for,
    // never started again. outcome: what the connect page's check found, when it just connected.
    async open({ outcome = null } = {}) {
      const isCurrent = (visit += 1, scoped());
      const previous = state.current;
      const pending = services.pending();
      // What was said on the last visit has been read; it isn't said twice.
      set({ busy: pending ? "connect" : null, notice: null, problem: null });
      if (pending) { try { await pending; } catch { /* Its own page reported it. */ } }
      if (!isCurrent()) return;
      const current = await refresh(isCurrent);
      if (!isCurrent()) return;
      const notice = previous === undefined ? null : switchNotice(previous, current);
      set({ busy: null, ...(notice ? { notice: { tone: "good", text: notice } } : {}),
        ...(outcome ? { check: outcome === "works" ? null : { outcome } } : {}) });
    },
    close() { visit += 1; },

    // Connects one way or the other. The old connection stays until the new one works, then goes.
    // input: { draft } for a key, { newAccount } for ChatGPT. Returns what connecting found.
    async connect(method, input = {}) {
      if (state.busy) return null;
      const isCurrent = scoped();
      set({ busy: "connect", problem: null, notice: null, check: null });
      let result;
      try {
        result = await services.connect(method, input).catch(() => ({ outcome: "failed", connected: false }));
        if (!isCurrent()) return result;
        if (result.connected) {
          set({ attention: null });
          await refresh(isCurrent);
        } else if (result.outcome !== "cancelled") {
          // Cancelling the sign-in sheet is a decision, not a problem: nothing is said.
          set({ problem: { method, outcome: result.outcome, provider: result.provider || null } });
        }
        return result;
      } finally { if (isCurrent()) set({ busy: null }); }
    },
    clearProblem() { if (state.problem) set({ problem: null }); },

    // One small request with the connection in use, so a person can see it works without logging a meal.
    async check() {
      if (state.busy || !state.current) return;
      const isCurrent = scoped();
      set({ busy: "check", notice: null, check: null });
      try {
        const outcome = await services.check().catch(() => "failed");
        if (!isCurrent()) return;
        if (!outcome) { await refresh(isCurrent); return; }
        const method = state.current.type === "chatgpt" ? "chatgpt" : "key";
        const fix = problemFor(method, outcome, state.current.provider)?.fix;
        set({ check: { outcome }, attention: fix === "reconnect" ? outcome : null });
      } finally { if (isCurrent()) set({ busy: null }); }
    },

    // Signs out of ChatGPT or removes the key, whichever is the connection.
    async disconnect() {
      if (state.busy || !state.current) return;
      const isCurrent = scoped();
      set({ busy: "disconnect", notice: null, check: null });
      try {
        await services.disconnect();
        if (isCurrent()) set({ current: null, account: null, model: null, attention: null });
      } catch {
        if (!isCurrent()) return;
        await refresh(isCurrent);
        if (isCurrent() && state.current) set({ notice: { tone: "bad", text: "Couldn’t disconnect. Try again." } });
      } finally { if (isCurrent()) set({ busy: null }); }
    },
  };
}
