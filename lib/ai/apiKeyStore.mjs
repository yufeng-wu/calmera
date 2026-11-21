import { providerFor } from "./models.mjs";
import { checkKeyShape, maskKey } from "./providers.mjs";

// A person's own API key lives only in this iPhone's Keychain, beside the ChatGPT sign-in.
export const apiKeyStorageKey = owner => `calmera.apikey.${owner}`;

export function createApiKeyStore(secureStore, owner, options) {
  if (!/^[\w-]{1,150}$/.test(owner || "")) throw new Error("calmera_sign_in_required");
  const name = apiKeyStorageKey(owner);
  async function read() {
    const raw = await secureStore.getItemAsync(name);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return providerFor(value?.provider) && typeof value.key === "string" && value.key ? { provider: value.provider, key: value.key } : null;
    } catch { return null; }
  }
  return {
    read,
    // Everything Settings may show: never the key itself.
    async summary() {
      const saved = await read();
      return saved ? { provider: saved.provider, masked: maskKey(saved.key) } : null;
    },
    async save(provider, key) {
      const clean = checkKeyShape(provider, key);
      await secureStore.setItemAsync(name, JSON.stringify({ provider, key: clean }), options);
      return { provider, masked: maskKey(clean) };
    },
    remove: () => secureStore.deleteItemAsync(name),
  };
}
