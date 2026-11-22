import { providerFor } from "./models.mjs";
import { checkKeyShape, keyProvider, maskKey } from "./providers.mjs";
import { apiKeyIssue } from "./apiKeyPresentation.mjs";
import { methodOf } from "./connectionMethods.mjs";
import { shortName } from "./modelCatalog.mjs";

// The words for Calmera's one AI connection, in one place. There is one connection at a time;
// to change how it connects, a person disconnects and connects again. Signing in goes by
// "ChatGPT"; a key is "OpenAI API key" or "Anthropic API key" on the AI connection page and just
// "API key" anywhere else. No prices.
// With nothing connected, each way is a card: eyebrow, title, what it says, and one button.
export const METHODS = Object.freeze({
  chatgpt: Object.freeze({ id: "chatgpt", eyebrow: "Option 1", title: "ChatGPT Plan", start: "Sign in with ChatGPT",
    lines: Object.freeze(["Works great if you already have a paid ChatGPT subscription."]) }),
  key: Object.freeze({ id: "key", eyebrow: "Option 2", title: "API key", start: "Add API key",
    lines: Object.freeze(["Bring your own OpenAI or Anthropic API key.",
      "ChatGPT Pro and Business, and Claude Max, Ultra and Team include monthly API credits you can use here."]) }),
});
// The page where a key is pasted.
export const KEY_PAGE = Object.freeze({ title: "API key", hint: "Paste it, and Calmera can tell which one it is." });
// Under the key card: where each company explains the API credits some plans include. They open in Safari.
export const CREDIT_PAGES = Object.freeze([
  Object.freeze({ name: "OpenAI", url: "https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions" }),
  Object.freeze({ name: "Anthropic", url: "https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-ultra-and-team-plans" }),
]);

// The connection's name on the AI connection page: its status card and the Disconnect alert.
export function connectionName(connection) {
  if (!connection) return null;
  if (connection.type === "chatgpt") return "ChatGPT";
  const provider = providerFor(connection.provider);
  return provider ? `${provider.company} API key` : null;
}
// The Settings row's value. Undefined means the Keychain hasn't answered yet, so nothing shows.
export function connectionValue(connection) {
  if (connection === undefined) return null;
  if (!connection) return "Not connected";
  return connection.type === "chatgpt" ? "ChatGPT Plan" : "API key";
}

// What an outcome (connectionMethods.mjs) means to the person. These sentences are also the
// alerts Today shows while logging (loggingProblem.mjs).
// fix: "reconnect" (connect this way again), "provider" (sort it out with the provider), "model", or null.
const CHATGPT_PROBLEMS = Object.freeze({
  rejected: { title: "ChatGPT didn’t allow Calmera", message: "Sign in again and allow Calmera to use your plan.", fix: "reconnect" },
  "signed-out": { title: "Signed out", message: "ChatGPT signed Calmera out. Sign in again to keep estimating meals.", fix: "reconnect" },
  "no-credit": { title: "Usage limit reached", message: "Review your plan or Calmera’s limit in ChatGPT settings.", fix: "provider" },
  "not-allowed": { title: "Plan access unavailable", message: "ChatGPT plan access isn’t available for this account or workspace.", fix: null },
  offline: { title: "No connection", message: "Couldn’t reach ChatGPT. Check your internet connection and try again.", fix: null },
  busy: { title: "ChatGPT is busy", message: "ChatGPT couldn’t answer just now. Try again in a moment.", fix: null },
  "rate-limited": { title: "ChatGPT is busy", message: "ChatGPT couldn’t answer just now. Try again in a moment.", fix: null },
  failed: { title: "Couldn’t finish", message: "ChatGPT couldn’t finish the request. Try again.", fix: null },
});
export function problemFor(method, outcome, providerId, modelLabel) {
  if (!outcome || outcome === "works" || outcome === "cancelled") return null;
  if (outcome === "save-failed") return { title: "Couldn’t save your key", message: "Your connection hasn’t changed. Try again.", fix: null };
  if (method === "chatgpt") return { ...(CHATGPT_PROBLEMS[outcome] || CHATGPT_PROBLEMS.failed) };
  const issue = apiKeyIssue(outcome, providerId, modelLabel) || apiKeyIssue("failed", providerId);
  // A model the key can't use, or one that can't read photos, is fixed by picking another.
  const fix = outcome === "rejected" ? "reconnect" : outcome === "no-credit" ? "provider" : ["not-allowed", "no-images"].includes(outcome) ? "model" : null;
  return { title: issue.title, message: issue.message, fix };
}

