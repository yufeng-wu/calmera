// Pure protocol helpers shared by the app and synthetic Node tests.
export const ISSUER = "https://auth.openai.com";
export const RESOURCE = "https://api.openai.com/v1";
export const PLAN_SCOPE = "chatgpt.tokens.use.direct";
export const SCOPES = `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`;

export function authorizationURL({ hostId, redirectUri, state, nonce, challenge, clientId }) {
  const callback = new URL(redirectUri);
  if (callback.protocol !== "http:" || callback.hostname !== "127.0.0.1" ||
      callback.pathname !== "/auth/callback" || !callback.port || callback.search || callback.hash) {
    throw new Error("invalid_loopback_callback");
  }
  const url = new URL(`${ISSUER}/api/accounts/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId || "dynamic_agent_client",
    ...(!clientId ? { agent_name_hint: "foodwrap." } : {}),
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
  const amount = value.quantity.match(/-?\d+(?:\.\d+)?/);
  if (!amount || Number(amount[0]) <= 0 || Number(amount[0]) > 100000) throw new Error("invalid_estimate");
  if (isNaN(value.quantity) && !/\p{L}/u.test(value.quantity)) throw new Error("invalid_estimate");
  for (const field of ["calories", "protein", "carbs", "fat"]) {
    if (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < 0 || value[field] > (field === "calories" ? 20000 : 9999.99)) throw new Error("invalid_estimate");
  }
  if (!["Breakfast", "Lunch", "Dinner", "Snack"].includes(value.mealType)) throw new Error("invalid_estimate");
  // Preserve the original Gemini schema. Uncertainty notes are UI copy, not new model-required fields.
  const fields = ["foodName", "quantity", "mealType", "calories", "protein", "carbs", "fat"];
  return Object.fromEntries(fields.map(key => [key, value[key]]));
}

export function parseMeals(text) {
  if (typeof text !== "string" || text.length > 16000) throw new Error("invalid_estimate");
  const entries = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  if (!Array.isArray(entries) || entries.length > 20) throw new Error("invalid_estimate");
  // Validate the complete batch before showing any item. An empty array is the
  // existing prompt's no-food/security response, never an invented zero meal.
  return entries.map(entry => {
    const value = parseMeal(JSON.stringify(entry));
    if (value.needsClarification) throw new Error("invalid_estimate");
    return value;
  });
}

export function parseNutrition(text) {
  if (typeof text !== "string" || text.length > 16000) throw new Error("invalid_estimate");
  const value = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  const result = parseMeal(JSON.stringify({ ...value, foodName: "Nutrition estimate", quantity: "1 serving", mealType: "Snack" }));
  return Object.fromEntries(["calories", "protein", "carbs", "fat"].map(key => [key, result[key]]));
}

// Completion is mandatory: never turn partial output or an HTTP 200 into a saved meal.
export async function completedResponse(response) {
  const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!response.body?.getReader || (mime && mime !== "text/event-stream")) throw new Error("invalid_inference_stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", output = "", completed = false, size = 0, serviceTier = null;
  function frame(block) {
    const lines = block.split("\n");
    const raw = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (!raw || raw === "[DONE]") return;
    const event = JSON.parse(raw);
    if (["error", "response.failed", "response.incomplete"].includes(event.type)) {
      const code = event.code || event.error?.code || event.response?.error?.code;
      throw new Error(["subscription_sharing_usage_limit_exceeded", "subscription_sharing_usage_unavailable"].includes(code) ? "plan_usage_unavailable" : "inference_failed");
    }
    if (event.type === "response.output_text.delta") {
      if (completed || typeof event.delta !== "string") throw new Error("invalid_inference_completion");
      output += event.delta;
    }
    if (event.type === "response.completed") {
      if (completed || event.response?.status !== "completed") throw new Error("invalid_inference_completion");
      const texts = (event.response.output || []).flatMap(item => item.content || [])
        .filter(item => item.type === "output_text").map(item => item.text).join("");
      output = texts || output;
      const tier = event.response.service_tier;
      serviceTier = ["auto", "default", "flex", "scale", "priority", "fast", "ultrafast"].includes(tier) ? tier : null;
      completed = true;
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
    return { text: output, serviceTier };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function completedText(response) {
  return (await completedResponse(response)).text;
}

export function foodEntryPayload(meal, createdAt) {
  const validated = parseMeal(JSON.stringify(meal));
  if (validated.needsClarification || !Number.isFinite(Date.parse(createdAt))) throw new Error("invalid_food_entry");
  // Only the existing database contract crosses the app backend boundary.
  return Object.fromEntries(["foodName", "quantity", "mealType", "calories", "protein", "carbs", "fat"].map(key => [key, validated[key]]).concat([["createdAt", createdAt]]));
}

export function friendlyError(error) {
  const code = error?.message || "";
  if (/cancel/i.test(code)) return "Connection cancelled. You can try again.";
  if (/native|development_build/.test(code)) return "ChatGPT connection needs the iOS development build. Expo Go is not supported.";
  if (/plan_permission/.test(code)) return "Allow ChatGPT plan usage when connecting your account.";
  if (/usage|429/.test(code)) return "Your ChatGPT usage is unavailable right now. Try again later.";
  if (/401|sign_in|refresh/.test(code)) return "Please reconnect your ChatGPT account.";
  if (/image/.test(code)) return "Choose a smaller meal photo and try again.";
  if (/meal_times/.test(code)) return "Couldn’t load your meal times. Check Meal times in Settings, then try again.";
  if (/voice|speech/.test(code)) return "Couldn’t transcribe the recording. Check your voice language and permissions, or use Manual.";
  if (/no_food/.test(code)) return "No food was identified. Please try again with a clearer description or photo.";
  if (/save_uncertain/.test(code)) return "The save could not be confirmed. Check History before trying again to avoid a duplicate.";
  return "That did not finish. Please try again; no meal was automatically saved.";
}
