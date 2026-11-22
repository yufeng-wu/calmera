import { providerFor } from "./models.mjs";
import { testOutcome } from "./providers.mjs";
import { chatgptOutcome } from "./connectionMethods.mjs";
import { problemFor } from "./connectionPresentation.mjs";

// Where each provider's usage or billing is managed, for problems only the provider can fix.
export const PROVIDER_PAGES = Object.freeze({
  chatgpt: Object.freeze({ label: "Manage Usage", url: "https://chatgpt.com/settings/usage" }),
  openai: Object.freeze({ label: "Open Billing", url: "https://platform.openai.com/settings/organization/billing/overview" }),
  anthropic: Object.freeze({ label: "Open Billing", url: "https://platform.claude.com/settings/billing" }),
});

// A problem with the AI connection that showed up while logging a meal, as one alert, in the
// same words the AI connection page uses. Returns null when the error isn't about the connection.
//   action "connection": the AI connection page fixes it (sign in again, replace the key).
//   action "provider": the provider's own page does (usage, billing); `url` is that page.
// inSheet: raised from the voice sheet, which covers every page. Nothing can open over it, so
// the alert says where to go instead of offering to go there.
export function loggingProblem(error, { inSheet = false } = {}) {
  const code = typeof error?.message === "string" ? error.message : "";
  const kept = inSheet ? "Your words are still here." : "Your meal is still here.";
  const place = "Settings → AI connection";
  if (/ai_connection_required/.test(code)) {
    return inSheet
      ? { title: "Connect an AI first", message: `calmera needs one to estimate your meal. Connect one in ${place}. ${kept}`, action: null }
      : { title: "Connect an AI first", message: `calmera needs one to estimate your meal. ${kept}`, action: "connection", actionLabel: "Connect" };
  }
  let method, outcome, provider = null;
  if (/^apikey_/.test(code)) { method = "key"; outcome = testOutcome(error); provider = error.provider || null; }
  else if (/usage|429/.test(code) || error?.apiCode === "subscription_sharing_usage_limit_exceeded") { method = "chatgpt"; outcome = "no-credit"; }
  else if (/sign_in|refresh|401|plan_permission|invalid_grant|token_expired/.test(code)) {
    method = "chatgpt";
    outcome = chatgptOutcome(error);
    if (!["rejected", "signed-out"].includes(outcome)) outcome = "signed-out";
  } else return null;

  const problem = problemFor(method, outcome, provider);
  // While logging, a refused key needs replacing, not the advice for pasting one.
  const message = method === "key" && outcome === "rejected" && providerFor(provider)
    ? `${providerFor(provider).name} didn’t accept your key.` : problem.message;
  if (problem.fix === "provider") {
    const page = PROVIDER_PAGES[method === "chatgpt" ? "chatgpt" : provider] || null;
    return { title: problem.title, message: `${message} ${kept}`, action: page ? "provider" : null, actionLabel: page?.label, url: page?.url };
  }
  if (problem.fix !== "reconnect") return { title: problem.title, message: `${message} ${kept}`, action: null };
  const label = method === "chatgpt" ? "Sign In" : "Replace Key";
  const where = method === "chatgpt" ? `Sign in again in ${place}.` : `Replace it in ${place}.`;
  return inSheet
    ? { title: problem.title, message: `${message} ${where} ${kept}`, action: null }
    : { title: problem.title, message: `${message} ${kept}`, action: "connection", actionLabel: label };
}
