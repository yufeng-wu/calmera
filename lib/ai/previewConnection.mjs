import { createConnectionStore } from "./connection.mjs";
import { connectChatGPT, connectKey } from "./connectionMethods.mjs";
import { AUTOMATIC, chatgptModels, keyModels, selectedName } from "./modelCatalog.mjs";
import { usageRow } from "./usage.mjs";

// The AI connection's services with a Keychain in memory and no network, for the review gallery
// and the tests. state: "none", "claude-key", "chatgpt", "expired" (ChatGPT signed calmera out),
// "key-error" (every pasted key is refused), "signin-error" (sign-in can't reach OpenAI) or
// "catalog-error" (ChatGPT's model list fails once).
export const PREVIEW_KEY = "sk-ant-FAKE-preview-key-0000-WXYZ";
const MODELS = Object.freeze([{ slug: "calmera-preview", display_name: "ChatGPT model" }, { slug: "calmera-preview-fast", display_name: "ChatGPT fast model" }]);

// A made-up week of requests for the usage page's preview: numbers only, as the real record keeps.
export function sampleUsage(today = new Date()) {
  const rows = [];
  const add = (daysAgo, provider, model, times, input, output, searches = 0) => {
    const at = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, 12);
    for (let index = 0; index < times; index += 1) rows.push({ ...usageRow({ provider, model, input, output, searches }, at) });
  };
  add(6, "openai", "gpt-6-luna", 3, 2100, 420);
  add(5, "openai", "gpt-6-luna", 2, 2300, 510, 1);
  add(4, "chatgpt", "gpt-6.2-sol", 4, null, null);
  add(3, "chatgpt", "gpt-6.2-sol", 2, 2400, 600);
  add(2, "anthropic", "claude-haiku-5-5", 5, 2600, 480, 1);
  add(1, "anthropic", "claude-haiku-5-5", 3, 2500, 460);
  add(1, "anthropic", "claude-sonnet-5-5", 1, 3100, 720, 2);
  add(0, "anthropic", "claude-haiku-5-5", 4, 2700, 500, 1);
  return rows;
}

export function previewConnectionServices(state = "none", { delay = 0, email = "you@example.com", usage = [] } = {}) {
  const values = new Map();
  if (state === "claude-key") values.set("calmera.connection.preview", JSON.stringify({ type: "claude-key", key: PREVIEW_KEY }));
  if (state === "chatgpt" || state === "expired" || state === "catalog-error") values.set("calmera.connection.preview", JSON.stringify({ type: "chatgpt" }));
  let signedIn = values.get("calmera.connection.preview")?.includes("chatgpt") || false;
  let expired = state === "expired";
  let model = null;
  const keyChoices = {};
  let search = true;
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
  async function chatgpt() {
    if (state === "catalog-error" && ++attempts === 1) throw new TypeError("synthetic_network_failure");
    return { connected: signedIn, account: signedIn ? { email } : null, choices: MODELS.map(item => ({ ...item })), preferred: model,
      preferenceError: false, issue: expired ? { kind: "sign-in", title: "ChatGPT session expired", message: "Sign in to ChatGPT again to estimate nutrition.", action: "sign-in" } : null };
  }
  return {
    read: () => store.read(),
    pending: () => null,
    chatgpt,
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
    async models() {
      const connection = await store.read();
      if (!connection) return null;
      if (connection.type === "chatgpt") return chatgptModels(await chatgpt());
      // With no network, a key shows the built-in list, as it would offline.
      return keyModels(connection.provider, null, keyChoices[connection.provider] || null);
    },
    async keyModel(provider) { return keyChoices[provider] || null; },
    async searchOn() { return search; },
    async setSearch(on) { await wait(); search = Boolean(on); },
    async setModel(catalog, choice) {
      await wait();
      if (catalog.provider === "chatgpt") model = choice.id === AUTOMATIC ? null : choice.id;
      else keyChoices[catalog.provider] = choice.id === catalog.recommended ? null : choice;
    },
    selectedName,
    async usageRows() { return usage; },
  };
}