// A sign-in that didn't work, in red where the ChatGPT card's description was. Not reaching
// ChatGPT is the usual reason; a refusal says so instead.
export const SIGN_IN_FAILED = "Couldn’t reach ChatGPT. Check your connection and try again.";
export function signInProblem(outcome) {
  if (!outcome || outcome === "works" || outcome === "cancelled") return null;
  if (outcome === "rejected" || outcome === "not-allowed") {
    const problem = problemFor("chatgpt", outcome);
    return outcome === "rejected" ? `${problem.title}. ${problem.message}` : problem.message;
  }
  return SIGN_IN_FAILED;
}

// The status card, with a connection: its name, the email or masked key, then what the last
// check found (Connected in green, or what's wrong in red), and the note under the card: who
// pays, or what to do. status is an outcome, or null while nothing is known yet.
const AGAIN = Object.freeze({ chatgpt: "Disconnect, then sign in with ChatGPT again.", key: "Disconnect, then add a new API key." });
export function connectionCard({ current, account, status }) {
  const using = methodOf(current);
  if (!using) return null;
  const problem = problemFor(using, status, current.provider);
  return {
    method: using,
    title: connectionName(current),
    detail: using === "chatgpt" ? account || null : current.masked,
    status: !status ? null : problem ? { tone: "bad", text: problem.title } : { tone: "good", text: "Connected" },
    note: problem ? { tone: "bad", text: problem.fix === "reconnect" ? AGAIN[using] : problem.message } : { tone: "plain", text: billingLine(current) },
  };
}
// Working, as far as Calmera can tell without sending a meal.
export const isConnected = ({ current, status }) => Boolean(current) && problemFor(methodOf(current), status, current.provider)?.fix !== "reconnect";

// What a key is, while it is still in the field: whose it is and how it will be shown once
// saved. `key` is set only when the whole key is there.
export function readKeyDraft(value) {
  const provider = keyProvider(value);
  if (!provider) return { provider: null, key: null, caption: null };
  try {
    const key = checkKeyShape(provider, value);
    return { provider, key, caption: `${providerFor(provider).company} API key · ${maskKey(key)}` };
  } catch { return { provider, key: null, caption: null }; }
}

// Who is paid for an estimate.
export function billingLine(current) {
  if (!current) return null;
  if (current.type === "chatgpt") return "Estimates count toward your ChatGPT plan.";
  return `Estimates are billed to your ${providerFor(current.provider).company} account.`;
}

// Under Online search: what it does, and for ChatGPT what it counts toward.
export function searchLine(current, { searchable = true } = {}) {
  if (!current) return null;
  if (!searchable) return "This model can’t search the web. Pick another model to look things up.";
  const does = "Looks up restaurants and brands you mention.";
  return current.type === "chatgpt" ? `${does} Searches count toward your plan.` : does;
}

// The model row's value for ChatGPT: the chosen model's name, or Automatic.
export function modelValue({ choices = [], preferred = null } = {}) {
  if (!preferred) return "Automatic";
  const match = choices.find(item => item.slug === preferred);
  return match ? shortName(match.display_name) || match.slug : choices.length ? "Automatic" : preferred;
}

// The quiet line about where things go, under everything on the page.
export function privacyLine(current) {
  if (!current) return "Your sign-in and API key are stored on your iPhone — Calmera has no access to them.";
  return methodPrivacy(methodOf(current), current.provider);
}
export function methodPrivacy(method, providerId) {
  if (method === "chatgpt") return "Only what you log goes to OpenAI. Your sign-in stays on this iPhone.";
  const provider = providerFor(providerId);
  return provider ? `Only what you log goes to ${provider.company}. Your API key stays in this iPhone’s Keychain.`
    : "Your API key stays in this iPhone’s Keychain and goes only to the company it’s from.";
}
