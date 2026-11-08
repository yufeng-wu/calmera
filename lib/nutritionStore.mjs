const fields = ["calories", "protein", "carbs", "fat"];
const totals = () => Object.fromEntries(fields.map((key) => [key, 0]));
export const localDateKey = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
export function normalizeDay(raw = {}) {
  const entries = (raw.foodEntries || []).map((entry) => ({
    ...entry, foodName: entry.foodName ?? entry.food_name,
    mealType: entry.mealType ?? entry.meal_type, localTime: entry.localTime ?? entry.local_time,
  })).sort((a, b) => String(a.localTime || "").localeCompare(String(b.localTime || "")) || Number(a.id) - Number(b.id));
  return { entries, summary: { ...raw, foodEntries: entries } };
}
function dayWithEntries(day, entries) {
  const dailyTotals = totals();
  const mealTotals = {};
  for (const entry of entries) {
    const meal = entry.mealType ?? entry.meal_type ?? "Snack";
    mealTotals[meal] ||= totals();
    for (const key of fields) {
      const value = Number(entry[key]) || 0;
      dailyTotals[key] += value; mealTotals[meal][key] += value;
    }
  }
  for (const group of [dailyTotals, ...Object.values(mealTotals)]) {
    for (const key of fields) group[key] = Math.round(group[key] * 100) / 100;
  }
  return normalizeDay({ ...day?.summary, foodEntries: entries, dailyTotals, mealTotals });
}
export const EMPTY_DAY = normalizeDay({ dailyTotals: totals(), mealTotals: {}, foodEntries: [] });

// The store reads through the data module (lib/store). `isActive` says whether a read
// still belongs to the store on screen.
export const dataLoader = (data, isActive) => ({ resource, date, signal }) =>
  resource === "profile" ? data.readProfile({ signal, isActive })
    : resource === "history" ? data.readDays({ signal, isActive })
      : data.readDay(date, { signal, isActive });

