import { providerFor } from "./models.mjs";
import { checkKeyShape, maskKey } from "./providers.mjs";

// calmera has exactly one AI connection at a time: a ChatGPT sign-in, an OpenAI API key or a
// Claude API key. One record in this iPhone's Keychain names it: { type: "chatgpt" } or
// { type, key } for a key. A ChatGPT sign-in's tokens stay where the ChatGPT client refreshes
// them; the record only says that they are the connection. `read()` is the one way to learn
// which connection there is. Every change writes the record first and deletes the old
// credential after, so two are never kept, and a switch cut short is finished on the next read.
export const CONNECTION_TYPES = Object.freeze(["chatgpt", "openai-key", "claude-key"]);
const KEY_TYPES = Object.freeze({ openai: "openai-key", anthropic: "claude-key" });
const PROVIDERS = Object.freeze({ "openai-key": "openai", "claude-key": "anthropic" });
export const keyTypeFor = provider => KEY_TYPES[provider] || null;
export const connectionStorageKey = owner => `calmera.connection.${owner}`;

// chatgpt: { connected(): Promise<boolean>, forget(): Promise<void> }. forget deletes the
// sign-in from this iPhone even when it can't be revoked with OpenAI.
export function createConnectionStore({ secureStore, owner, options, chatgpt }) {
  if (!/^[\w-]{1,150}$/.test(owner || "")) throw new Error("calmera_sign_in_required");
  const name = connectionStorageKey(owner);
  const signedIn = () => chatgpt.connected().catch(() => false);

  async function record() {
    const raw = await secureStore.getItemAsync(name);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      if (value?.type === "chatgpt") return { type: "chatgpt" };
      const provider = PROVIDERS[value?.type];
      return provider && providerFor(provider) && typeof value.key === "string" && value.key
        ? { type: value.type, provider, key: value.key } : null;
    } catch { return null; }
  }

  // The connection with its credential, for the code that sends meals. Never shown on screen.
  async function credential() {
    const saved = await record();
    if (saved?.type === "chatgpt") {
      if (await signedIn()) return saved;
      // Its tokens are gone, so there is nothing to connect with.
      await secureStore.deleteItemAsync(name).catch(() => {});
      return null;
    }
    if (saved) {
      // A switch from ChatGPT that stopped after saving the key: finish it.
      if (await signedIn()) await chatgpt.forget();
      return saved;
    }
    // A sign-in from before the record named ChatGPT: it is the connection, so say so.
    if (!await chatgpt.connected()) return null;
    await secureStore.setItemAsync(name, JSON.stringify({ type: "chatgpt" }), options).catch(() => {});
    return { type: "chatgpt" };
  }

  return {
    credential,
    // What Settings may show: the type, and a key only masked.
    async read() {
      const current = await credential();
      if (!current || current.type === "chatgpt") return current;
      return { type: current.type, provider: current.provider, masked: maskKey(current.key) };
    },
    // Saves a key as the connection, then removes whatever was there before.
    async saveKey(provider, key) {
      const type = keyTypeFor(provider);
      const clean = checkKeyShape(provider, key);
      if (!type) throw new Error("apikey_provider_unknown");
      await secureStore.setItemAsync(name, JSON.stringify({ type, key: clean }), options);
      if (await chatgpt.connected().catch(() => true)) await chatgpt.forget();
      return { type, provider, masked: maskKey(clean) };
    },
    // Called once a ChatGPT sign-in has been saved: it is now the connection, and a key goes.
    async chatgptConnected() { await secureStore.setItemAsync(name, JSON.stringify({ type: "chatgpt" }), options); },
    async disconnect() {
      await secureStore.deleteItemAsync(name);
      if (await chatgpt.connected().catch(() => true)) await chatgpt.forget();
    },
  };
}
