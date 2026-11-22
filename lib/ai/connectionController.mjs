import { connectionIssue } from "../chatgpt/connectionStatus.mjs";
import { providerFor } from "./models.mjs";
import { modelName, shortName } from "./modelCatalog.mjs";
import { issueOutcome } from "./connectionMethods.mjs";
import { modelValue } from "./connectionPresentation.mjs";
import { summarizeUsage } from "./usage.mjs";

// Everything the AI connection pages know and do, with no screen attached, so Node tests can
// drive it. The connection page and the key page each hold one; the same transitions run for a
// ChatGPT sign-in and for a key. `services` is the live Keychain and network
// (lib/ai/connectionServices.js) or the in-memory preview (previewConnection.mjs).
//   current    undefined until read, null with nothing connected, else { type, provider?, masked? }
//   loaded     the first read has finished, ChatGPT's details included
//   account    who is signed in to ChatGPT
//   model      the model row's value
//   busy       null | "connect" | "disconnect"
//   status     what the last check found (an outcome word), or null while nothing is known
//   problem    { method, outcome, provider } from the last connect that didn't work
//   notice     { at: "search" | "disconnect" | "page", text }: something that didn't work, said once
//   search     Online search is on; searchable: the chosen model can search at all
//   usage      the last 7 days of requests (usage.mjs), every connection together
export const INITIAL_CONNECTION = Object.freeze({ current: undefined, loaded: false, account: null, model: null,
  search: true, searchable: true, usage: null, busy: null, status: null, problem: null, notice: null });

// The name a status is remembered under: the kind of connection, and the masked key for a key,
// so a new key never shows the last one's status.
export const statusId = current => (!current ? null : current.type === "chatgpt" ? "chatgpt" : `${current.type}:${current.masked}`);
// What a check can find that says nothing about the connection itself. The last status stays.
const UNSURE = new Set(["offline", "busy", "rate-limited", "failed"]);

export function createConnectionController(services, { onChange = () => {} } = {}) {
  let state = INITIAL_CONNECTION;
  let visit = 0;
  const set = patch => { state = { ...state, ...patch }; onChange(state); };
  const scoped = () => { const mine = visit; return () => visit === mine; };

  // A status changes only when a check finds something different, and is kept for next time.
  async function settle(current, outcome) {
    if (!current || !outcome || UNSURE.has(outcome) || outcome === state.status) return;
    set({ status: outcome });
    await Promise.resolve(services.saveStatus?.({ of: statusId(current), outcome })).catch(() => {});
  }

  // Reads the connection and shows it at once, with its last known status. Returns what
  // ChatGPT's details said, which for a sign-in is the check itself.
  async function refresh(isCurrent) {
    let current;
    try { current = await services.read(); } catch {
      if (isCurrent()) set({ current: null, loaded: true, account: null, model: null, status: null,
        notice: { at: "page", text: "Couldn’t read your connection. Close this page and open it again." } });
      return { current: null };
    }
    if (!isCurrent()) return { current };
    const [search, known] = await Promise.all([
      Promise.resolve(services.searchOn?.()).catch(() => true),
      Promise.resolve(services.lastStatus?.()).catch(() => null),
    ]);
    if (!isCurrent()) return { current };
    const status = current && known?.of === statusId(current) ? known.outcome : null;
    if (current?.type !== "chatgpt") {
      // A key's model is the person's choice or the default; no list is fetched for the row.
      const choice = current ? await Promise.resolve(services.keyModel?.(current.provider)).catch(() => null) : null;
      if (!isCurrent()) return { current };
      set({ current, loaded: true, account: null, status, search: search !== false, searchable: choice?.search !== false,
        model: current ? shortName(choice?.name) || modelName(current.provider, choice?.id || providerFor(current.provider)?.model) : null });
      return { current };
    }
    // Who is signed in is on this iPhone; the model and whether ChatGPT still answers follow.
    const account = await Promise.resolve(services.account?.()).catch(() => null);
    if (!isCurrent()) return { current };
    set({ current, status, search: search !== false, searchable: true, account: account?.email || null });
    let details;
    try { details = await services.chatgpt(); } catch (error) { details = { issue: connectionIssue(error) }; }
    if (!isCurrent()) return { current };
    set({ loaded: true, account: details?.account?.email || account?.email || null, model: modelValue(details || {}) });
    return { current, outcome: issueOutcome(details?.issue) };
  }

  return {
    get state() { return state; },
    // Every time a page comes into view: shows what is known at once, then checks the connection
    // without spending anything, and changes the status only if the check found something new.
    // A sign-in begun on an earlier visit is waited for, never started again. outcome: what the
    // key page's test found, when it just connected; that is this visit's check.
    async open({ outcome = null } = {}) {
      const isCurrent = (visit += 1, scoped());
      const pending = services.pending();
      set({ busy: pending ? "connect" : null, notice: null, problem: null });
      Promise.resolve(services.usageRows?.()).catch(() => null).then(rows => {
        if (isCurrent()) set({ usage: summarizeUsage(rows || []) });
      });
      if (pending) { try { await pending; } catch { /* Its own page reported it. */ } }
      if (!isCurrent()) return;
      const found = await refresh(isCurrent);
      if (!isCurrent()) return;
      set({ busy: null });
      if (!found.current) return;
      const checked = outcome || found.outcome || await Promise.resolve(services.check()).catch(() => null);
      if (isCurrent()) await settle(found.current, checked);
    },
    close() { visit += 1; },

    // Connects one way or the other. input: { draft } for a key. Returns what connecting found.
    async connect(method, input = {}) {
      if (state.busy) return null;
      const isCurrent = scoped();
      set({ busy: "connect", problem: null, notice: null });
      let result;
      try {
        result = await services.connect(method, input).catch(() => ({ outcome: "failed", connected: false }));
        if (!isCurrent()) return result;
        if (result.connected) {
          const found = await refresh(isCurrent);
          if (!isCurrent()) return result;
          await settle(found.current, found.outcome && !UNSURE.has(found.outcome) ? found.outcome : result.outcome);
        } else if (result.outcome !== "cancelled") {
          // Cancelling the sign-in sheet is a decision, not a problem: nothing is said.
          set({ problem: { method, outcome: result.outcome, provider: result.provider || null } });
        }
        return result;
      } finally { if (isCurrent()) set({ busy: null }); }
    },
    clearProblem() { if (state.problem) set({ problem: null }); },

    // Online search, the same switch for every connection. It shows the change at once and
    // puts it back if it couldn't be saved.
    async setSearch(on) {
      const before = state.search;
      set({ search: Boolean(on), notice: null });
      try { await services.setSearch(Boolean(on)); } catch {
        set({ search: before, notice: { at: "search", text: "Couldn’t save that. Try again." } });
      }
    },

    // Signs out of ChatGPT or removes the key, whichever is the connection. Usage stays.
    async disconnect() {
      if (state.busy || !state.current) return;
      const isCurrent = scoped();
      set({ busy: "disconnect", notice: null });
      try {
        await services.disconnect();
        await Promise.resolve(services.saveStatus?.(null)).catch(() => {});
        if (isCurrent()) set({ current: null, account: null, model: null, status: null });
      } catch {
        if (!isCurrent()) return;
        await refresh(isCurrent);
        if (isCurrent() && state.current) set({ notice: { at: "disconnect", text: "Couldn’t disconnect. Try again." } });
      } finally { if (isCurrent()) set({ busy: null }); }
    },
  };
}
