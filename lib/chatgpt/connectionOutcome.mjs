import { selectNutritionModel } from "./modelSelection.mjs";
import { connectionIssue } from "./connectionStatus.mjs";

// Credential presence is preserved independently from current availability.
// Only a completed model/permission check can publish the ready state.
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
  if (!connected) return { connected: false, state: "disconnected", account, choices: [], selected: "", preferred: null, detailsError: false, issue: null, welcomed: null };

  let choices = [], selected = "", preferred = null, issue = null, welcomed = null;
  try {
    const catalog = await client.models();
    if (!isCurrent()) return null;
    const storedModel = await client.getSelectedModel();
    if (!isCurrent()) return null;
    if (!Array.isArray(catalog)) throw new Error("invalid_model_catalog");
    preferred = storedModel || null;
    choices = catalog;
    selected = selectNutritionModel(choices, preferred) || "";
    if (!selected) throw new Error("no_eligible_models");
  } catch (error) {
    if (!isCurrent()) return null;
    choices = []; selected = "";
    issue = connectionIssue(error);
  }
  if (readWelcome) {
    try { welcomed = Boolean(await client.hasWelcomed()); }
    catch { /* A failed optional welcome read does not undo authorization. */ }
  }
  if (!isCurrent()) return null;
  return { connected: true, state: issue?.kind || "ready", account, choices, selected, preferred, detailsError: Boolean(issue), issue, welcomed };
}
