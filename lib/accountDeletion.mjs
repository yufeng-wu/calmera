// Deleting an account is one request to the backend, which removes the person's meals,
// goals and profile and then closes their Clerk sign-in, followed by clearing what this
// phone keeps for them. Every step is safe to repeat, so any failure leaves a state the
// person can retry from. A marker in app storage carries an interrupted deletion across a
// restart. See docs/ACCOUNT_DELETION.md.

export const DELETION_MARKER = "calmera.account-deletion.v1";
// The server may need most of a minute to wake up before it can answer.
export const DELETION_TIMEOUT_MS = 60000;
const CHATGPT_REVOKE_TIMEOUT_MS = 8000;

export class AccountDeletionError extends Error {
  constructor(code, { dispatched = false, dataDeleted = false } = {}) {
    super(code);
    this.name = "AccountDeletionError";
    this.code = code;
    // The request may have reached the server, so something may have been deleted.
    this.dispatched = dispatched;
    // The server confirmed the meals, goals and profile are gone.
    this.dataDeleted = dataDeleted;
  }
}

// After a failure: what happened, and that trying again is safe.
export function deletionErrorMessage(error) {
  switch (error?.code) {
    case "account_close_failed":
      return "Your meals, goals and profile were deleted, but closing your account didn’t finish. Try again to finish.";
    case "unknown":
      return "Couldn’t reach calmera to finish. Check your connection and try again; it’s safe to repeat.";
    case "offline":
      return "Couldn’t reach calmera. Nothing was deleted. Check your connection and try again.";
    case "unavailable":
      return "Account deletion isn’t available right now. Nothing was deleted. Try again later.";
    case "busy":
      return "Too many requests right now. Nothing was deleted. Wait a moment and try again.";
    case "sign_in_required":
      return "Your session has ended, so nothing was deleted. Sign in again, then try again.";
    default:
      return "Couldn’t delete your account. Nothing was deleted. Try again.";
  }
}

// Clerk answers with one of these once a session no longer exists; a failing network
// throws without a status instead.
const sessionGone = (error) => [401, 403, 404].includes(Number(error?.status))
  || (Array.isArray(error?.errors) && error.errors.some(({ code } = {}) =>
    ["signed_out", "authentication_invalid", "resource_not_found", "session_not_found"].includes(code)));

// One DELETE to the backend. `fresh` asks Clerk for a new token rather than a cached one.
// `mayHaveDeleted` says an earlier attempt may have gone through: then a session that has
// ended means the account is most likely gone, not that the person needs to sign in.
export async function requestAccountDeletion({ getToken, url, fetchImpl = fetch, timeoutMs = DELETION_TIMEOUT_MS,
  fresh = false, mayHaveDeleted = false }) {
  const ended = () => new AccountDeletionError(mayHaveDeleted ? "session_ended" : "sign_in_required");
  let token;
  try { token = await getToken(fresh ? { skipCache: true } : undefined); }
  catch (error) { throw sessionGone(error) ? ended() : new AccountDeletionError("offline"); }
  if (!token) throw ended();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response, body = null;
  try {
    response = await fetchImpl(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    if (!response.ok) body = await response.json().catch(() => null);
  } catch {
    // Sent or not, the outcome is unknown; repeating it is safe.
    throw new AccountDeletionError("unknown", { dispatched: true });
  } finally {
    clearTimeout(timer);
  }
  if (response.ok) return { deleted: true };
  const { status } = response;
  if (status === 502 && body?.code === "account_close_failed") throw new AccountDeletionError("account_close_failed", { dispatched: true, dataDeleted: true });
  if (status === 500 && body?.code === "data_delete_failed") throw new AccountDeletionError("failed", { dispatched: true });
  if (status === 401 || status === 403) throw Object.assign(ended(), { dispatched: true });
  // Before the route exists, or when the rate limit turns the request away, nothing ran.
  if (status === 404) throw new AccountDeletionError("unavailable", { dispatched: true });
  if (status === 429) throw new AccountDeletionError("busy", { dispatched: true });
  throw new AccountDeletionError("unknown", { dispatched: true });
}

// What this phone keeps for a person. SecureStore can't list its keys, so they're named;
// app storage is searched for any calmera key that carries the person's ID.
export function chatGPTKeys(userId) {
  const key = `calmera.chatgpt.${userId}`;
  return [key, `${key}.registration`, `${key}.pending-registration`, `${key}.model`, `${key}.welcome`];
}
export const secureKeysFor = (userId) => [...chatGPTKeys(userId), `calmera.voice.${userId}`];
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const ownsKey = (key, userId) => typeof key === "string" && typeof userId === "string" && userId !== ""
  && key.startsWith("calmera.") && new RegExp(`[.:]${escapeRegExp(userId)}(?:$|[.:])`).test(key);

// Disconnecting ChatGPT also revokes its token with OpenAI, which needs the network; the
// saved credentials are deleted here either way. Returns the keys that couldn't be removed.
export async function clearLocalAccountData({ userId, asyncStorage, secureStore, disconnectChatGPT,
  revokeTimeoutMs = CHATGPT_REVOKE_TIMEOUT_MS }) {
  const failures = [];
  if (disconnectChatGPT) {
    let timer;
    const stalled = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), revokeTimeoutMs); });
    try { await Promise.race([Promise.resolve().then(disconnectChatGPT), stalled]); }
    catch { /* deleted below */ }
    finally { clearTimeout(timer); }
  }
  for (const key of secureKeysFor(userId)) {
    try { await secureStore.deleteItemAsync(key); }
    catch { failures.push(key); }
  }
  try {
    const keys = (await asyncStorage.getAllKeys()).filter((key) => ownsKey(key, userId));
    if (keys.length) await asyncStorage.multiRemove(keys);
  } catch {
    failures.push("app-storage");
  }
  return failures;
}

