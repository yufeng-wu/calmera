import { localDateKey } from "../nutritionStore.mjs";
import { modelName } from "./modelCatalog.mjs";
import { requestCost } from "./prices.mjs";

// A record of each AI request calmera makes, kept in app storage on this iPhone only, for the
// usage page: when, which provider and model, how many tokens and web searches. Never what
// was logged: no prompts, meals, photos or replies. Only the last 7 days are kept; "Erase all
// data" removes it with every other calmera key.
export const USAGE_DAYS = 7;
export const usageKey = owner => `calmera.usage.v1.${owner}`;
const MAX_ROWS = 2000;
const PROVIDERS = new Set(["anthropic", "openai", "chatgpt"]);
const COMPANIES = Object.freeze({ anthropic: "Anthropic", openai: "OpenAI", chatgpt: "ChatGPT" });
const count = value => (Number.isFinite(value) && value >= 0 ? Math.round(value) : null);

// The 7 days the page shows, oldest first, ending today, in this iPhone's time zone.
export function usageDays(today = new Date()) {
  return Array.from({ length: USAGE_DAYS }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (USAGE_DAYS - 1 - index));
    return { key: localDateKey(date), weekday: date.getDay() };
  });
}

// Only numbers and a model id are kept.
export function usageRow(entry, now = new Date()) {
  if (!entry || !PROVIDERS.has(entry.provider) || typeof entry.model !== "string" || !/^[\w.:-]{1,200}$/.test(entry.model)) return null;
  return { at: now.getTime(), day: localDateKey(now), provider: entry.provider, model: entry.model,
    input: count(entry.input), output: count(entry.output), cached: count(entry.cached) ?? 0, cacheWrite: count(entry.cacheWrite) ?? 0,
    searches: count(entry.searches) ?? 0 };
}

// storage: { getItem, setItem } (AsyncStorage). Read fresh each time, written one at a time.
export function createUsageLog({ storage, owner, now = () => new Date() }) {
  if (!/^[\w-]{1,150}$/.test(owner || "")) throw new Error("calmera_sign_in_required");
  const key = usageKey(owner);
  let writes = Promise.resolve();
  const recent = list => {
    const first = usageDays(now())[0].key;
    return list.filter(row => row && typeof row.day === "string" && row.day >= first).slice(-MAX_ROWS);
  };
  async function read() {
    try {
      const value = JSON.parse(await storage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }
  return {
    async rows() { return recent(await read()); },
    // Never fails the request it describes.
    record(entry) {
      const row = usageRow(entry, now());
      if (!row) return writes;
      writes = writes.then(async () => { await storage.setItem(key, JSON.stringify(recent([...await read(), row]))); }).catch(() => {});
      return writes;
    },
  };
}

// The page's numbers: each of the 7 days, each company and, within it, each model.
// cost is an estimate from list prices, null where none is known (and always for ChatGPT).
export function summarizeUsage(rows, today = new Date()) {
  const days = usageDays(today).map(day => ({ ...day, requests: 0, cost: 0 }));
  const byDay = new Map(days.map(day => [day.key, day]));
  const companies = new Map();
  const total = { requests: 0, tokens: 0, searches: 0, cost: 0, priced: 0, unpriced: 0, plan: 0 };
  for (const row of Array.isArray(rows) ? rows : []) {
    const day = byDay.get(row?.day);
    if (!day || !PROVIDERS.has(row.provider)) continue;
    const cost = row.provider === "chatgpt" ? null : requestCost(row);
    const tokens = (row.input || 0) + (row.output || 0);
    day.requests += 1; day.cost += cost || 0;
    total.requests += 1; total.tokens += tokens; total.searches += row.searches || 0; total.cost += cost || 0;
    if (row.provider === "chatgpt") total.plan += 1; else if (cost === null) total.unpriced += 1; else total.priced += 1;
    if (!companies.has(row.provider)) companies.set(row.provider, { id: row.provider, name: COMPANIES[row.provider], requests: 0, tokens: 0,
      searches: 0, cost: row.provider === "chatgpt" ? null : 0, unpriced: 0, models: new Map() });
    const company = companies.get(row.provider);
    company.requests += 1; company.tokens += tokens; company.searches += row.searches || 0;
    if (cost === null && row.provider !== "chatgpt") company.unpriced += 1;
    if (company.cost !== null) company.cost += cost || 0;
    if (!company.models.has(row.model)) company.models.set(row.model, { id: row.model, name: modelName(row.provider === "chatgpt" ? "openai" : row.provider, row.model),
      requests: 0, input: 0, output: 0, searches: 0, cost: row.provider === "chatgpt" ? null : 0, priced: row.provider !== "chatgpt" });
    const model = company.models.get(row.model);
    model.requests += 1; model.input += row.input || 0; model.output += row.output || 0; model.searches += row.searches || 0;
    if (cost === null) model.priced = false; else if (model.cost !== null) model.cost += cost;
  }
  const order = (a, b) => (b.cost ?? -1) - (a.cost ?? -1) || b.requests - a.requests;
  return {
    days, total,
    companies: [...companies.values()].map(company => ({ ...company,
      models: [...company.models.values()].map(model => ({ ...model, cost: model.priced ? model.cost : null })).sort(order) })).sort(order),
  };
}

// "$0.42", "<$0.01" or "$0": an estimate, so cents are as fine as it gets.
export function formatCost(dollars) {
  if (!Number.isFinite(dollars) || dollars <= 0) return "$0";
  if (dollars < 0.01) return "<$0.01";
  return `$${dollars < 100 ? dollars.toFixed(2) : Math.round(dollars).toLocaleString("en-US")}`;
}
// "980", "81k", "1.2M".
export function formatTokens(tokens) {
  if (!Number.isFinite(tokens) || tokens < 1000) return String(Math.max(0, Math.round(tokens || 0)));
  if (tokens < 1e6) return `${tokens < 10000 ? (tokens / 1000).toFixed(1).replace(/\.0$/, "") : Math.round(tokens / 1000)}k`;
  return `${(tokens / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
}
export const plural = (amount, word, many = `${word}s`) => `${amount.toLocaleString("en-US")} ${amount === 1 ? word : many}`;

// The row on the AI connection page: the week at a glance, every connection together. No
// prices on that page; the cost is on the usage page itself.
export const usageValue = summary => (summary?.total?.requests ? plural(summary.total.requests, "request") : "None yet");
