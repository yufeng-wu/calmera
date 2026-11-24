import { PRIVACY_POLICY_VERSION } from "./privacyPolicy.mjs";

// Agreement to the Privacy Policy, including sending meal text, chosen photos and voice
// transcripts to the chosen AI provider (OpenAI or Anthropic). Like everything else, it's kept on this iPhone, so launch never
// waits on the network. Erase all data removes it, and calmera then asks again.
export const consentStorageKey = (owner) => `calmera.privacy-consent.${owner}`;

export function consentRecord(now = new Date(), version = PRIVACY_POLICY_VERSION) {
  return { version, acceptedAt: now.toISOString(), ai: ["openai", "anthropic"] };
}

const valid = (record) => Boolean(record) && typeof record === "object"
  && typeof record.version === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.version)
  && typeof record.acceptedAt === "string" && Number.isFinite(Date.parse(record.acceptedAt));

// Versions are dates, so a later policy sorts after an earlier one.
export const coversVersion = (record, version = PRIVACY_POLICY_VERSION) => valid(record) && record.version >= version
  && Array.isArray(record.ai) && ["openai", "anthropic"].every(provider => record.ai.includes(provider));

export async function readConsent(storage, owner) {
  try {
    const record = JSON.parse(await storage.getItem(consentStorageKey(owner)) || "null");
    return valid(record) ? record : null;
  } catch {
    return null;
  }
}

// "accepted" opens the app; "needed" is a first agreement; "updated" means an older
// version was agreed to.
export function consentStatus(record, version = PRIVACY_POLICY_VERSION) {
  if (coversVersion(record, version)) return "accepted";
  return valid(record) ? "updated" : "needed";
}

// Rejects when the agreement can't be saved, so the sheet can say so and stay open.
export async function saveConsent({ storage, owner, now = new Date() }) {
  const record = consentRecord(now);
  await storage.setItem(consentStorageKey(owner), JSON.stringify(record));
  return record;
}
