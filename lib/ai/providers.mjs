import { mealInput, outputText, responseSearches } from "../chatgpt/protocol.mjs";
import { ANTHROPIC_VERSION, providerFor } from "./models.mjs";

// A person's own API key, sent straight from the phone to its provider's official API.
// Requests and parsing are pure so Node tests can check them with a fake fetch. Errors carry
// only a short code and the HTTP status: never the key, a request body or the provider's text.
const ENDPOINTS = Object.freeze({
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/responses",
});
const MODEL_LISTS = Object.freeze({
  anthropic: "https://api.anthropic.com/v1/models?limit=1000",
  openai: "https://api.openai.com/v1/models",
});
const MODEL_ID = /^[\w.:-]{1,200}$/;
// The model a request names: the person's choice, or the provider's default.
export const requestModel = (providerId, model) => (typeof model === "string" && MODEL_ID.test(model) ? model : requireProvider(providerId).model);
const REQUEST_TIMEOUT_MS = 120000;
const TEST_TIMEOUT_MS = 20000;
// Room for up to 20 foods and the model's own thinking.
const MAX_OUTPUT_TOKENS = 8192;
// A meal estimate needs little reasoning; low effort keeps it quick and cheap.
const EFFORT = "low";
// Online search. Anthropic's basic web search runs on every model that has web search (the
// newer dynamic-filtering version runs code first, which a meal lookup doesn't need); a few
// searches are plenty for a menu. OpenAI's tool takes no settings here.
const WEB_SEARCH = Object.freeze({
  anthropic: Object.freeze({ type: "web_search_20250305", name: "web_search", max_uses: 3 }),
  openai: Object.freeze({ type: "web_search" }),
});
// How many times a paused search turn is sent back before giving up.
const MAX_RESUMES = 3;

const text = value => (typeof value === "string" ? value : "");

function requireProvider(id) {
  const provider = providerFor(id);
  if (!provider) throw new Error("apikey_provider_unknown");
  return provider;
}

// Whose key this is, from how it starts: Claude keys begin sk-ant-, every OpenAI key sk-.
// Null when it is neither, so the key page never has to ask which provider a key is for.
export function keyProvider(value) {
  const key = text(value).trim();
  return key.startsWith("sk-ant-") ? "anthropic" : key.startsWith("sk-") ? "openai" : null;
}

// Shape only; whether the key works is the provider's call, through testApiKey.
export function checkKeyShape(providerId, value) {
  requireProvider(providerId);
  const key = text(value).trim();
  if (!key) throw new Error("apikey_missing");
  if (key.length < 20 || key.length > 512 || !/^[\x21-\x7e]+$/.test(key)) throw new Error("apikey_malformed");
  const claudeKey = key.startsWith("sk-ant-");
  if ((providerId === "openai" && claudeKey) || (providerId === "anthropic" && !claudeKey && key.startsWith("sk-"))) {
    throw new Error("apikey_wrong_provider");
  }
  return key;
}

// What Settings shows once a key is saved: its familiar start and last four characters.
export function maskKey(value) {
  const key = text(value).trim();
  const prefix = ["sk-ant-", "sk-proj-", "sk-"].find(start => key.startsWith(start)) || "";
  return `${prefix}••••${key.slice(-4)}`;
}

// The existing ChatGPT input (text and an optional photo data URL), in Claude's block shape.
function anthropicContent(input) {
  const items = input[0].content;
  const images = items.filter(item => item.type === "input_image").map(item => {
    const [, mediaType, data] = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(item.image_url);
    return { type: "image", source: { type: "base64", media_type: mediaType, data } };
  });
  // Claude reads an image best when it comes before the words about it.
  return [...images, ...items.filter(item => item.type === "input_text").map(item => ({ type: "text", text: item.text }))];
}

// effort: ask for little reasoning, which keeps estimates quick and cheap. search: let the model
// look things up online. A model that doesn't take a setting is asked again without it
// (createApiKeyCompletion). paused: Anthropic replies that paused mid-search, sent back unchanged.
export function mealRequest(providerId, { key, model, instructions, text: words = "", image, maxTokens = MAX_OUTPUT_TOKENS,
  effort = true, search = false, paused = [] }) {
  requireProvider(providerId);
  const id = requestModel(providerId, model);
  if (typeof instructions !== "string" || !instructions.trim()) throw new Error("invalid_instructions");
  const input = mealInput(words ?? "", image);
  if (providerId === "openai") return {
    url: ENDPOINTS.openai,
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ model: id, instructions, input, store: false,
        ...(effort ? { reasoning: { effort: EFFORT } } : {}), ...(search ? { tools: [WEB_SEARCH.openai] } : {}), max_output_tokens: maxTokens }),
    },
  };
  return {
    url: ENDPOINTS.anthropic,
    init: {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ model: id, max_tokens: maxTokens, system: instructions,
        ...(effort ? { output_config: { effort: EFFORT } } : {}), ...(search ? { tools: [WEB_SEARCH.anthropic] } : {}),
        messages: [{ role: "user", content: anthropicContent(input) }, ...paused.map(content => ({ role: "assistant", content }))] }),
    },
  };
}

