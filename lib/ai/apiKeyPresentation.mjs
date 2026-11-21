import { API_KEY_PROVIDERS, providerFor } from "./models.mjs";
import { testOutcome } from "./providers.mjs";

// Plain words for what went wrong with a person's own key, during a test or while logging.
// `action` is "settings" when the key page is the fix, "retry" when waiting is.
export function apiKeyIssue(code, providerId) {
  const provider = providerFor(providerId) || { name: "Your provider", company: "your provider", modelName: "this model" };
  const other = Object.values(API_KEY_PROVIDERS).find(item => item.id !== provider.id) || provider;
  switch (code) {
    case "rejected": return { title: "Key not accepted", action: "settings",
      message: `${provider.name} didn’t accept this key. Check you copied all of it, or make a new one.` };
    case "no-credit": return { title: "Out of credit", action: "settings",
      message: `This ${provider.company} account has no credit left. Add some in its billing settings, then try again.` };
    case "offline": return { title: "No connection", action: "retry",
      message: `Couldn’t reach ${provider.name}. Check your internet connection and try again.` };
    case "rate-limited": return { title: "Slow down a little", action: "retry",
      message: `${provider.name} is limiting this key for now. Wait a minute, then try again.` };
    case "not-allowed": return { title: "Key can’t use this model", action: "settings",
      message: `This key isn’t allowed to use ${provider.modelName}. Check its permissions with ${provider.company}.` };
    case "busy": return { title: `${provider.name} is busy`, action: "retry",
      message: `${provider.name} couldn’t answer just now. Try again in a moment.` };
    case "wrong-provider": return { title: "Wrong kind of key", action: "settings",
      message: `This looks like a ${other.name} key. Choose ${other.name} above, or paste a ${provider.name} key.` };
    case "malformed": return { title: "That isn’t a whole key", action: "settings",
      message: "Paste the whole key, with no spaces or line breaks." };
    case "failed": return { title: "Couldn’t finish", action: "retry",
      message: `${provider.name} couldn’t finish the request. Try again.` };
    default: return null;
  }
}

// A logging error from a person's own key, in the same words. Anything else isn't about the key.
export function loggingIssue(error, providerId) {
  return /^apikey_/.test(error?.message || "") ? apiKeyIssue(testOutcome(error), error.provider || providerId) : null;
}
