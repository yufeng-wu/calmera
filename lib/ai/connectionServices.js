import { createPlanClient } from "@/lib/chatgpt/planClient";
import { readChatGPTConnection } from "@/lib/chatgpt/connectionOutcome.mjs";
import { createSettingsOperations } from "@/lib/chatgpt/settingsOperations.mjs";
import { chatgptOutcome, connectChatGPT, connectKey } from "./connectionMethods.mjs";
import { aiConnection, signInToChatGPT, testKey } from "./mealAI";

// A sign-in belongs to the app, not to the page that started it: it finishes even if the page
// is left, and a second one can't start beside it.
const operations = createSettingsOperations();

// The live Keychain and network behind the AI connection pages (see connectionController.mjs).
// Both ways of connecting go through connect(method, input) and check(), and answer in the
// same outcome words (connectionMethods.mjs).
export function connectionServices(owner) {
  const store = aiConnection(owner);
  const signIn = options => (operations.start(owner, "connect", () => signInToChatGPT(owner, options)) || operations.current(owner)).promise;
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
    setModel: slug => createPlanClient(owner).setSelectedModel(slug),
  };
}
