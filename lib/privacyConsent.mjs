import { PRIVACY_POLICY_VERSION } from "./privacyPolicy.mjs";

// Agreement to the Privacy Policy, including sending meal text, chosen photos and voice
// transcripts to OpenAI. It's kept on the phone, so launch never waits on the network,
// and in the person's Clerk profile, so another phone or a reinstall doesn't ask again.
export const CONSENT_METADATA_KEY = "calmeraConsent";
export const consentStorageKey = (userId) => `calmera.privacy-consent.${userId}`;

export function consentRecord(now = new Date(), version = PRIVACY_POLICY_VERSION) {
  return { version, acceptedAt: now.toISOString(), ai: "openai" };
}

const valid = (record) => Boolean(record) && typeof record === "object"
  && typeof record.version === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.version)
  && typeof record.acceptedAt === "string";

// Versions are dates, so a later policy sorts after an earlier one.
export const coversVersion = (record, version = PRIVACY_POLICY_VERSION) => valid(record) && record.version >= version;

export function readRemoteConsent(unsafeMetadata) {
  const record = unsafeMetadata?.[CONSENT_METADATA_KEY];
  return valid(record) ? record : null;
}

export async function readLocalConsent(storage, userId) {
  try {
    const record = JSON.parse(await storage.getItem(consentStorageKey(userId)) || "null");
    return valid(record) ? record : null;
  } catch {
    return null;
  }
}

// "accepted" opens the app; "needed" is a first agreement; "updated" means an older
// version was agreed to. needsSync and needsCache say which copy should catch up.
export function consentStatus({ local, remote, version = PRIVACY_POLICY_VERSION }) {
  if (coversVersion(local, version)) {
    return { status: "accepted", record: local, needsSync: !coversVersion(remote, version), needsCache: false };
  }
  if (coversVersion(remote, version)) return { status: "accepted", record: remote, needsSync: false, needsCache: true };
  return { status: valid(local) || valid(remote) ? "updated" : "needed", record: null, needsSync: false, needsCache: false };
}

export async function cacheConsent(storage, userId, record) {
  try { await storage.setItem(consentStorageKey(userId), JSON.stringify(record)); return true; } catch { return false; }
}

export const CONSENT_SYNC_TIMEOUT_MS = 10000;

// Clerk replaces unsafeMetadata whole, so everything else in it is carried over.
// A slow network gives up after the timeout; the next launch tries again.
export async function syncConsent(user, record, timeoutMs = CONSENT_SYNC_TIMEOUT_MS) {
  let timer;
  try {
    await Promise.race([
      user.update({ unsafeMetadata: { ...(user.unsafeMetadata || {}), [CONSENT_METADATA_KEY]: record } }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("consent_sync_timeout")), timeoutMs); }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// The phone's copy is written first, so an agreement made offline still opens the app
// and reaches Clerk at a later launch. Only when neither copy saves is it an error.
export async function saveConsent({ storage, user, userId, now = new Date(), timeoutMs }) {
  const record = consentRecord(now);
  const cached = await cacheConsent(storage, userId, record);
  const synced = await syncConsent(user, record, timeoutMs);
  if (!cached && !synced) throw new Error("consent_not_saved");
  return { record, cached, synced };
}
