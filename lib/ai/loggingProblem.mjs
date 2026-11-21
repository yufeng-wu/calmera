import { loggingIssue } from "./apiKeyPresentation.mjs";

// A problem with the AI connection that showed up while logging a meal, as one alert.
// Returns null when the error isn't about the connection.
//   action "connection": the AI connection page can fix it, so the alert offers to open it.
//   action "usage": ChatGPT's own settings can.
// inSheet: raised from the voice sheet, which covers every page. Nothing can open over it, so
// the alert says where to go instead of offering to go there.
export function loggingProblem(error, { inSheet = false } = {}) {
  const code = typeof error?.message === "string" ? error.message : "";
  const kept = inSheet ? "Your words are still here." : "Your meal is still here.";
  const place = "Settings → AI connection";
  const key = loggingIssue(error);
  let problem;
  if (key) {
    // Only a new key fixes a refused one; credit, limits and outages are fixed elsewhere or by waiting.
    const replace = key.action === "settings" && !/apikey_no_credit/.test(code);
    problem = { title: key.title, message: key.message, action: replace ? "connection" : null, actionLabel: "Replace Key",
      where: `Replace it in ${place}.` };
  } else if (/ai_connection_required/.test(code)) {
    problem = { title: "Connect an AI first", message: "calmera needs one to estimate your meal.", action: "connection", actionLabel: "Connect",
      where: `Connect one in ${place}.` };
  } else if (/usage|429/.test(code)) {
    return { title: "ChatGPT usage limit", message: `Review your plan or calmera’s limit in ChatGPT settings. ${kept}`, action: "usage", actionLabel: "Manage Usage" };
  } else if (/sign_in|refresh|401/.test(code)) {
    problem = { title: "ChatGPT signed you out", message: "Sign in again to keep estimating meals.", action: "connection", actionLabel: "Sign In",
      where: `Sign in again in ${place}.` };
  } else return null;
  const { where, ...alert } = problem;
  if (!alert.action) return { ...alert, message: `${alert.message} ${kept}` };
  return inSheet ? { ...alert, action: null, message: `${alert.message} ${where} ${kept}` } : { ...alert, message: `${alert.message} ${kept}` };
}