// One provider owns one store, and the store itself writes nothing to disk.
// Today can change at any time, but goals and history rarely do, and edits made here invalidate them at once.
export function createNutritionStore({ ownerKey = null, onDispose, now = Date.now, dayTTL = 300000, historyTTL = 1800000, profileTTL = 1800000 } = {}) {
  let snapshot = { profile: null, days: {}, historyLoaded: false, pending: {}, errors: {} };
  let leases = 0;
  let disposed = false, entryVersion = 0, profileVersion = 0, sequence = 0;
  let lastDayKey = null;
  const listeners = new Set(), requests = new Map(), metadata = new Map(), removals = new Map(), failures = new Map();
  const stats = { dayRequests: 0, historyRequests: 0, profileRequests: 0, cacheHits: 0, deduplicated: 0 };
  const version = (key) => key === "profile" ? profileVersion : entryVersion;
  const publish = (patch) => {
    if (disposed) return;
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };
  const fresh = (key, ttl) => {
    const meta = metadata.get(key);
    return meta && meta.version === version(key) && now() - meta.at < ttl;
  };
  const pendingDay = (date) => [...removals.values()].some((item) => item.date === date);
  const commitDay = (date, day, seq) => {
    metadata.set(`day:${date}`, { version: entryVersion, at: now(), sequence: seq });
    publish({ days: { ...snapshot.days, [date]: day } });
  };
  const run = (key, loader, { force = false, ttl, apply }) => {
    if (disposed) return Promise.reject(new Error("nutrition_store_disposed"));
    const existing = requests.get(key);
    if (existing && existing.version === version(key)) { stats.deduplicated++; return existing.promise; }
    if (!force && (fresh(key, ttl) || (failures.has(key) && now() - failures.get(key) < 15000))) {
      stats.cacheHits++; return Promise.resolve();
    }
    const request = { version: version(key), sequence: ++sequence, controller: new AbortController() };
    requests.set(key, request);
    if (key === "profile") stats.profileRequests++;
    else if (key === "history") stats.historyRequests++;
    else stats.dayRequests++;
    // The last failure stays visible until a read succeeds, so a retry never
    // turns an error screen back into a cold loading screen.
    publish({ pending: { ...snapshot.pending, [key]: true } });
    request.promise = Promise.resolve().then(() => loader({
      resource: key === "profile" ? "profile" : key === "history" ? "history" : "day",
      date: key.startsWith("day:") ? key.slice(4) : undefined,
      signal: request.controller.signal,
    })).then((data) => {
      if (disposed || request.version !== version(key)) return;
      apply(data, request.sequence);
      if (snapshot.errors[key]) publish({ errors: { ...snapshot.errors, [key]: null } });
      failures.delete(key);
      metadata.set(key, { version: request.version, at: now(), sequence: request.sequence });
    }).catch((error) => {
      if (!disposed && request.version === version(key) && error.name !== "AbortError") {
        failures.set(key, now());
        publish({ errors: { ...snapshot.errors, [key]: "Meals could not refresh. Please try again." } });
      }
      throw error;
    }).finally(() => {
      if (requests.get(key) === request) {
        requests.delete(key);
        publish({ pending: { ...snapshot.pending, [key]: false } });
      }
    });
    return request.promise;
  };
  const abortGroup = (profile) => {
    for (const [key, request] of requests) {
      if ((key === "profile") === profile) {
        requests.delete(key); request.controller.abort();
      }
    }
  };
  const store = {
    getSnapshot: () => snapshot,
    belongsTo: (key) => !disposed && key === ownerKey,
    isActive: () => !disposed,
    retain() { leases++; },
    release() { leases--; Promise.resolve().then(() => { if (leases <= 0) store.dispose(); }); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getDiagnostics: () => ({ ...stats, pendingRequests: requests.size,
      profileReady: snapshot.profile ? 1 : 0, historyReady: snapshot.historyLoaded ? 1 : 0,
      errorCount: Object.values(snapshot.errors).filter(Boolean).length,
      lastDayAgeMs: metadata.has(lastDayKey) ? Math.round(now() - metadata.get(lastDayKey).at) : -1,
      lastDayCacheFresh: lastDayKey && fresh(lastDayKey, dayTTL) ? 1 : 0 }),
    loadProfile(loader, options = {}) {
      return run("profile", loader, { ...options, ttl: profileTTL, apply: (profile) => publish({ profile }) });
    },
    loadDay(date, loader, options = {}) {
      lastDayKey = `day:${date}`;
      if (pendingDay(date)) return Promise.resolve();
      if (!options.force && snapshot.historyLoaded && fresh("history", historyTTL) && !snapshot.days[date]) {
        stats.cacheHits++;
        commitDay(date, EMPTY_DAY, ++sequence);
        return Promise.resolve();
      }
      const all = requests.get("history");
      if (!options.force && all?.version === entryVersion) return all.promise;
      // A past day only changes through an edit, which invalidates it, so age alone never re-reads one.
      const ttl = date < localDateKey(new Date(now())) ? Infinity : dayTTL;
      return run(`day:${date}`, loader, { ...options, ttl, apply: (raw, seq) => {
        if (!pendingDay(date)) commitDay(date, normalizeDay(raw), seq);
      } });
    },
    loadHistory(loader, options = {}) {
      return run("history", loader, { ...options, ttl: historyTTL, apply: (raw, seq) => {
        const days = { ...snapshot.days };
        for (const date of new Set([...Object.keys(days), ...Object.keys(raw)])) {
          const meta = metadata.get(`day:${date}`);
          if (pendingDay(date) || (meta?.version === entryVersion && meta.sequence > seq)) continue;
          days[date] = raw[date] ? normalizeDay(raw[date]) : EMPTY_DAY;
          metadata.set(`day:${date}`, { version: entryVersion, at: now(), sequence: seq });
        }
        publish({ days, historyLoaded: true });
      } });
    },
    invalidateEntries() {
      entryVersion++; abortGroup(false);
      for (const key of failures.keys()) if (key !== "profile") failures.delete(key);
      publish({ pending: Object.fromEntries(Object.entries(snapshot.pending).map(([key, value]) => [key, key === "profile" ? value : false])) });
    },
    invalidateProfile() {
      profileVersion++; abortGroup(true); failures.delete("profile");
      publish({ pending: { ...snapshot.pending, profile: false } });
      store.invalidateEntries();
    },
    addConfirmed(date, entries) {
      if (disposed || !entries?.length) return;
      store.invalidateEntries();
      const day = snapshot.days[date] || EMPTY_DAY;
      const merged = new Map(day.entries.map((entry) => [String(entry.id), entry]));
      for (const entry of normalizeDay({ foodEntries: entries }).entries) merged.set(String(entry.id), entry);
      commitDay(date, dayWithEntries(day, [...merged.values()]), ++sequence);
    },
    removeOptimistically(date, id) {
      const day = snapshot.days[date];
      const entry = day?.entries.find((item) => String(item.id) === String(id));
      if (!entry) return null;
      store.invalidateEntries();
      const token = Symbol("removal");
      removals.set(token, { date, entry });
      commitDay(date, dayWithEntries(day, day.entries.filter((item) => String(item.id) !== String(id))), ++sequence);
      return token;
    },
    finishRemoval(token, succeeded) {
      const pending = removals.get(token);
      if (!pending || disposed) return;
      removals.delete(token);
      if (!succeeded) {
        const day = snapshot.days[pending.date] || EMPTY_DAY;
        const entries = day.entries.some((item) => String(item.id) === String(pending.entry.id)) ? day.entries : [...day.entries, pending.entry];
        commitDay(pending.date, dayWithEntries(day, entries), ++sequence);
      }
      store.invalidateEntries();
    },
    dispose() {
      disposed = true;
      for (const request of requests.values()) request.controller.abort();
      requests.clear(); metadata.clear(); removals.clear(); failures.clear(); listeners.clear();
      snapshot = { profile: null, days: {}, historyLoaded: false, pending: {}, errors: {} };
      onDispose?.();
    },
  };
  return store;
}
