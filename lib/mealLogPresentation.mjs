import { providerFor } from "./ai/models.mjs";

const connectionActionLabels = {
  "sign-in": "Sign in to ChatGPT",
  usage: "Manage usage",
  retry: "Try again",
  settings: "Connection settings",
};

export function connectionPresentation(connection) {
  if (connection.state === "checking") return {
    title: "Checking ChatGPT connection…",
  };
  if (connection.state === "ready") return {
    title: connection.source === "api-key" ? `Your ${providerFor(connection.provider)?.name || "API"} key is ready` : "ChatGPT is ready",
  };
  if (connection.state === "disconnected") return {
    title: "Not signed in to ChatGPT",
    action: "sign-in", actionLabel: connectionActionLabels["sign-in"],
  };
  const issue = connection.issue;
  // Group unavailable connections into one message and an actionable settings
  // link, while preserving the underlying error category and recovery policy.
  if (["restricted", "unavailable"].includes(issue?.kind || connection.state)) return {
    title: "ChatGPT unavailable",
    action: "settings", actionLabel: connectionActionLabels.settings,
  };
  if (issue?.action === "retry" || !issue) return {
    title: "Couldn’t connect to ChatGPT",
    action: "retry", actionLabel: connectionActionLabels.retry,
  };
  return { title: issue.title,
    action: issue.action, actionLabel: connectionActionLabels[issue.action] };
}

export function canAnalyzeMeal({ inputMode = "photo", photo, text, connection, busy, selecting, uncertain, mealSaved }) {
  const hasInput = inputMode === "text" ? typeof text === "string" && text.trim().length > 0 && text.length <= 3000 : Boolean(photo);
  return Boolean(hasInput && connection.state === "ready" && !busy && !selecting && !uncertain && !mealSaved);
}

const progressTitles = {
  sending: "Sending your photo…",
  received: "OpenAI received your request",
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
