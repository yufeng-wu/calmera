import { providerFor } from "./models.mjs";
import { checkKeyShape, keyProvider, maskKey } from "./providers.mjs";
import { apiKeyIssue } from "./apiKeyPresentation.mjs";
import { METHOD_IDS, methodOf } from "./connectionMethods.mjs";
import { shortName } from "./modelCatalog.mjs";

// The words for calmera's one AI connection, in one place. Signing in and pasting a key are two
// ways of doing the same thing, so both are offered the same way (a card: what it is, one line,
// one button) and, once connected, carry the same card. A key goes by its company (OpenAI key,
// Anthropic key); signing in goes by the product (ChatGPT).
//   account, offer, start  the card's title, what it says under it and its button, with nothing connected
//   switchTo               the row that swaps the connection in use for this one
//   title, hint            the connect page's header and line
//   change, fix            the row that changes it, and "Tap to …" when it needs connecting again
export const METHODS = Object.freeze({
  chatgpt: Object.freeze({ id: "chatgpt", account: "Your ChatGPT account", start: "Sign in with ChatGPT",
    offer: "Uses your ChatGPT plan’s limits. Works great if you already have ChatGPT Go, Plus, or Pro.",
    switchTo: "Switch to ChatGPT", title: "ChatGPT", hint: "Opens OpenAI to sign in, then comes back here.", change: "Change account", fix: "sign in again" }),
  key: Object.freeze({ id: "key", account: "An API key", start: "Paste a key",
    offer: "From OpenAI or Anthropic. ChatGPT Pro and Business, and Claude Max, Ultra and Team, include monthly API credits you can use here.",
    switchTo: "Switch to an API key", title: "API key", hint: "Paste it, and calmera can tell which one it is.", change: "Replace key", fix: "replace it" }),
});
// Under the key card: where each company explains the API credits some plans include. They open in Safari.
export const CREDIT_PAGES = Object.freeze([
  Object.freeze({ name: "OpenAI", url: "https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions" }),
  Object.freeze({ name: "Anthropic", url: "https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-ultra-and-team-plans" }),
]);

// The one name for a connection: the Settings row, the card in use, alerts and notices all use it.
export function connectionName(connection) {
  if (!connection) return null;
  if (connection.type === "chatgpt") return "ChatGPT";
  const provider = providerFor(connection.provider);
  return provider ? `${provider.company} key` : null;
}
// The Settings row's value. Undefined means the Keychain hasn't answered yet, so nothing shows.
export const connectionValue = connection => (connection === undefined ? null : connectionName(connection) || "Not connected");

