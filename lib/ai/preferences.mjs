// How calmera's AI works for this person, kept in app storage on this iPhone (nothing secret):
//   search   look things up online when it helps; on unless turned off
//   models   the model chosen for each kind of key, or null for the default. With it go
//            what the provider said the model can do (effort, search), so requests fit it.
//   status   what the last check of the connection found, { of, outcome }, so the AI connection
//            page shows it at once next time. `of` names the connection (its type and masked key).
// ChatGPT's model choice stays with its sign-in (planClient). "Erase all data" removes this, as
// it removes every calmera key in app storage.
export const preferencesKey = owner => `calmera.ai.v1.${owner}`;
const ID = /^[\w.:-]{1,200}$/;

function cleanChoice(choice) {
  if (!choice || typeof choice !== "object" || !ID.test(choice.id || "")) return null;
  return { id: choice.id, name: typeof choice.name === "string" ? choice.name.slice(0, 120) : null,
    ...(typeof choice.effort === "boolean" ? { effort: choice.effort } : {}), ...(typeof choice.search === "boolean" ? { search: choice.search } : {}) };
}
const cleanStatus = status => status && typeof status.of === "string" && status.of.length <= 120 && /^[a-z-]{1,40}$/.test(status.outcome || "")
  ? { of: status.of, outcome: status.outcome } : null;
export function normalizePreferences(value) {
  return { search: value?.search !== false, models: { anthropic: cleanChoice(value?.models?.anthropic), openai: cleanChoice(value?.models?.openai) },
    status: cleanStatus(value?.status) };
}

// storage: { getItem, setItem } (AsyncStorage). Read fresh each time: erasing can empty storage
// under a long-lived app. Writes go one at a time.
export function createAIPreferences({ storage, owner }) {
  if (!/^[\w-]{1,150}$/.test(owner || "")) throw new Error("calmera_sign_in_required");
  const key = preferencesKey(owner);
  let writes = Promise.resolve();
  async function read() {
    try { return normalizePreferences(JSON.parse(await storage.getItem(key) || "null")); }
    catch { return normalizePreferences(null); }
  }
  const update = change => {
    const next = writes.then(async () => {
      const value = change(await read());
      await storage.setItem(key, JSON.stringify(value));
      return value;
    });
    writes = next.catch(() => {});
    return next;
  };
  return {
    read,
    async model(provider) { return (await read()).models[provider] || null; },
    setModel: (provider, choice) => update(now => ({ ...now, models: { ...now.models, [provider]: cleanChoice(choice) } })),
    setSearch: on => update(now => ({ ...now, search: Boolean(on) })),
    setStatus: status => update(now => ({ ...now, status: cleanStatus(status) })),
  };
}
