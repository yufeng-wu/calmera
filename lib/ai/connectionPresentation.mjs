import { providerFor } from "./models.mjs";
import { checkKeyShape, keyProvider, maskKey } from "./providers.mjs";
import { apiKeyIssue } from "./apiKeyPresentation.mjs";

// The words for calmera's one AI connection, in one place: Settings, its page and the key page
// all read them from here, so a connection is never called two things.
const NAMES = Object.freeze({ chatgpt: "ChatGPT", "openai-key": "OpenAI key", "claude-key": "Claude key" });
export const connectionName = type => NAMES[type] || null;

// The Settings row's value. Undefined means the Keychain hasn't answered yet, so nothing shows.
export const connectionValue = connection => (connection === undefined ? null : connectionName(connection?.type) || "Not connected");

const keyOwner = connection => (connection && connection.type !== "chatgpt" ? providerFor(connection.provider) : null);
const expired = (current, issue) => current?.type === "chatgpt" && issue?.kind === "sign-in";
// Working, as far as calmera can tell without sending a meal.
export const isConnected = ({ current, issue }) => Boolean(current) && !expired(current, issue);

// The page's two rows. They never move or change name; only the detail and the mark do.
// state: "current" (checked), "attention" (ChatGPT signed calmera out) or "available".
export function connectionRows({ current, email, issue, busy }) {
  const chatgpt = current?.type === "chatgpt";
  const owner = keyOwner(current);
  return {
    chatgpt: {
      title: "ChatGPT",
      detail: busy === "sign-in" ? "Signing in…" : expired(current, issue) ? "Signed out. Tap to sign in again."
        : chatgpt ? email || "Signed in" : "Sign in with your account",
      state: expired(current, issue) ? "attention" : chatgpt ? "current" : "available",
    },
    key: {
      title: owner ? `${owner.name} API key` : "API key",
      detail: owner ? current.masked : "OpenAI or Claude",
      state: owner ? "current" : "available",
    },
  };
}

// What a pasted key is, while it is still in the field: whose it is and how it will be shown
// once saved. `key` is set only when the whole key is there.
export function readKeyDraft(value) {
  const provider = keyProvider(value);
  if (!provider) return { provider: null, key: null, caption: null };
  try {
    const key = checkKeyShape(provider, value);
    return { provider, key, caption: `${providerFor(provider).name} key · ${maskKey(key)}` };
  } catch { return { provider, key: null, caption: null }; }
}

// Why the key in the field can't be sent for a check yet, in the page's words.
export const keyDraftIssue = draft => apiKeyIssue(draft.provider ? "malformed" : "unknown", draft.provider);

// A key becomes the connection only once its provider has accepted it. An empty balance still
// proves the key is real, and keys are shown only once where they are made, so that one is kept.
const KEEPS_KEY = new Set(["works", "no-credit"]);
export const keepsKey = outcome => KEEPS_KEY.has(outcome);

// The key page's one button says what tapping it does to the connection already there.
export function connectTitle(current) {
  if (current?.type === "chatgpt") return "Switch from ChatGPT";
  return current ? "Replace key" : "Connect";
}

// Said once, after a switch has happened: what is in use now and what went.
export function switchNotice(previous, next) {
  if (!previous || !next) return null;
  const owner = keyOwner(next), former = keyOwner(previous);
  if (next.type === "chatgpt") return former ? `Now using ChatGPT. Your ${former.name} key is gone from this iPhone.` : null;
  if (previous.type === "chatgpt") return `Now using your ${owner.name} key. ChatGPT is signed out.`;
  if (previous.type !== next.type) return `Now using your ${owner.name} key. Your ${former.name} key is gone from this iPhone.`;
  return previous.masked !== next.masked ? "Key replaced." : null;
}

// What a key check found, for the row that started it.
export function keyCheck(outcome, providerId) {
  if (!outcome) return null;
  if (outcome === "works") return { ok: true, title: "Working", message: null };
  const issue = apiKeyIssue(outcome, providerId) || apiKeyIssue("failed", providerId);
  return { ok: false, title: issue.title, message: issue.message };
}

// A ChatGPT problem that signing in again won't fix, as one line under its rows.
export function chatgptNote(issue) {
  if (!issue || issue.kind === "sign-in") return null;
  if (issue.kind === "temporary") return { tone: "soft", text: "Couldn’t reach ChatGPT just now. Meals will go through once it answers." };
  return { tone: "bad", text: `${issue.title}. ${issue.message}` };
}

// The model row's value: the chosen model's name, or Automatic.
export function modelValue({ choices = [], preferred = null } = {}) {
  if (!preferred) return "Automatic";
  const match = choices.find(item => item.slug === preferred);
  return match ? match.display_name || match.slug : choices.length ? "Automatic" : preferred;
}

// The quiet line at the foot of the page: where meals go and where the credential stays.
export function privacyLine(current) {
  const owner = keyOwner(current);
  if (owner) return `Only what you log goes to ${owner.company}. Your key stays in this iPhone’s Keychain.`;
  if (current?.type === "chatgpt") return "Only what you log goes to OpenAI. Your sign-in stays on this iPhone.";
  return "What you log goes straight from this iPhone to the AI you pick. calmera has no servers.";
}
