import { providerFor } from "./models.mjs";
import { checkKeyShape, maskKey } from "./providers.mjs";

// calmera has exactly one AI connection at a time: a ChatGPT sign-in, an OpenAI API key or a
// Claude API key. `read()` is the one way to learn which. An API key is kept here, in this
// iPhone's Keychain, as { type, key }. A ChatGPT sign-in keeps its tokens where the ChatGPT
// client refreshes them; it counts as the connection when no key record exists, which also
// covers a sign-in saved before this record did. Every change deletes the old credential once
// the new one is safely stored, so two are never kept.
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

  async function keyRecord() {
    const raw = await secureStore.getItemAsync(name);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      const provider = PROVIDERS[value?.type];
      return provider && providerFor(provider) && typeof value.key === "string" && value.key
        ? { type: value.type, provider, key: value.key } : null;
    } catch { return null; }
  }

  // The connection with its credential, for the code that sends meals. Never shown on screen.
  async function credential() {
    const record = await keyRecord();
    if (record) {
      // A switch from ChatGPT that stopped after saving the key: finish it.
      if (await chatgpt.connected().catch(() => false)) await chatgpt.forget();
      return record;
    }
    return await chatgpt.connected() ? { type: "chatgpt" } : null;
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
    // Called once a ChatGPT sign-in has been saved: it is now the connection.
    async chatgptConnected() { await secureStore.deleteItemAsync(name); },
    async disconnect() {
      await secureStore.deleteItemAsync(name);
      if (await chatgpt.connected().catch(() => true)) await chatgpt.forget();
    },
  };
}
