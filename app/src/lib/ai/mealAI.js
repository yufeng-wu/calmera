import * as SecureStore from "expo-secure-store";
import { fetch } from "expo/fetch";
import { createPlanClient, isChatGPTAvailable } from "@/lib/chatgpt/planClient";
import { selectNutritionModel } from "@/lib/chatgpt/modelSelection.mjs";
import { modelLabel } from "@/lib/voice/voiceLog.mjs";
import { chatGPTCredentialKeys } from "@/lib/settings/eraseData.mjs";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { createConnectionStore } from "./connection.mjs";
import { createMealEstimator } from "./mealEstimator.mjs";
import { providerFor } from "./models.mjs";
import { checkApiKey, createApiKeyCompletion, listModels, testApiKey } from "./providers.mjs";
import { modelName, shortName } from "./modelCatalog.mjs";
import { aiPreferences } from "./aiPreferences";
import { usageLog } from "./aiUsage";
import { normalizePreferences } from "./preferences.mjs";

const REVOKE_TIMEOUT_MS = 8000;

// Deletes a ChatGPT sign-in from this iPhone. Revoking it with OpenAI is tried first, but a
// slow or failed network can't keep the old sign-in around once something replaces it.
async function forgetChatGPT(owner) {
  let timer;
  const stalled = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), REVOKE_TIMEOUT_MS); });
  try { await Promise.race([createPlanClient(owner).disconnect(), stalled]); } catch { /* deleted below */ } finally { clearTimeout(timer); }
  for (const key of chatGPTCredentialKeys(owner)) await SecureStore.deleteItemAsync(key);
}

// The one AI connection, with the same Keychain protection as the ChatGPT sign-in.
export const aiConnection = owner => createConnectionStore({
  secureStore: SecureStore, owner, options: { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  chatgpt: {
    connected: async () => isChatGPTAvailable() && Boolean(await createPlanClient(owner).connected()),
    forget: () => forgetChatGPT(owner),
  },
});
// Every billed request is recorded for the usage page (numbers only; see usage.mjs).
const recorder = owner => entry => { usageLog(owner).record(entry); };
export const testKey = (provider, key, options) => testApiKey({ fetch, provider, key, onUsage: recorder(LOCAL_OWNER), ...options });
export const keyModels = (provider, key, options) => listModels({ fetch, provider, key, ...options });
// Free: listing models spends no tokens and no credit.
export const checkKey = (provider, key, options) => checkApiKey({ fetch, provider, key, ...options });

// Signing in to ChatGPT makes it the connection: once the sign-in is saved, a saved key goes.
export async function signInToChatGPT(owner, options) {
  await createPlanClient(owner).connect(options);
  await aiConnection(owner).chatgptConnected();
}

// The one way the app asks for a meal estimate, from voice, typed text or a photo.
// Returns { type, label, estimate, estimateQuantity }: estimate takes
// { text, image, signal, onProgress } and gives the meals the review screen expects.
export async function mealAI(userId) {
  const connection = await aiConnection(userId).credential();
  switch (connection?.type) {
    case "openai-key":
    case "claude-key": {
      const provider = providerFor(connection.provider);
      // The person's choice of model, or the default; no reconnecting to change it.
      const preferences = await aiPreferences(userId).read().catch(() => normalizePreferences(null));
      const choice = preferences.models[provider.id];
      const model = choice?.id || provider.model;
      // Online search, unless it's off or the provider said this model can't search.
      const search = preferences.search && choice?.search !== false;
      return { type: connection.type, label: shortName(choice?.name) || modelName(provider.id, model),
        ...createMealEstimator(createApiKeyCompletion({ fetch, provider: provider.id, key: connection.key, model,
          effort: choice?.effort !== false, search, onUsage: recorder(userId) }), { search }) };
    }
    case "chatgpt": {
      const client = createPlanClient(userId);
      const models = await client.models({ useCache: true });
      const model = selectNutritionModel(models, await client.getSelectedModel());
      if (!model) throw new Error("plan_usage_unavailable");
      const { search } = await aiPreferences(userId).read().catch(() => normalizePreferences(null));
      return { type: "chatgpt", label: shortName(modelLabel(models, model)) || "ChatGPT",
        estimate: options => client.estimate({ ...options, model, search, onUsage: recorder(userId) }),
        estimateQuantity: options => client.estimateQuantity({ ...options, model, search, onUsage: recorder(userId) }) };
    }
    default: throw new Error("ai_connection_required");
  }
}
