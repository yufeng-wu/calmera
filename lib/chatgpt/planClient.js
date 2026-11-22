import { Platform } from "react-native";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { fetch } from "expo/fetch";
import {
  ISSUER, RESOURCE, authorizationURL, callbackResult, tokenRecord,
  mealInput, completedText, completedResponse,
} from "./protocol.mjs";
import { openAIResponseError, savedChatGPTAccount } from "./connectionStatus.mjs";
import { createMealEstimator } from "../ai/mealEstimator.mjs";
import { waitForBrowserCallback } from "./browserCallback.mjs";

const native = Platform.OS === "ios" ? requireOptionalNativeModule("CalmeraChatGPT") : null;
const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const queues = new Map();
// Meal requests may reuse a short-lived catalog; Settings still refreshes it.
const modelCatalogs = new Map();
const MODEL_CATALOG_TTL_MS = 120000;

export const isChatGPTAvailable = () => Boolean(native);
export const pickMealPhoto = source => {
  if (!native) throw new Error("development_build_required");
  return native.pickPhoto(source);
};

function locked(key, action) {
  const previous = queues.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  queues.set(key, next);
  next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => {});
  return next;
}

async function requestJSON(url, options = {}, { emptyResponse = false } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { ...options, redirect: "error", signal: controller.signal });
    if (!response.ok) throw await openAIResponseError(response);
    return emptyResponse ? null : await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function randomString() {
  return Array.from(Crypto.getRandomBytes(32), byte => byte.toString(16).padStart(2, "0")).join("");
}

const receiveBrowserCallback = (url, onAuthorizationURL) => waitForBrowserCallback({
  native, browser: WebBrowser, url, onAuthorizationURL, development: __DEV__,
});

export function cancelPendingAuthorization() {
  native?.cancelCallback();
}

// Exercises the actual iOS browser -> native callback, without any account or token.
export async function checkDevelopmentCallback() {
  if (!__DEV__ || !native) throw new Error("development_build_required");
  const state = randomString();
  const redirectUri = await native.startCallback(state);
  const url = new URL(redirectUri);
  url.search = new URLSearchParams({ state, code: "synthetic-not-an-oauth-code", client_id: "oaiapp_synthetic" }).toString();
  const result = await receiveBrowserCallback(url.toString());
  const parsed = callbackResult(result, { redirectUri, state });
  if (parsed.code !== "synthetic-not-an-oauth-code" || parsed.clientId !== "oaiapp_synthetic") throw new Error("invalid_callback");
  return true;
}

