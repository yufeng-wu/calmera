import { isExportFile } from "./dataExport.mjs";
import { LOCAL_OWNER } from "./owner.mjs";
import { connectionStorageKey } from "./ai/connection.mjs";

// Erase all data: everything calmera keeps on this iPhone. App storage can be listed, so
// every calmera key goes. The Keychain can't, so its keys are named, including any left by
// people who signed in to the earlier cloud version (their ids come from app storage keys).
// An export file left in the cache folder goes too. Chosen photos never reach the disk.

export function chatGPTKeys(owner) {
  const key = `calmera.chatgpt.${owner}`;
  return [key, `${key}.registration`, `${key}.pending-registration`, `${key}.model`, `${key}.welcome`];
}
// The AI connection goes too, whichever it is: a pasted API key is as private as the ChatGPT sign-in.
export const secureKeysFor = (owner) => [...chatGPTKeys(owner), connectionStorageKey(owner), `calmera.voice.${owner}`];
// Not tied to a person: this iPhone's ChatGPT host id, and the cloud version's saved sign-in.
export const SHARED_SECURE_KEYS = ["calmera.chatgpt.host", "__clerk_client_jwt"];
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const ownsKey = (key, owner) => typeof key === "string" && typeof owner === "string" && owner !== ""
  && key.startsWith("calmera.") && new RegExp(`[.:]${escapeRegExp(owner)}(?:$|[.:])`).test(key);

// Signed-in ids from the cloud version, read from the keys their settings left behind.
export function formerOwners(keys = []) {
  const ids = new Set();
  for (const key of keys) {
    const match = /^calmera\.(?:theme\.v1:|privacy-consent\.|today\.v1\.|account-ready\.v1\.|food-icons\.v1\.|meal-times\.)(user_[\w-]+)$/.exec(key);
    if (match) ids.add(match[1]);
  }
  return [...ids];
}

const REVOKE_TIMEOUT_MS = 8000;

// Disconnecting ChatGPT also revokes its token with OpenAI, which needs the network; the
// saved credentials are deleted here either way. `cacheFiles` lists and removes files in the
// app's cache folder. Returns what couldn't be removed.
export async function eraseThisPhone({ asyncStorage, secureStore, disconnectChatGPT, cacheFiles, revokeTimeoutMs = REVOKE_TIMEOUT_MS }) {
  const failures = [];
  if (disconnectChatGPT) {
    let timer;
    const stalled = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), revokeTimeoutMs); });
    try { await Promise.race([Promise.resolve().then(disconnectChatGPT), stalled]); }
    catch { /* deleted below */ }
    finally { clearTimeout(timer); }
  }
  let keys = [];
  try { keys = await asyncStorage.getAllKeys(); }
  catch { failures.push("app-storage"); }
  const owners = [LOCAL_OWNER, ...formerOwners(keys)];
  for (const key of new Set([...owners.flatMap(secureKeysFor), ...SHARED_SECURE_KEYS])) {
    try { await secureStore.deleteItemAsync(key); }
    catch { failures.push(key); }
  }
  const ours = keys.filter((key) => typeof key === "string" && key.startsWith("calmera."));
  try { if (ours.length) await asyncStorage.multiRemove(ours); }
  catch { if (!failures.includes("app-storage")) failures.push("app-storage"); }
  if (cacheFiles) {
    let files = [];
    try { files = await cacheFiles.list(); }
    catch { failures.push("cache-files"); }
    for (const { name, path } of files) {
      if (!isExportFile(name)) continue;
      try { await cacheFiles.remove(path); }
      catch { failures.push(name); }
    }
  }
  return failures;
}
