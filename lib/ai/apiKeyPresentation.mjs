import { API_KEY_PROVIDERS, providerFor } from "./models.mjs";
import { testOutcome } from "./providers.mjs";
import { modelName as nameOf } from "./modelCatalog.mjs";

// Plain words for what went wrong with a person's own key, during a test or while logging.
// `action` is "settings" when the key page is the fix, "retry" when waiting is. modelName is the
// model the request used, when the person chose one.
export function apiKeyIssue(code, providerId, modelName) {
  const provider = providerFor(providerId) || { name: "Your provider", company: "your provider", modelName: "this model" };
  const model = modelName || provider.modelName;
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
      message: `This key can’t use ${model}. Pick another model, or check the key’s permissions with ${provider.company}.` };
    case "no-images": return { title: "Can’t read photos", action: "settings",
      message: `${model} can’t read photos. Pick another model, or describe the meal in words.` };
    case "busy": return { title: `${provider.name} is busy`, action: "retry",
      message: `${provider.name} couldn’t answer just now. Try again in a moment.` };
    case "wrong-provider": return { title: "Wrong kind of key", action: "settings",
      message: `This looks like a ${other.name} key, not a ${provider.name} one.` };
    case "unknown": return { title: "That isn’t an OpenAI or Claude key", action: "settings",
      message: "Their keys start with sk-. Copy the whole key and paste it again." };
    case "malformed": return { title: "That isn’t a whole key", action: "settings",
      message: "Paste the whole key, with no spaces or line breaks." };
    case "failed": return { title: "Couldn’t finish", action: "retry",
      message: `${provider.name} couldn’t finish the request. Try again.` };
    default: return null;
  }
}

// A logging error from a person's own key, in the same words. Anything else isn't about the key.
export function loggingIssue(error, providerId) {
  if (!/^apikey_/.test(error?.message || "")) return null;
  const provider = error.provider || providerId;
  return apiKeyIssue(testOutcome(error), provider, error.model ? nameOf(provider, error.model) : undefined);
}
