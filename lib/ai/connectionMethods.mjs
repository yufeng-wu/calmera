import { connectionIssue, isAuthorizationCancelled } from "../chatgpt/connectionStatus.mjs";
import { checkKeyShape, keyProvider } from "./providers.mjs";

// The two ways to connect calmera's one AI, and the one vocabulary for what connecting or
// checking found, whichever way it was. Every screen and alert turns these words into
// sentences (connectionPresentation.mjs), so a sign-in and a key never speak differently.
//   works         connected or checked fine
//   cancelled     the person closed the sign-in sheet; nothing to say
//   rejected      the provider refused this key or sign-in: connect again
//   signed-out    ChatGPT ended the sign-in: connect again
//   no-credit     out of credit or plan usage: fixed with the provider
//   not-allowed   this account can't use it
//   offline, busy, rate-limited, failed   try again
//   unknown, malformed, wrong-provider    what was pasted isn't a usable key
//   save-failed   the Keychain didn't take it
export const METHOD_IDS = Object.freeze(["chatgpt", "key"]);
export const methodOf = connection => (!connection ? null : connection.type === "chatgpt" ? "chatgpt" : "key");

// A key becomes the connection only once its provider has accepted it. An empty balance still
// proves the key is real, and keys are shown only once where they are made, so that one is kept.
const KEEPS_KEY = new Set(["works", "no-credit"]);
export const keepsKey = outcome => KEEPS_KEY.has(outcome);

// What a ChatGPT problem means in that vocabulary.
export function issueOutcome(issue) {
  if (!issue) return "works";
  switch (issue.kind) {
    case "sign-in": return "signed-out";
    case "limited": return "no-credit";
    case "restricted": return "not-allowed";
    case "unavailable": return "failed";
    default: return /busy/i.test(issue.title || "") ? "busy" : "offline";
  }
}
export function chatgptOutcome(error) {
  if (isAuthorizationCancelled(error)) return "cancelled";
  if ((error?.apiCode || error?.message) === "plan_permission_required") return "rejected";
  if (error instanceof TypeError) return "offline";
  return issueOutcome(connectionIssue(error));
}

// Connecting, as one step that ends the same way for both: { outcome, provider?, connected }.
export async function connectChatGPT(options, { signIn }) {
  try {
    await signIn(options);
    return { outcome: "works", connected: true };
  } catch (error) {
    return { outcome: chatgptOutcome(error), connected: false };
  }
}
export async function connectKey(draft, { test, save }) {
  const provider = keyProvider(draft);
  let key;
  try { key = checkKeyShape(provider || "openai", draft); } catch { key = null; }
  if (!provider || !key) return { outcome: provider ? "malformed" : "unknown", provider, connected: false };
  const outcome = await Promise.resolve().then(() => test(provider, key)).catch(() => "failed");
  if (!keepsKey(outcome)) return { outcome, provider, connected: false };
  try { await save(provider, key); } catch { return { outcome: "save-failed", provider, connected: false }; }
  return { outcome, provider, connected: true };
}