export async function readDeletionMarker(storage) {
  try {
    const marker = JSON.parse(await storage.getItem(DELETION_MARKER));
    return marker && typeof marker.userId === "string" && marker.userId ? marker : null;
  } catch {
    return null;
  }
}
const writeMarker = (storage, marker) => storage.setItem(DELETION_MARKER, JSON.stringify(marker)).catch(() => {});
const clearMarker = (storage) => storage.removeItem(DELETION_MARKER).catch(() => {});

// Returns the action for the Delete button: each press tries once, and repeated presses
// while one is running share it. Resolves with { confirmed } once the person is signed out
// and the phone is cleared, or rejects with an AccountDeletionError to show and retry.
export function createAccountDeletion({ userId, request, signOut, cleanup, storage, notify = () => {}, now = Date.now }) {
  let attempts = 0;
  let mayHaveDeleted = false;
  let running = null;
  const finish = async (confirmed) => {
    await writeMarker(storage, { userId, stage: "deleted", at: now() });
    notify(confirmed ? "account-deleted" : "deletion-unconfirmed");
    // Signing out first unmounts everything that could still write this person's caches.
    try { await signOut(); } catch { /* the session may already be gone with the account */ }
    const failures = await cleanup(userId);
    // Anything left behind is cleared on the next launch.
    if (!failures.length) await clearMarker(storage);
    return { confirmed, failures };
  };
  const run = async () => {
    attempts += 1;
    await writeMarker(storage, { userId, stage: "requested", at: now() });
    try {
      await request({ fresh: attempts > 1, mayHaveDeleted });
    } catch (error) {
      if (error?.code === "session_ended") return finish(false);
      if (error?.code === "unknown" || error?.code === "account_close_failed") mayHaveDeleted = true;
      if (!mayHaveDeleted) await clearMarker(storage);
      throw error;
    }
    return finish(true);
  };
  return () => (running ??= run().finally(() => { running = null; }));
}

// On launch and whenever who's signed in changes: finish what an interrupted deletion left
// on this phone. If the same person is still signed in and the server never confirmed, the
// account may still exist, so nothing is touched; they can try again from Settings.
export async function resumeAccountDeletion({ storage, signedInUserId = null, signOut, cleanup }) {
  const marker = await readDeletionMarker(storage);
  if (!marker) return null;
  const stillSignedIn = signedInUserId === marker.userId;
  if (stillSignedIn && marker.stage !== "deleted") return { finished: false };
  if (stillSignedIn) {
    try { await signOut(); } catch { /* already signed out with the account */ }
  }
  const failures = await cleanup(marker.userId);
  if (!failures.length) await clearMarker(storage);
  return { finished: true, failures };
}
