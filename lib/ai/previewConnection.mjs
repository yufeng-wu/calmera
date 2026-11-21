import { connectionStorageKey, createConnectionStore } from "./connection.mjs";

// The AI connection's services with a Keychain in memory and no network, for the review gallery
// and the tests. state: "none", "claude-key", "chatgpt", "expired", or "key-error" (the key page's
// check rejects whatever is pasted).
export const PREVIEW_KEY = "sk-ant-FAKE-preview-key-0000-WXYZ";
const MODELS = Object.freeze([{ slug: "calmera-preview", display_name: "ChatGPT model" }, { slug: "calmera-preview-fast", display_name: "ChatGPT fast model" }]);

export function previewConnectionServices(state = "none", { delay = 0, email = "you@example.com" } = {}) {
  const values = new Map();
  const owner = "preview";
  if (state === "claude-key") values.set(connectionStorageKey(owner), JSON.stringify({ type: "claude-key", key: PREVIEW_KEY }));
  let signedIn = state === "chatgpt" || state === "expired";
  let expired = state === "expired";
  let model = null;
  let attempts = 0;
  const wait = () => new Promise(resolve => setTimeout(resolve, delay));
  const store = createConnectionStore({ owner, secureStore: {
    getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); },
  }, chatgpt: { connected: async () => signedIn, forget: async () => { signedIn = false; } } });
  return {
    read: () => store.read(),
    pending: () => null,
    async chatgpt() {
      if (state === "catalog-error" && ++attempts === 1) throw new TypeError("synthetic_network_failure");
      return { connected: signedIn, account: signedIn ? { email } : null, choices: MODELS.map(item => ({ ...item })), preferred: model,
        preferenceError: false, issue: expired ? { kind: "sign-in", title: "ChatGPT session expired", message: "Sign in to ChatGPT again to estimate nutrition.", action: "sign-in" } : null };
    },
    async signIn() { await wait(); signedIn = true; expired = false; await store.chatgptConnected(); },
    async disconnect() { await wait(); await store.disconnect(); },
    async checkKey() { await wait(); return (await store.credential())?.key ? "works" : null; },
    async testKey() { await wait(); return state === "key-error" ? "rejected" : "works"; },
    saveKey: (provider, key) => store.saveKey(provider, key),
    async setModel(slug) { await wait(); model = slug; },
  };
}
