import { Platform } from "react-native";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { fetch } from "expo/fetch";
import {
  ISSUER, RESOURCE, authorizationURL, callbackResult, tokenRecord,
  mealInput, completedText, completedResponse, parseMeals, parseNutrition,
} from "./protocol.mjs";
import { mealInstructions, quantityPrompt } from "./prompts.mjs";
import { waitForBrowserCallback } from "./browserCallback.mjs";

const native = Platform.OS === "ios" ? requireOptionalNativeModule("CalmeraChatGPT") : null;
const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const queues = new Map();

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

async function requestJSON(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { ...options, redirect: "error", signal: controller.signal });
    if (!response.ok) throw new Error(`openai_http_${response.status}`);
    return await response.json();
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

  async function infer({ input, model, instructions, signal, serviceTier, metadata = false }) {
    const token = await accessToken();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 120000);
    try {
      const response = await fetch(`${RESOURCE}/responses`, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ model, input, instructions, store: false, stream: true, ...(serviceTier ? { service_tier: serviceTier } : {}) }),
      });
      if (!response.ok) {
        const error = new Error(`openai_http_${response.status}`);
        if (metadata) {
          try {
            const value = await response.json();
            if (/^[a-z_]{1,80}$/.test(value.error?.code || "")) error.apiCode = value.error.code;
            if (value.error?.param === "service_tier") error.apiParameter = "service_tier";
          } catch {}
        }
        throw error;
      }
      return await (metadata ? completedResponse(response) : completedText(response));
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }

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
    async connect({ onAuthorizationURL } = {}) {
      if (!native) throw new Error("development_build_required");
      return locked(key, async () => {
        const prior = await read();
        const issued = await SecureStore.getItemAsync(registrationKey);
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
          await SecureStore.setItemAsync(registrationKey, clientId, secureOptions);
          const data = await requestJSON(`${ISSUER}/api/accounts/oauth/token`, {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code,
              code_verifier: verifier, redirect_uri: redirectUri, resource: RESOURCE }).toString(),
          });
          if (!data.id_token) throw new Error("id_token_required");
          const identity = await native.validateIdentity(data.id_token, clientId, nonce, prior?.identity?.sub || "");
          await write(tokenRecord(data, { clientId, identity }));
        } finally {
          native.cancelCallback();
        }
      });
    },
    async disconnect() {
      return locked(key, async () => {
        await SecureStore.deleteItemAsync(key);
        await SecureStore.deleteItemAsync(registrationKey);
        await SecureStore.deleteItemAsync(`${key}.model`);
      });
    },
    async models() {
      const token = await accessToken();
      const result = await requestJSON(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${token}` } });
      if (!Array.isArray(result.models)) throw new Error("invalid_model_catalog");
      return result.models.filter(item => item.visibility === "list" && typeof item.slug === "string")
        .map(({ slug, display_name }) => ({ slug, display_name }));
    },
    async getSelectedModel() { return SecureStore.getItemAsync(`${key}.model`); },
    async setSelectedModel(slug) {
      if (typeof slug !== "string" || !/^[\w.-]{1,200}$/.test(slug)) throw new Error("invalid_model");
      await SecureStore.setItemAsync(`${key}.model`, slug, secureOptions);
    },
    async estimate({ text, image, model, signal }) {
      return parseMeals(await infer({ input: mealInput(text, image), model, signal,
        instructions: mealInstructions(text, Boolean(image)) }));
    },
    async estimateQuantity({ foodName, quantity, model, signal }) {
      if (typeof foodName !== "string" || !foodName.trim() || foodName.length > 255 ||
          typeof quantity !== "string" || !quantity.trim() || quantity.length > 255) throw new Error("invalid_meal_text");
      const normalizedQuantity = /^\d+(?:\.\d+)?$/.test(quantity.trim()) ? `${quantity.trim()} counts` : quantity;
      const result = parseNutrition(await infer({ model, signal,
        input: [{ role: "user", content: [{ type: "input_text", text: `${foodName}, ${normalizedQuantity}` }] }],
        instructions: quantityPrompt(foodName, normalizedQuantity) }));
      return { ...result, normalizedQuantity };
    },
  };
}
