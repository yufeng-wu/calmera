import { connectionIssue, isAuthorizationCancelled } from "../chatgpt/connectionStatus.mjs";
import { modelValue, switchNotice } from "./connectionPresentation.mjs";

// Everything the AI connection page knows and does, with no screen attached, so Node tests can
// drive it. `services` is the live Keychain and network (lib/ai/connectionServices.js) or the
// in-memory preview. State is replaced, never mutated; onChange gets each new one.
//   current   undefined until read, null with nothing connected, else { type, provider, masked }
//   loaded    the first read has finished, ChatGPT's details included
//   email, issue, model   ChatGPT only
//   busy      null | "sign-in" | "disconnect" | "check"
//   notice    { tone: "good" | "bad", text } said once under the two rows
//   check     what the last key check found
export const INITIAL_CONNECTION = Object.freeze({ current: undefined, loaded: false, email: null, issue: null, model: null,
  busy: null, notice: null, check: null });

export function createConnectionController(services, { onChange = () => {} } = {}) {
  let state = INITIAL_CONNECTION;
  let visit = 0;
  // After a sign-in that failed, the next one starts a fresh registration with OpenAI.
  let startFresh = false;
  const set = patch => { state = { ...state, ...patch }; onChange(state); };

  async function refresh(isCurrent) {
    let current;
    try { current = await services.read(); } catch {
      if (isCurrent()) set({ current: null, loaded: true, email: null, issue: null, model: null,
        notice: { tone: "bad", text: "Couldn’t read your connection. Close this page and open it again." } });
      return null;
    }
    if (!isCurrent()) return current;
    if (current?.type !== "chatgpt") { set({ current, loaded: true, email: null, issue: null, model: null }); return current; }
    // The row shows at once; who is signed in and whether ChatGPT still answers follow.
    set({ current });
    let details;
    try { details = await services.chatgpt(); } catch (error) { details = { issue: connectionIssue(error) }; }
    if (isCurrent()) set({ loaded: true, email: details?.account?.email || null, issue: details?.issue || null, model: modelValue(details || {}) });
    return current;
  }

  return {
    get state() { return state; },
    // Every time the page comes into view. A sign-in begun on an earlier visit is waited for,
    // never started again. keyOutcome: what the key page's check found, when it just saved a key.
    async open({ keyOutcome = null } = {}) {
      const mine = ++visit; const isCurrent = () => visit === mine;
      const previous = state.current;
      const pending = services.pending();
      // What was said on the last visit has been read; it isn't said twice.
      set({ busy: pending ? "sign-in" : null, notice: null });
      if (pending) { try { await pending; } catch { /* Its own caller reported it. */ } }
      if (!isCurrent()) return;
      const current = await refresh(isCurrent);
      if (!isCurrent()) return;
      const notice = previous === undefined ? null : switchNotice(previous, current);
      set({ busy: null, ...(notice ? { notice: { tone: "good", text: notice } } : {}),
        ...(keyOutcome ? { check: keyOutcome === "works" ? null : { outcome: keyOutcome } } : {}) });
    },
    close() { visit += 1; },

    async signIn() {
      if (state.busy) return;
      const mine = visit; const isCurrent = () => visit === mine;
      const previous = state.current;
      set({ busy: "sign-in", notice: null, check: null });
      try {
        await services.signIn({ newAccount: startFresh });
        startFresh = false;
        if (!isCurrent()) return;
        // Details are read before the row turns: a held issue would show it signed out for a beat.
        set({ issue: null });
        await refresh(isCurrent);
        const notice = switchNotice(previous, { type: "chatgpt" });
        if (isCurrent() && notice) set({ notice: { tone: "good", text: notice } });
      } catch (error) {
        // Cancelling the sign-in sheet is a decision, not a problem: nothing is said.
        if (isAuthorizationCancelled(error) || !isCurrent()) return;
        startFresh = true;
        const issue = connectionIssue(error);
        set({ notice: { tone: "bad", text: issue.kind === "temporary"
          ? "Sign-in didn’t finish. Check your internet connection and try again." : issue.message } });
      } finally { if (isCurrent()) set({ busy: null }); }
    },

    // Signs out of ChatGPT or removes the key, whichever is the connection.
    async disconnect() {
      if (state.busy || !state.current) return;
      const mine = visit; const isCurrent = () => visit === mine;
      set({ busy: "disconnect", notice: null, check: null });
      try {
        await services.disconnect();
        if (isCurrent()) set({ current: null, email: null, issue: null, model: null });
      } catch {
        if (!isCurrent()) return;
        await refresh(isCurrent);
        if (isCurrent() && state.current) set({ notice: { tone: "bad", text: "Couldn’t disconnect. Try again." } });
      } finally { if (isCurrent()) set({ busy: null }); }
    },

    // One tiny request with the saved key, so a person can see it works without logging a meal.
    async checkKey() {
      if (state.busy || !state.current || state.current.type === "chatgpt") return;
      const mine = visit; const isCurrent = () => visit === mine;
      set({ busy: "check", notice: null, check: null });
      try {
        const outcome = await services.checkKey().catch(() => "failed");
        if (!isCurrent()) return;
        if (outcome) set({ check: { outcome } }); else await refresh(isCurrent);
      } finally { if (isCurrent()) set({ busy: null }); }
    },
  };
}
