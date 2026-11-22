import { createPlanClient } from "@/lib/chatgpt/planClient";
import { readChatGPTConnection } from "@/lib/chatgpt/connectionOutcome.mjs";
import { createSettingsOperations } from "@/lib/chatgpt/settingsOperations.mjs";
import { chatgptOutcome, connectChatGPT, connectKey } from "./connectionMethods.mjs";
import { AUTOMATIC, anthropicModels, chatgptModels, keyModels as keyCatalog, openaiModels, selectedName } from "./modelCatalog.mjs";
import { aiConnection, keyModels, signInToChatGPT, testKey } from "./mealAI";
import { aiPreferences } from "./aiPreferences";

// A sign-in belongs to the app, not to the page that started it: it finishes even if the page
// is left, and a second one can't start beside it.
const operations = createSettingsOperations();

// The live Keychain and network behind the AI connection pages (see connectionController.mjs).
// Both ways of connecting go through the same calls, which answer in the same outcome words
// (connectionMethods.mjs) and the same model lists (modelCatalog.mjs).
export function connectionServices(owner) {
  const store = aiConnection(owner);
  const preferences = aiPreferences(owner);
  const signIn = options => (operations.start(owner, "connect", () => signInToChatGPT(owner, options)) || operations.current(owner)).promise;
  async function models() {
    const connection = await store.credential();
    if (!connection) return null;
    if (connection.type === "chatgpt") return chatgptModels(await readChatGPTConnection(createPlanClient(owner), { knownConnected: true }));
    let listed = null;
    try {
      const data = await keyModels(connection.provider, connection.key);
      listed = connection.provider === "anthropic" ? anthropicModels(data) : openaiModels(data);
    } catch { /* The built-in list stands in. */ }
    return keyCatalog(connection.provider, listed, await preferences.model(connection.provider));
  }
  return {
    read: () => store.read(),
    pending: () => operations.current(owner)?.promise || null,
    chatgpt: () => readChatGPTConnection(createPlanClient(owner), { knownConnected: true }),
    connect: (method, input = {}) => method === "chatgpt"
      ? connectChatGPT({ newAccount: Boolean(input.newAccount) }, { signIn })
      : connectKey(input.draft, { test: testKey, save: (provider, key) => store.saveKey(provider, key) }),
    async check() {
      const connection = await store.credential();
      if (!connection) return null;
      if (connection.type !== "chatgpt") return testKey(connection.provider, connection.key);
      // Reading the model list needs a working sign-in and a reachable ChatGPT; it sends no meal.
      try { await createPlanClient(owner).models(); return "works"; } catch (error) { return chatgptOutcome(error); }
    },
    disconnect: () => store.disconnect(),
    models,
    // The model row's value for a key, without fetching the list.
    async keyModel(provider) { return preferences.model(provider); },
    // Changing the model never needs reconnecting. choice: an entry of models().models.
    async setModel(catalog, choice) {
      if (catalog.provider === "chatgpt") return createPlanClient(owner).setSelectedModel(choice.id === AUTOMATIC ? null : choice.id);
      return preferences.setModel(catalog.provider, choice.id === catalog.recommended ? null : choice);
    },
    selectedName,
  };
}
