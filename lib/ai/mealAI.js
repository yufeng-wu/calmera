import * as SecureStore from "expo-secure-store";
import { fetch } from "expo/fetch";
import { createPlanClient, isChatGPTAvailable } from "@/lib/chatgpt/planClient";
import { selectNutritionModel } from "@/lib/chatgpt/modelSelection.mjs";
import { modelLabel } from "@/lib/voice/voiceLog.mjs";
import { createApiKeyStore } from "./apiKeyStore.mjs";
import { createMealEstimator } from "./mealEstimator.mjs";
import { providerFor } from "./models.mjs";
import { createApiKeyCompletion, testApiKey } from "./providers.mjs";

// Same Keychain protection as the ChatGPT sign-in: this iPhone only, while unlocked.
export const apiKeyStore = owner => createApiKeyStore(SecureStore, owner, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
export const testKey = (provider, key, options) => testApiKey({ fetch, provider, key, ...options });

// Which way meals are estimated right now. A saved API key wins over a ChatGPT sign-in.
export async function mealAISource(userId) {
  const saved = await apiKeyStore(userId).summary().catch(() => null);
  if (saved) return { kind: "api-key", ...saved };
  const connected = isChatGPTAvailable() && await createPlanClient(userId).connected().catch(() => false);
  return connected ? { kind: "chatgpt" } : null;
}

// The one way the app asks for a meal estimate, from voice, typed text or a photo.
// Returns { source, label, estimate, estimateQuantity }: estimate takes
// { text, image, signal, onProgress } and gives the meals the review screen expects.
export async function mealAI(userId) {
  const saved = await apiKeyStore(userId).read();
  if (saved) {
    const provider = providerFor(saved.provider);
    return { source: "api-key", provider: provider.id, label: provider.modelName,
      ...createMealEstimator(createApiKeyCompletion({ fetch, provider: provider.id, key: saved.key })) };
  }
  const client = createPlanClient(userId);
  if (!await client.connected()) throw new Error("chatgpt_sign_in_required");
  const models = await client.models({ useCache: true });
  const model = selectNutritionModel(models, await client.getSelectedModel());
  if (!model) throw new Error("plan_usage_unavailable");
  return { source: "chatgpt", label: modelLabel(models, model),
    estimate: options => client.estimate({ ...options, model }),
    estimateQuantity: options => client.estimateQuantity({ ...options, model }) };
}
