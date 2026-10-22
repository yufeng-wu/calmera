import { selectNutritionModel } from "./modelSelection.mjs";
import { connectionIssue } from "./connectionStatus.mjs";

// A linked account and the optional model catalog are separate concerns.
// Only explicit authorization errors require another sign-in; model failures
// must preserve the saved account and its default-model preference.
export async function readChatGPTConnection(client, {
  authorize = false, knownConnected = false, readWelcome = false, connectOptions,
  isCurrent = () => true, onConnection = () => {},
} = {}) {
  if (!isCurrent()) return null;
  const connected = knownConnected || (authorize ? (await client.connect(connectOptions), true) : Boolean(await client.connected()));
  if (!isCurrent()) return null;
  onConnection(connected);
  if (!isCurrent()) return null;
  let account = null;
  try { account = await client.account?.() || null; } catch { /* Display metadata is optional. */ }
  if (!isCurrent()) return null;
  if (!connected) return { connected: false, state: "disconnected", account, choices: [], selected: "", preferred: null, preferenceError: false, detailsError: false, issue: null, welcomed: null };

  let choices = [], selected = "", preferred = null, preferenceError = false, issue = null, welcomed = null;
  try {
    const catalog = await client.models();
    if (!isCurrent()) return null;
    if (!Array.isArray(catalog)) throw new Error("invalid_model_catalog");
    choices = catalog;
  } catch (error) {
    if (!isCurrent()) return null;
    issue = connectionIssue(error);
  }
  // Keep the user's API default visible even if the catalog is unavailable.
  // A failed preference read cannot invent an Automatic selection checkmark.
  try {
    preferred = await client.getSelectedModel() || null;
    if (!isCurrent()) return null;
  } catch (error) {
    if (!isCurrent()) return null;
    preferenceError = true;
    choices = [];
    issue ||= connectionIssue(error);
  }
  if (!issue) {
    selected = selectNutritionModel(choices, preferred) || "";
    if (!selected) issue = connectionIssue(new Error("no_eligible_models"));
  }
  if (readWelcome) {
    try { welcomed = Boolean(await client.hasWelcomed()); }
    catch { /* A failed optional welcome read does not undo authorization. */ }
  }
  if (!isCurrent()) return null;
  return { connected: true, state: issue?.kind || "ready", account, choices, selected, preferred, preferenceError, detailsError: Boolean(issue), issue, welcomed };
}
