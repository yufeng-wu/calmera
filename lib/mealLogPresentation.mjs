// Who estimates the meal, by connection type. A ChatGPT check result carries no type.
const PROVIDER_NAMES = { chatgpt: "ChatGPT", "openai-key": "OpenAI", "claude-key": "Anthropic" };
export const providerName = type => PROVIDER_NAMES[type] || "ChatGPT";

// The chip above the voice estimate: "ChatGPT · Sol 6.1", "OpenAI · Luna 6", "Anthropic · Haiku 5.5".
export const modelChipLabel = (type, model) => {
  const name = providerName(type);
  return !model || model.startsWith(name) ? model || name : `${name} · ${model}`;
};

// What stands between a meal and its estimate, for the text and photo pages. With a working
// connection there is nothing to say, so nothing is said. Every fix but usage and a plain retry
// happens on the AI connection page (action "connect").
export function connectionPresentation(connection) {
  if (connection.state === "checking" || connection.state === "ready") return {};
  if (connection.state === "none" || connection.state === "disconnected") return {
    action: "connect", actionLabel: "Connect an AI to estimate",
  };
  const issue = connection.issue;
  if (issue?.action === "sign-in") return {
    title: "ChatGPT signed you out", action: "connect", actionLabel: "Sign in again",
  };
  if (issue?.action === "usage") return {
    title: issue.title, action: "usage", actionLabel: "Manage usage",
  };
  if (["restricted", "unavailable"].includes(issue?.kind || connection.state)) return {
    title: "ChatGPT isn’t available for this account", action: "connect", actionLabel: "AI connection",
  };
  return { title: "Couldn’t reach ChatGPT", action: "retry", actionLabel: "Try again" };
}

export function canAnalyzeMeal({ inputMode = "photo", photo, text, connection, busy, selecting, uncertain, mealSaved }) {
  const hasInput = inputMode === "text" ? typeof text === "string" && text.trim().length > 0 && text.length <= 3000 : Boolean(photo);
  return Boolean(hasInput && connection.state === "ready" && !busy && !selecting && !uncertain && !mealSaved);
}

const progressTitles = {
  sending: "Sending your photo…",
  received: "Request received",
  analyzing: "Estimating your meal…",
  receiving: "Receiving your estimate…",
  completed: "Preparing your meal review…",
};

export const NO_FOOD_DETECTED = {
  title: "No Food Detected",
  message: "We couldn’t identify any food in this photo. Try a clear, well-lit photo with the whole meal in view, or add your food with text instead.",
};

export function estimationTitle(stage, inputMode = "photo") {
  if (stage === "sending" && inputMode === "text") return "Sending your meal…";
  return progressTitles[stage] || progressTitles.sending;
}

export function noFoodMessage(inputMode) {
  return inputMode === "text" ? "We couldn’t identify any food in your description. Try naming a food or describing what you ate." : NO_FOOD_DETECTED.message;
}