// The answer's text, only from a finished reply. A cut-off or refused answer is never a meal.
export function responseText(providerId, body) {
  requireProvider(providerId);
  let output;
  if (providerId === "openai") {
    if (body?.status !== "completed") throw new Error(body?.status === "incomplete" ? "inference_not_completed" : "inference_failed");
    // With web search, a sentence can come before the answer; only the answer is read.
    output = outputText(body.output);
  } else {
    if (body?.stop_reason === "refusal") throw new Error("inference_failed");
    if (body?.stop_reason === "max_tokens" || body?.stop_reason === "pause_turn") throw new Error("inference_not_completed");
    // With web search: "I'll look that up", the search, its results, then the answer, split
    // into text blocks around its citations. The answer is the text after the last search.
    const content = Array.isArray(body?.content) ? body.content : [];
    let lastSearch = -1;
    content.forEach((block, index) => { if (block?.type === "server_tool_use" || block?.type === "web_search_tool_result") lastSearch = index; });
    const blocks = content.slice(lastSearch + 1).filter(block => block?.type === "text");
    output = (blocks.length ? blocks : content.filter(block => block?.type === "text")).map(block => text(block.text)).join("");
  }
  if (!output.trim()) throw new Error("inference_not_completed");
  return output;
}

// Both providers' error bodies, reduced to one plain code the app can explain.
export function apiKeyErrorCode({ status, type = "", code = "", message = "" } = {}) {
  if (status === 401 || type === "authentication_error" || code === "invalid_api_key") return "apikey_rejected";
  if (status === 402 || type === "billing_error" || ["insufficient_quota", "enforced_spend_limit_reached", "billing_hard_limit_reached"].includes(code)
    || (status === 400 && /credit balance|billing/i.test(message))) return "apikey_no_credit";
  if (status === 403 || type === "permission_error") return "apikey_not_allowed";
  if (status === 404 || type === "not_found_error" || code === "model_not_found") return "apikey_model_unavailable";
  if (status === 413 || type === "request_too_large") return "meal_image_too_large";
  // A model that can't read photos refuses the image in a plain 400.
  if (status === 400 && /\bimage/i.test(message)) return "apikey_image_unsupported";
  if (status === 429 || type === "rate_limit_error") return "apikey_rate_limited";
  if (status === 529 || status >= 500 || type === "overloaded_error" || type === "api_error") return "apikey_provider_busy";
  return "apikey_request_failed";
}

export async function providerError(response) {
  let details = {};
  try {
    const error = (await response.json())?.error;
    if (error && typeof error === "object") details = {
      type: text(error.type), code: text(error.code) || text(error.details?.error_code), message: text(error.message).slice(0, 300),
    };
  } catch { /* An empty or non-JSON body still has its status. */ }
  const error = new Error(apiKeyErrorCode({ status: response.status, ...details }));
  error.status = response.status;
  return error;
}

const report = (onProgress, stage) => { try { onProgress?.(stage); } catch { /* Progress is optional UI. */ } };