// Credentials are scoped to the signed-in Calmera user and never sent to its backend.
export function createPlanClient(userId) {
  if (!/^[\w-]{1,150}$/.test(userId || "")) throw new Error("calmera_sign_in_required");
  const key = `calmera.chatgpt.${userId}`;
  const registrationKey = `${key}.registration`;
  const read = async () => {
    const value = await SecureStore.getItemAsync(key);
    return value ? JSON.parse(value) : null;
  };
  const write = record => SecureStore.setItemAsync(key, JSON.stringify(record), secureOptions);
  async function hostId() {
    const key = "calmera.chatgpt.host";
    let value = await SecureStore.getItemAsync(key);
    if (!value) {
      value = `urn:uuid:${Crypto.randomUUID()}`;
      await SecureStore.setItemAsync(key, value, secureOptions);
    }
    return value;
  }
  async function accessToken() {
    if (!native) throw new Error("development_build_required");
    return locked(key, async () => {
      const prior = await read();
      if (!prior) throw new Error("chatgpt_sign_in_required");
      if (prior.expires_at > Date.now() + 60000) return prior.access_token;
      if (!prior.refresh_token) throw new Error("chatgpt_refresh_required");
      const data = await requestJSON(`${ISSUER}/api/accounts/oauth/token`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", client_id: prior.client_id,
          refresh_token: prior.refresh_token, resource: RESOURCE }).toString(),
      });
      if (data.id_token) {
        await native.validateIdentity(data.id_token, prior.client_id, "", prior.identity.sub);
      }
      const record = tokenRecord(data, { clientId: prior.client_id, identity: prior.identity, prior });
      await write(record);
      return record.access_token;
    });
  }

  // search: offer OpenAI's web search tool. OpenAI allows it with a plan sign-in "subject to
  // model and account/workspace policy", so a refusal is answered by asking again without it.
  async function infer({ input, model, instructions, signal, serviceTier, metadata = false, onProgress, search = false }) {
    const token = await accessToken();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 120000);
    try {
      if (controller.signal.aborted) throw new Error("request_cancelled");
      try { onProgress?.("sending"); } catch { /* Optional UI update. */ }
      const response = await fetch(`${RESOURCE}/responses`, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ model, input, instructions, store: false, stream: true, ...(search ? { tools: [{ type: "web_search" }] } : {}),
          ...(serviceTier ? { service_tier: serviceTier } : {}) }),
      });
      if (!response.ok) {
        const error = new Error(`openai_http_${response.status}`);
        error.status = response.status;
        // Only the short error code is kept: never the provider's message or a request body.
        try {
          const value = await response.json();
          if (/^[a-z_]{1,80}$/.test(value.error?.code || "")) error.apiCode = value.error.code;
          if (metadata && value.error?.param === "service_tier") error.apiParameter = "service_tier";
        } catch {}
        throw error;
      }
      return await (metadata ? completedResponse(response, { onProgress }) : completedText(response, { onProgress }));
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }

  const mealEstimator = (model, search) => createMealEstimator(async ({ instructions, text, image, signal, onProgress }) => {
    const ask = withSearch => infer({ input: mealInput(text, image), model, signal, instructions, onProgress, search: withSearch });
    if (!search) return ask(false);
    try { return await ask(true); } catch (error) {
      // Looking things up is optional; an estimate never depends on it.
      if (error?.status !== 400 || signal?.aborted) throw error;
      return ask(false);
    }
  }, { search });

  return {
    // Explicit, full-test-build-only capability check. One harmless completion;
    // no meal parser, database write, automatic retry, or billing/account change.
    async checkFastMode({ model, signal }) {
      if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) throw new Error("development_build_required");
      return infer({ model, signal, serviceTier: "priority", metadata: true,
        input: [{ role: "user", content: [{ type: "input_text", text: "Reply with exactly OK." }] }] });
    },
    async hasWelcomed() { return Boolean(await SecureStore.getItemAsync(`${key}.welcome`)); },
    async markWelcomed() { await SecureStore.setItemAsync(`${key}.welcome`, "1", secureOptions); },
    async connected() { return native ? Boolean(await read()) : false; },
    async account() {
      const record = await read();
      return savedChatGPTAccount(record) || (await SecureStore.getItemAsync(registrationKey) ? { email: null, hasRegistration: true } : null);
    },
    async connect({ onAuthorizationURL, newAccount = false } = {}) {
      if (!native) throw new Error("development_build_required");
      return locked(key, async () => {
        const prior = await read();
        // Existing registrations are workspace-bound. A deliberate account
        // change must start a separate registration, without the old identity.
        const issued = newAccount ? null : prior?.client_id || await SecureStore.getItemAsync(registrationKey);
        const state = randomString(), nonce = randomString(), verifier = randomString();
        const challenge = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier,
          { encoding: Crypto.CryptoEncoding.BASE64 })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
        const installationHost = await hostId();
        const redirectUri = await native.startCallback(state);
        try {
          const result = await receiveBrowserCallback(authorizationURL({
            hostId: installationHost, redirectUri, state, nonce, challenge, clientId: issued,
          }), onAuthorizationURL);
          const { code, clientId } = callbackResult(result, { redirectUri, state, clientId: issued });
          // Keep an issued ID even if code exchange fails, but never replace
          // the active account's registration during a pending account change.
          const pendingKey = newAccount ? `${key}.pending-registration` : registrationKey;
          if (newAccount || !issued) await SecureStore.setItemAsync(pendingKey, clientId, secureOptions);
          const data = await requestJSON(`${ISSUER}/api/accounts/oauth/token`, {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code,
              code_verifier: verifier, redirect_uri: redirectUri, resource: RESOURCE }).toString(),
          });
          if (!data.id_token) throw new Error("id_token_required");
          const identity = await native.validateIdentity(data.id_token, clientId, nonce, newAccount ? "" : prior?.identity?.sub || "");
          // Commit the complete new identity and token set together only after
          // signature, audience, nonce and ChatGPT-plan permission validation.
          // Cancellation or any earlier failure leaves the old account usable.
          await write(tokenRecord(data, { clientId, identity }));
          modelCatalogs.delete(key);
          // The credential record is authoritative. Optional bookkeeping must
          // not turn an already-confirmed switch into an apparent failure.
          await SecureStore.setItemAsync(registrationKey, clientId, secureOptions).catch(() => {});
          if (newAccount) await SecureStore.deleteItemAsync(`${key}.pending-registration`).catch(() => {});
        } finally {
          native.cancelCallback();
        }
      });
    },
    async disconnect() {
      modelCatalogs.delete(key);
      return locked(key, async () => {
        const prior = await read();
        if (prior?.refresh_token) {
          const configuration = await requestJSON(`${ISSUER}/.well-known/openid-configuration`);
          const endpoint = new URL(configuration.revocation_endpoint);
          if (endpoint.origin !== ISSUER || endpoint.username || endpoint.password || endpoint.hash) throw new Error("invalid_revocation_endpoint");
          await requestJSON(endpoint.toString(), {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: prior.refresh_token, token_type_hint: "refresh_token", client_id: prior.client_id }).toString(),
          }, { emptyResponse: true });
        }
        await SecureStore.deleteItemAsync(key);
        await SecureStore.deleteItemAsync(registrationKey);
        await SecureStore.deleteItemAsync(`${key}.pending-registration`);
        await SecureStore.deleteItemAsync(`${key}.model`);
      });
    },
    async models({ useCache = false } = {}) {
      const token = await accessToken();
      const cached = modelCatalogs.get(key);
      // A submit during preloading joins the same request, even across clients.
      if (cached?.token === token) {
        if (cached.pending) return (await cached.pending).map(item => ({ ...item }));
        if (useCache && cached.expiresAt > Date.now()) {
          return cached.models.map(item => ({ ...item }));
        }
      }
      const entry = { token };
      modelCatalogs.set(key, entry);
      entry.pending = (async () => {
        try {
          const result = await requestJSON(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${token}` } });
          if (!Array.isArray(result.models)) throw new Error("invalid_model_catalog");
          // An old connection's late response must not repopulate the cache.
          if (modelCatalogs.get(key) !== entry) throw new Error("request_cancelled");
          const models = result.models.filter(item => item.visibility === "list" && typeof item.slug === "string")
            .map(({ slug, display_name }) => ({ slug, display_name }));
          entry.models = models;
          entry.expiresAt = Date.now() + MODEL_CATALOG_TTL_MS;
          return models;
        } catch (error) {
          if (modelCatalogs.get(key) === entry) modelCatalogs.delete(key);
          throw error;
        } finally {
          entry.pending = null;
        }
      })();
      return (await entry.pending).map(item => ({ ...item }));
    },
    async getSelectedModel() { return SecureStore.getItemAsync(`${key}.model`); },
    async setSelectedModel(slug) {
      if (slug === null) { await SecureStore.deleteItemAsync(`${key}.model`); return; }
      if (typeof slug !== "string" || !/^[\w.-]{1,200}$/.test(slug)) throw new Error("invalid_model");
      await SecureStore.setItemAsync(`${key}.model`, slug, secureOptions);
    },
    // Prompts and parsing are shared with a person's own API key, in lib/ai/mealEstimator.mjs.
    estimate({ model, search = false, ...options }) { return mealEstimator(model, search).estimate(options); },
    estimateQuantity({ model, search = false, ...options }) { return mealEstimator(model, search).estimateQuantity(options); },
  };
}

// Best-effort preparation on add-meal intent. Never opens sign-in or runs inference.
export async function preloadNutritionModels(userId) {
  if (!userId) return;
  try {
    const client = createPlanClient(userId);
    if (await client.connected()) await client.models({ useCache: true });
  } catch {
    // Navigation/recording must proceed; submit uses the usual error handling.
  }
}