// What an outcome (connectionMethods.mjs) means to the person, the same way for both methods.
// fix: "reconnect" (connect this way again), "provider" (sort it out with the provider), or null.
const CHATGPT_PROBLEMS = Object.freeze({
  rejected: { title: "ChatGPT didn’t allow calmera", message: "Sign in again and allow calmera to use your plan.", fix: "reconnect" },
  "signed-out": { title: "Signed out", message: "ChatGPT signed calmera out. Sign in again to keep estimating meals.", fix: "reconnect" },
  "no-credit": { title: "Usage limit reached", message: "Review your plan or calmera’s limit in ChatGPT settings.", fix: "provider" },
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

// The card for the connection in use: its name, who or which key, and whether it needs
// connecting again. `other` is the way it could be swapped for, folded into one row.
export function connectionCard({ current, account, attention }) {
  const using = methodOf(current);
  if (!using) return null;
  const problem = attention ? problemFor(using, attention, current.provider) : null;
  const detail = problem ? `${problem.title}. Tap to ${METHODS[using].fix}.` : using === "chatgpt" ? account || "Signed in" : current.masked;
  return { method: using, title: connectionName(current), detail, attention: Boolean(problem), other: METHOD_IDS.find(id => id !== using) };
}
// Working, as far as calmera can tell without sending a meal.
export const isConnected = ({ current, attention }) => Boolean(current) && !attention;

// What a key is, while it is still in the field: whose it is and how it will be shown once
// saved. `key` is set only when the whole key is there.
export function readKeyDraft(value) {
  const provider = keyProvider(value);
  if (!provider) return { provider: null, key: null, caption: null };
  try {
    const key = checkKeyShape(provider, value);
    return { provider, key, caption: `${providerFor(provider).company} key · ${maskKey(key)}` };
  } catch { return { provider, key: null, caption: null }; }
}

// The connect page's one button: what tapping it does to the connection already there.
export function connectTitle(method, current, { mode } = {}) {
  const using = methodOf(current);
  if (!using) return "Connect";
  if (using !== method) return method === "chatgpt" ? "Switch to ChatGPT" : "Switch to this key";
  if (method === "key") return "Replace key";
  return mode === "change" ? "Change account" : "Sign in again";
}
// Said once, on the connect page, before anything changes: the old one stays until the new one works.
export function keepsUntil(method, current, { mode } = {}) {
  const using = methodOf(current);
  if (!using) return null;
  if (using !== method) return current.type === "chatgpt" ? "ChatGPT stays signed in until the new key works."
    : `Your ${connectionName(current)} stays until you’re signed in to ChatGPT.`;
  if (method === "key") return "Your current key stays until the new one works.";
  return mode === "change" ? "You stay signed in until the new account is." : null;
}

// Said once, after a switch has happened: what is in use now and what went.
export function switchNotice(previous, next) {
  if (!previous || !next) return null;
  if (next.type === "chatgpt") return previous.type === "chatgpt" ? null : `Now using ChatGPT. Your ${connectionName(previous)} is gone from this iPhone.`;
  const now = `Now using your ${connectionName(next)}.`;
  if (previous.type === "chatgpt") return `${now} ChatGPT is signed out.`;
  if (previous.type !== next.type) return `${now} Your ${connectionName(previous)} is gone from this iPhone.`;
  return previous.masked !== next.masked ? "Key replaced." : null;
}

// What "Check connection" found, for its row.
export function checkResult(method, outcome, providerId) {
  if (!outcome) return null;
  if (outcome === "works") return { ok: true, title: "Working", message: null };
  const problem = problemFor(method, outcome, providerId);
  return { ok: false, title: problem.title, message: problem.message };
}

// Who is paid for an estimate, under the connection's settings.
export function billingLine(current) {
  if (!current) return null;
  if (current.type === "chatgpt") return "Estimates count toward your ChatGPT plan.";
  return `Estimates are billed to your ${providerFor(current.provider).company} account.`;
}

// Under Online search: what it does for this connection, and what it costs.
export function searchLine(current, { on = true, searchable = true } = {}) {
  if (!current) return null;
  const who = current.type === "chatgpt" ? "ChatGPT" : providerFor(current.provider).company;
  if (!searchable) return "This model can’t search the web. Pick another model to look things up.";
  if (!on) return `${who} estimates from what it already knows.`;
  const cost = current.type === "chatgpt" ? "It counts toward your plan." : "Each search costs about 1¢.";
  return `When you name a restaurant or brand, ${who} can look it up on the web. ${cost}`;
}

// The model row's value for ChatGPT: the chosen model's name, or Automatic.
export function modelValue({ choices = [], preferred = null } = {}) {
  if (!preferred) return "Automatic";
  const match = choices.find(item => item.slug === preferred);
  return match ? shortName(match.display_name) || match.slug : choices.length ? "Automatic" : preferred;
}

// The quiet lines about where things go: for the page as it stands, and for one way to connect.
export function privacyLine(current) {
  if (!current) return "What you log goes straight from this iPhone to the AI you pick. calmera has no servers.";
  return methodPrivacy(methodOf(current), current.provider);
}
export function methodPrivacy(method, providerId) {
  if (method === "chatgpt") return "Only what you log goes to OpenAI. Your sign-in stays on this iPhone.";
  const provider = providerFor(providerId);
  return provider ? `Only what you log goes to ${provider.company}. Your key stays in this iPhone’s Keychain.`
    : "Your key stays in this iPhone’s Keychain and goes only to the company it’s from.";
}