async function send(fetch, { url, init }, { signal, timeoutMs, onProgress }) {
  if (signal?.aborted) throw new Error("request_cancelled");
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const failure = fallback => new Error(signal?.aborted ? "request_cancelled" : timedOut ? "apikey_timeout" : fallback);
  try {
    report(onProgress, "sending");
    let response;
    try {
      const pending = fetch(url, { ...init, redirect: "error", signal: controller.signal });
      report(onProgress, "analyzing");
      response = await pending;
    } catch {
      // A fetch failure can mention the URL; drop it and say only what kind of failure it was.
      throw failure("apikey_network");
    }
    if (!response.ok) throw await providerError(response);
    try { return await response.json(); } catch { throw failure("inference_failed"); }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

// What one reply used, for the usage page: token counts and web searches, never any text.
// input counts every input token, cached ones included, for both providers.
export function usageOf(providerId, body, requested) {
  const usage = body?.usage;
  const model = typeof body?.model === "string" && MODEL_ID.test(body.model) ? body.model : requested;
  if (!usage || typeof usage !== "object") return { provider: providerId, model, input: null, output: null, searches: 0 };
  if (providerId === "openai") return { provider: providerId, model, input: usage.input_tokens, output: usage.output_tokens,
    cached: usage.input_tokens_details?.cached_tokens || 0, searches: responseSearches(body) };
  const cached = usage.cache_read_input_tokens || 0, cacheWrite = usage.cache_creation_input_tokens || 0;
  return { provider: providerId, model, input: (usage.input_tokens || 0) + cached + cacheWrite, output: usage.output_tokens,
    cached, cacheWrite, searches: usage.server_tool_use?.web_search_requests || 0 };
}
const tell = (onUsage, entry) => { try { onUsage?.(entry); } catch { /* A record never fails a request. */ } };

// One function per saved key: instructions and the meal in, the model's text out. model is the
// person's choice (or the default); effort is false for a model known not to take it;
// search lets the model look things up online. onUsage hears about every reply that's billed.
export function createApiKeyCompletion({ fetch, provider, key, model, effort = true, search = false, timeoutMs = REQUEST_TIMEOUT_MS, onUsage }) {
  requireProvider(provider);
  const id = requestModel(provider, model);
  return async function complete({ instructions, text: words, image, signal, onProgress }) {
    const ask = async options => {
      const body = await send(fetch, mealRequest(provider, { key, model: id, instructions, text: words, image, ...options }), { signal, timeoutMs, onProgress });
      tell(onUsage, usageOf(provider, body, id));
      return body;
    };
    const run = async options => {
      let body = await ask(options);
      // Anthropic can pause a long search turn; sent back unchanged, it carries on.
      const paused = [];
      while (provider === "anthropic" && body?.stop_reason === "pause_turn" && paused.length < MAX_RESUMES) {
        paused.push(body.content);
        body = await ask({ ...options, paused: [...paused] });
      }
      return body;
    };
    try {
      let body;
      try { body = await run({ effort, search }); } catch (error) {
        // Every model can't take every setting, and the providers don't always say which ahead
        // of time; web search can also be turned off for an organization. A plain 400 is asked
        // once more with only what every model takes, so an estimate never depends on a lookup.
        if (!(error?.message === "apikey_request_failed" && error.status === 400 && (effort || search))) throw error;
        body = await run({ effort: false, search: false });
      }
      const output = responseText(provider, body);
      report(onProgress, "completed");
      return output;
    } catch (error) {
      // Lets the error message name the provider and model; still no key or request text.
      if (error instanceof Error) { error.provider = provider; error.model = id; }
      throw error;
    }
  };
}

// The models a key can use, as the provider lists them (modelCatalog.mjs reads them).
export function modelsRequest(providerId, key) {
  requireProvider(providerId);
  const headers = providerId === "openai" ? { Authorization: `Bearer ${key}`, Accept: "application/json" }
    : { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION, Accept: "application/json" };
  return { url: MODEL_LISTS[providerId], init: { method: "GET", headers } };
}
export async function listModels({ fetch, provider, key, signal, timeoutMs = TEST_TIMEOUT_MS }) {
  const body = await send(fetch, modelsRequest(provider, checkKeyShape(provider, key)), { signal, timeoutMs });
  return Array.isArray(body?.data) ? body.data : [];
}

// What a key test found, in a word the Settings page turns into a sentence.
export function testOutcome(error) {
  const code = text(error?.message);
  const outcomes = {
    apikey_rejected: "rejected", apikey_no_credit: "no-credit", apikey_network: "offline", apikey_timeout: "offline",
    apikey_rate_limited: "rate-limited", apikey_not_allowed: "not-allowed", apikey_model_unavailable: "not-allowed",
    apikey_provider_busy: "busy", apikey_request_failed: "failed", apikey_image_unsupported: "no-images", apikey_wrong_provider: "wrong-provider", apikey_malformed: "malformed", apikey_missing: "malformed",
  };
  return outcomes[code] || "failed";
}

// One tiny real request, so a rejected key or an empty balance shows up before a meal does.
// It is billed like any other, so it is recorded too.
export async function testApiKey({ fetch, provider, key, signal, timeoutMs = TEST_TIMEOUT_MS, onUsage }) {
  try {
    const clean = checkKeyShape(provider, key);
    const body = await send(fetch, mealRequest(provider, { key: clean, instructions: "Reply with exactly OK.", text: "OK?", maxTokens: 32 }),
      { signal, timeoutMs });
    tell(onUsage, usageOf(provider, body, requestModel(provider)));
    return "works";
  } catch (error) {
    if (error?.message === "request_cancelled") throw error;
    return testOutcome(error);
  }
}
