// Pure protocol helpers shared by the app and synthetic Node tests.
export const ISSUER = "https://auth.openai.com";
export const RESOURCE = "https://api.openai.com/v1";
export const PLAN_SCOPE = "chatgpt.tokens.use.direct";
export const SCOPES = `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`;
const INGREDIENT_GROUPS = ["vegetables", "fruits"];

export function authorizationURL({ hostId, redirectUri, state, nonce, challenge, clientId }) {
  const callback = new URL(redirectUri);
  if (callback.protocol !== "http:" || callback.hostname !== "127.0.0.1" ||
      callback.pathname !== "/auth/callback" || !callback.port || callback.search || callback.hash) {
    throw new Error("invalid_loopback_callback");
  }
  const url = new URL(`${ISSUER}/api/accounts/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId || "dynamic_agent_client",
    ...(!clientId ? { agent_name_hint: "calmera." } : {}),
    ext_agent_host_id: hostId, redirect_uri: redirectUri,
    response_type: "code", scope: SCOPES, resource: RESOURCE,
    state, nonce, code_challenge_method: "S256", code_challenge: challenge,
  }).toString();
  return url.toString();
}

export function callbackResult(callbackURL, { redirectUri, state, clientId }) {
  const url = new URL(callbackURL);
  const expected = new URL(redirectUri);
  if (url.origin !== expected.origin || url.pathname !== expected.pathname) throw new Error("invalid_callback_origin");
  for (const key of ["state", "code", "client_id", "error"]) {
    if (url.searchParams.getAll(key).length > 1) throw new Error("duplicate_callback_parameter");
  }
  if (!state || url.searchParams.get("state") !== state) throw new Error("invalid_oauth_state");
  if (url.searchParams.has("error")) throw new Error("authorization_cancelled");
  const issued = url.searchParams.get("client_id") || clientId;
  if (!issued || issued === "dynamic_agent_client" || !/^[\w.-]{3,256}$/.test(issued)) throw new Error("registration_incomplete");
  if (clientId && issued !== clientId) throw new Error("registration_mismatch");
  const code = url.searchParams.get("code");
  if (!code || code.length > 8192) throw new Error("authorization_code_missing");
  return { code, clientId: issued };
}

export function tokenRecord(data, { clientId, identity, prior, now = Date.now() }) {
  const scope = data.scope ?? prior?.scope;
  if (typeof scope !== "string" || !scope.split(/\s+/).includes(PLAN_SCOPE)) throw new Error("plan_permission_required");
  if (typeof data.access_token !== "string" || !data.access_token ||
      String(data.token_type).toLowerCase() !== "bearer" ||
      !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error("invalid_token_response");
  return {
    client_id: clientId, identity, scope,
    access_token: data.access_token, refresh_token: data.refresh_token || prior?.refresh_token || null,
    id_token: data.id_token || prior?.id_token || null, expires_at: now + data.expires_in * 1000,
  };
}

export function mealInput(text, image) {
  if (typeof text !== "string" || text.length > 3000) throw new Error("invalid_meal_text");
  const content = [];
  if (text.trim()) content.push({ type: "input_text", text: text.trim() });
  if (image) {
    if (typeof image !== "string" || image.length > 8 * 1024 * 1024 ||
        !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new Error("invalid_meal_image");
    content.push({ type: "input_image", image_url: image });
  }
  if (!content.length) throw new Error("meal_input_required");
  return [{ role: "user", content }];
}

// What a food contains, or null if it wasn't checked. These are an extra, so a bad list
// is dropped rather than losing the meal. The backend applies the same rules.
export function cleanIngredients(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!INGREDIENT_GROUPS.some(group => Array.isArray(value[group]))) return null;
  return Object.fromEntries(INGREDIENT_GROUPS.map(group => {
    const seen = new Set();
    const names = (Array.isArray(value[group]) ? value[group] : []).filter(name => typeof name === "string").map(name => name.trim())
      .filter(name => {
        const key = name.toLowerCase();
        if (!name || name.length > 80 || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return [group, names.slice(0, 30)];
  }));
}

export function parseMeal(text) {
  if (typeof text !== "string" || text.length > 16000) throw new Error("invalid_estimate");
  const value = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_estimate");
  if (typeof value.needsClarification === "string" && value.needsClarification.trim() && value.needsClarification.length <= 300) {
    return { needsClarification: value.needsClarification };
  }
  for (const field of ["foodName", "quantity"]) {
    if (typeof value[field] !== "string" || !value[field].trim() || value[field].length > 1000) throw new Error("invalid_estimate");
  }
  if (value.foodName.length > 255 || value.quantity.length > 255) throw new Error("invalid_estimate");
  // Words alone ("a bowl", "一碗") are a fine amount; a number, when there is one, must be positive.
  const amount = value.quantity.replace(/\s*-\s*(\d)/g, "-$1").match(/-?\d+(?:\.\d+)?/);
  if (amount && (Number(amount[0]) <= 0 || Number(amount[0]) > 100000)) throw new Error("invalid_estimate");
  if (!/[\p{L}\p{N}]/u.test(value.quantity)) throw new Error("invalid_estimate");
  for (const field of ["calories", "protein", "carbs", "fat"]) {
    if (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < 0 || value[field] > (field === "calories" ? 20000 : 9999.99)) throw new Error("invalid_estimate");
  }
  if (!["Breakfast", "Lunch", "Dinner", "Snack"].includes(value.mealType)) throw new Error("invalid_estimate");
  // Preserve the original Gemini schema. Uncertainty notes are UI copy, not new model-required fields.
  const fields = ["foodName", "quantity", "mealType", "calories", "protein", "carbs", "fat"];
  const ingredients = cleanIngredients(value.ingredients);
  return { ...Object.fromEntries(fields.map(key => [key, value[key]])), ...(ingredients ? { ingredients } : {}) };
}

// The meals list in a reply. A reply after a web search can carry a sentence before or after
// the JSON ("I looked up the menu…"); the array is read from inside it.
function mealsIn(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(trimmed); } catch (error) {
    const end = trimmed.lastIndexOf("]");
    for (let start = trimmed.indexOf("["); start >= 0 && start < end; start = trimmed.indexOf("[", start + 1)) {
      try {
        const value = JSON.parse(trimmed.slice(start, end + 1));
        if (Array.isArray(value)) return value;
      } catch { /* Not the array yet; try the next bracket. */ }
    }
    throw error;
  }
}

export function parseMeals(text) {
  if (typeof text !== "string" || text.length > 16000) throw new Error("invalid_estimate");
  const entries = mealsIn(text);
  if (!Array.isArray(entries) || entries.length > 20) throw new Error("invalid_estimate");
  // Validate the complete batch before showing any item. An empty array is the
  // existing prompt's no-food/security response, never an invented zero meal.
  return entries.map(entry => {
    const value = parseMeal(JSON.stringify(entry));
    if (value.needsClarification) throw new Error("invalid_estimate");
    return value;
  });
}

// Re-estimate answers vary in shape: a list of parts, the macros nested under a key,
// units in the number ("154 kcal") or the key ("protein_g"), or a range ("150-180").
// All of them still give the four numbers, so read them instead of failing the estimate.
const NUTRIENTS = [["calories", /^(total)?(calor|kcal|energy(?!kj))/], ["protein", /^(total)?protein/],
  ["carbs", /^(total)?carb/], ["fat", /^(total)?fat/]];
const nutrientFor = key => NUTRIENTS.find(([, pattern]) => pattern.test(key.toLowerCase().replace(/[^a-z]/g, "")))?.[0];
const isRecord = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function amountOf(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const text = value.replace(/(\d),(?=\d{3}\b)/g, "$1");
    if (/^\s*-\s*\d/.test(text)) return NaN;
    const numbers = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    if (numbers.length === 1) return numbers[0];
    if (numbers.length === 2 && /\d\s*(?:-|–|—|to)\s*\d/.test(text)) return (numbers[0] + numbers[1]) / 2;
    return NaN;
  }
  if (!isRecord(value)) return NaN;
  for (const key of ["value", "amount", "total", "estimate"]) if (key in value) return amountOf(value[key]);
  const low = amountOf(value.min ?? value.low), high = amountOf(value.max ?? value.high);
  return Number.isFinite(low) && Number.isFinite(high) ? (low + high) / 2 : NaN;
}

function nutrientsIn(value) {
  if (Array.isArray(value)) {
    const parts = value.map(nutrientsIn);
    if (!parts.length || parts.some(part => !part)) return null;
    return Object.fromEntries(NUTRIENTS.map(([key]) => [key, parts.reduce((sum, part) => sum + part[key], 0)]));
  }
  // Nearest keys win; a "total" group is read before a "per 100 g" one.
  const found = {};
  let level = [value];
  for (let depth = 0; depth < 4 && level.length; depth += 1) {
    const next = [];
    for (const node of level.filter(isRecord)) {
      for (const [key, child] of Object.entries(node)) {
        const nutrient = nutrientFor(key);
        const amount = nutrient && !(nutrient in found) ? amountOf(child) : NaN;
        if (Number.isFinite(amount)) found[nutrient] = amount;
        else if (isRecord(child)) next[/total|sum|overall/i.test(key) ? "unshift" : "push"](child);
      }
    }
    level = next;
  }
  return NUTRIENTS.every(([key]) => key in found) ? found : null;
}

function jsonIn(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(trimmed); } catch (error) {
    const start = trimmed.search(/[[{]/);
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (start < 0 || end <= start) throw error;
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

export function parseNutrition(text) {
  if (typeof text !== "string" || text.length > 16000) throw new Error("invalid_estimate");
  const found = nutrientsIn(jsonIn(text));
  if (!found) throw new Error("invalid_estimate");
  const rounded = Object.fromEntries(Object.entries(found).map(([key, amount]) => [key, Math.round(amount * 10) / 10]));
  const result = parseMeal(JSON.stringify({ ...rounded, foodName: "Nutrition estimate", quantity: "1 serving", mealType: "Snack" }));
  return Object.fromEntries(NUTRIENTS.map(([key]) => [key, result[key]]));
}

// The reply's answer among a Responses API output. With web search the model can write a
// sentence before searching; the answer is the message marked final_answer, else what came
// after the last search, else every message.
export function finalMessages(output) {
  const items = Array.isArray(output) ? output : [];
  // An item with content and no type is a message too, as older replies wrote it.
  const isMessage = item => item?.type === "message" || (item && item.type === undefined && Array.isArray(item.content));
  const messages = items.filter(isMessage);
  const marked = messages.filter(item => item.phase === "final_answer");
  if (marked.length) return marked;
  let lastSearch = -1;
  items.forEach((item, index) => { if (item?.type === "web_search_call") lastSearch = index; });
  const after = lastSearch >= 0 ? items.slice(lastSearch + 1).filter(isMessage) : [];
  return after.length ? after : messages;
}
export const outputText = output => finalMessages(output).flatMap(item => (Array.isArray(item.content) ? item.content : []))
  .filter(part => part?.type === "output_text" && typeof part.text === "string").map(part => part.text).join("");

// How many web searches a Responses API reply ran: the billed count when reported, else the calls.
export function responseSearches(response) {
  const billed = Number(response?.tool_usage?.web_search?.num_requests);
  if (Number.isFinite(billed) && billed >= 0) return billed;
  return (Array.isArray(response?.output) ? response.output : []).filter(item => item?.type === "web_search_call").length;
}

// Completion is mandatory: never turn partial output or an HTTP 200 into a saved meal.
export async function completedResponse(response, { onProgress } = {}) {
  const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!response.body?.getReader || (mime && mime !== "text/event-stream")) throw new Error("invalid_inference_stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", output = "", completed = false, size = 0, serviceTier = null, usage = null;
  let progressRank = 0;
  const report = (stage, rank) => {
    if (rank <= progressRank) return;
    progressRank = rank;
    // Progress is optional UI metadata; never expose response text or IDs.
    try { onProgress?.(stage); } catch { /* Rendering cannot invalidate inference. */ }
  };
  function frame(block) {
    const lines = block.split("\n");
    const raw = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (!raw || raw === "[DONE]") return;
    const event = JSON.parse(raw);
    if (["error", "response.failed", "response.incomplete"].includes(event.type)) {
      const code = event.code || event.error?.code || event.response?.error?.code;
      throw new Error(["subscription_sharing_usage_limit_exceeded", "subscription_sharing_usage_unavailable"].includes(code) ? "plan_usage_unavailable" : "inference_failed");
    }
    if (event.type === "response.created") report("received", 1);
    if (event.type === "response.in_progress") report("analyzing", 2);
    if (event.type === "response.output_text.delta") {
      if (completed || typeof event.delta !== "string") throw new Error("invalid_inference_completion");
      output += event.delta;
      report("receiving", 3);
    }
    if (event.type === "response.completed") {
      if (completed || event.response?.status !== "completed") throw new Error("invalid_inference_completion");
      const texts = outputText(event.response.output);
      output = texts || output;
      // Token counts when the reply reports them; never any text.
      const reported = event.response.usage;
      if (reported && typeof reported === "object") usage = { input: Number(reported.input_tokens) || 0, output: Number(reported.output_tokens) || 0,
        cached: Number(reported.input_tokens_details?.cached_tokens) || 0, searches: responseSearches(event.response) };
      else if (responseSearches(event.response)) usage = { input: null, output: null, cached: null, searches: responseSearches(event.response) };
      const tier = event.response.service_tier;
      serviceTier = ["auto", "default", "flex", "scale", "priority", "fast", "ultrafast"].includes(tier) ? tier : null;
      completed = true;
      report("completed", 4);
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) throw new Error("inference_too_large");
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        frame(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) frame(buffer);
    if (!completed || !output.trim()) throw new Error("inference_not_completed");
    return { text: output, serviceTier, usage };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function completedText(response, options) {
  return (await completedResponse(response, options)).text;
}

export function foodEntryPayload(meal, createdAt) {
  const validated = parseMeal(JSON.stringify(meal));
  if (validated.needsClarification || !Number.isFinite(Date.parse(createdAt))) throw new Error("invalid_food_entry");
  // Only the existing database contract crosses the app backend boundary.
  return { ...Object.fromEntries(["foodName", "quantity", "mealType", "calories", "protein", "carbs", "fat"].map(key => [key, validated[key]]).concat([["createdAt", createdAt]])),
    ...(validated.ingredients ? { ingredients: validated.ingredients } : {}) };
}

export function friendlyError(error) {
  const code = error?.message || "";
  if (/cancel/i.test(code)) return "Connection cancelled. You can try again.";
  if (/native|development_build/.test(code)) return "ChatGPT connection needs the iOS development build. Expo Go is not supported.";
  if (/plan_permission/.test(code)) return "Allow ChatGPT plan usage when connecting your account.";
  if (/usage|429/.test(code)) return "Your ChatGPT usage is unavailable right now. Try again later.";
  if (/401|sign_in|refresh/.test(code)) return "Please reconnect your ChatGPT account.";
  if (/image/.test(code)) return "Choose a smaller meal photo and try again.";
  if (/voice|speech/.test(code)) return "Couldn’t transcribe the recording. Check your voice language and permissions, or use Text Log.";
  if (/no_food/.test(code)) return "No food was identified. Please try again with a clearer description or photo.";
  if (/save_uncertain/.test(code)) return "The save could not be confirmed. Check your meals before trying again to avoid a duplicate.";
  return "That did not finish. Please try again; no meal was automatically saved.";
}
