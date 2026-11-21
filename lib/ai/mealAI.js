import * as SecureStore from "expo-secure-store";
import { fetch } from "expo/fetch";
import { createPlanClient, isChatGPTAvailable } from "@/lib/chatgpt/planClient";
import { selectNutritionModel } from "@/lib/chatgpt/modelSelection.mjs";
import { modelLabel } from "@/lib/voice/voiceLog.mjs";
import { chatGPTKeys } from "@/lib/eraseData.mjs";
import { createConnectionStore } from "./connection.mjs";
import { createMealEstimator } from "./mealEstimator.mjs";
import { providerFor } from "./models.mjs";
import { createApiKeyCompletion, testApiKey } from "./providers.mjs";

const REVOKE_TIMEOUT_MS = 8000;

// Deletes a ChatGPT sign-in from this iPhone. Revoking it with OpenAI is tried first, but a
// slow or failed network can't keep the old sign-in around once something replaces it.
async function forgetChatGPT(owner) {
  let timer;
  const stalled = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), REVOKE_TIMEOUT_MS); });
  try { await Promise.race([createPlanClient(owner).disconnect(), stalled]); } catch { /* deleted below */ } finally { clearTimeout(timer); }
  for (const key of chatGPTKeys(owner)) await SecureStore.deleteItemAsync(key);
}

// The one AI connection, with the same Keychain protection as the ChatGPT sign-in.
export const aiConnection = owner => createConnectionStore({
  secureStore: SecureStore, owner, options: { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  chatgpt: {
    connected: async () => isChatGPTAvailable() && Boolean(await createPlanClient(owner).connected()),
    forget: () => forgetChatGPT(owner),
  },
});
export const testKey = (provider, key, options) => testApiKey({ fetch, provider, key, ...options });

// The one way the app asks for a meal estimate, from voice, typed text or a photo.
// Returns { type, label, estimate, estimateQuantity }: estimate takes
// { text, image, signal, onProgress } and gives the meals the review screen expects.
export async function mealAI(userId) {
  const connection = await aiConnection(userId).credential();
  switch (connection?.type) {
    case "openai-key":
    case "claude-key": {
      const provider = providerFor(connection.provider);
      return { type: connection.type, label: provider.modelName,
        ...createMealEstimator(createApiKeyCompletion({ fetch, provider: provider.id, key: connection.key })) };
    }
    case "chatgpt": {
      const client = createPlanClient(userId);
      const models = await client.models({ useCache: true });
      const model = selectNutritionModel(models, await client.getSelectedModel());
      if (!model) throw new Error("plan_usage_unavailable");
      return { type: "chatgpt", label: modelLabel(models, model),
        estimate: options => client.estimate({ ...options, model }),
        estimateQuantity: options => client.estimateQuantity({ ...options, model }) };
    }
    default: throw new Error("ai_connection_required");
  }
}
