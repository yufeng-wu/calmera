import { createPlanClient } from "@/lib/chatgpt/planClient";
import { readChatGPTConnection } from "@/lib/chatgpt/connectionOutcome.mjs";
import { createSettingsOperations } from "@/lib/chatgpt/settingsOperations.mjs";
import { aiConnection, signInToChatGPT, testKey } from "./mealAI";

// A sign-in belongs to the app, not to the page that started it: it finishes even if the page
// is left, and a second one can't start beside it.
const operations = createSettingsOperations();

// The live Keychain and network behind the AI connection pages (see connectionController.mjs).
export function connectionServices(owner) {
  const store = aiConnection(owner);
  return {
    read: () => store.read(),
    pending: () => operations.current(owner)?.promise || null,
    chatgpt: () => readChatGPTConnection(createPlanClient(owner), { knownConnected: true }),
    signIn: options => (operations.start(owner, "connect", () => signInToChatGPT(owner, options)) || operations.current(owner)).promise,
    disconnect: () => store.disconnect(),
    async checkKey() {
      const connection = await store.credential();
      return connection?.key ? testKey(connection.provider, connection.key) : null;
    },
    testKey,
    saveKey: (provider, key) => store.saveKey(provider, key),
    setModel: slug => createPlanClient(owner).setSelectedModel(slug),
  };
}
