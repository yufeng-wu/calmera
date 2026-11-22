import { createConnectionStore } from "./connection.mjs";
import { connectChatGPT, connectKey } from "./connectionMethods.mjs";

// The AI connection's services with a Keychain in memory and no network, for the review gallery
// and the tests. state: "none", "claude-key", "chatgpt", "expired" (ChatGPT signed calmera out),
// "key-error" (every pasted key is refused), "signin-error" (sign-in can't reach OpenAI) or
// "catalog-error" (ChatGPT's model list fails once).
export const PREVIEW_KEY = "sk-ant-FAKE-preview-key-0000-WXYZ";
const MODELS = Object.freeze([{ slug: "calmera-preview", display_name: "ChatGPT model" }, { slug: "calmera-preview-fast", display_name: "ChatGPT fast model" }]);

export function previewConnectionServices(state = "none", { delay = 0, email = "you@example.com" } = {}) {
  const values = new Map();
  if (state === "claude-key") values.set("calmera.connection.preview", JSON.stringify({ type: "claude-key", key: PREVIEW_KEY }));
  if (state === "chatgpt" || state === "expired" || state === "catalog-error") values.set("calmera.connection.preview", JSON.stringify({ type: "chatgpt" }));
  let signedIn = values.get("calmera.connection.preview")?.includes("chatgpt") || false;
  let expired = state === "expired";
  let model = null;
  let attempts = 0;
  const wait = () => new Promise(resolve => setTimeout(resolve, delay));
  const store = createConnectionStore({ owner: "preview", secureStore: {
    getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); },
  }, chatgpt: { connected: async () => signedIn, forget: async () => { signedIn = false; } } });
  const signIn = async () => {
    await wait();
    if (state === "signin-error") throw new TypeError("Network request failed");
    signedIn = true; expired = false;
    await store.chatgptConnected();
  };
  return {
    read: () => store.read(),
    pending: () => null,
    async chatgpt() {
      if (state === "catalog-error" && ++attempts === 1) throw new TypeError("synthetic_network_failure");
      return { connected: signedIn, account: signedIn ? { email } : null, choices: MODELS.map(item => ({ ...item })), preferred: model,
        preferenceError: false, issue: expired ? { kind: "sign-in", title: "ChatGPT session expired", message: "Sign in to ChatGPT again to estimate nutrition.", action: "sign-in" } : null };
    },
    connect: (method, input = {}) => method === "chatgpt" ? connectChatGPT(input, { signIn })
      : connectKey(input.draft, { test: async () => { await wait(); return state === "key-error" ? "rejected" : "works"; },
        save: (provider, key) => store.saveKey(provider, key) }),
    async check() {
      await wait();
      const connection = await store.credential();
      if (!connection) return null;
      return connection.type === "chatgpt" && expired ? "signed-out" : "works";
    },
    async disconnect() { await wait(); await store.disconnect(); },
    async setModel(slug) { await wait(); model = slug; },
  };
}
