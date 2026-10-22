const connectionActionLabels = {
  "sign-in": "Sign in to ChatGPT",
  usage: "Manage usage",
  retry: "Try again",
  settings: "Connection settings",
};

export function photoConnectionPresentation(connection) {
  if (connection.state === "checking") return {
    title: "Checking ChatGPT connection…", detail: "Making sure OpenAI is ready for your photo.",
  };
  if (connection.state === "ready") return {
    title: "ChatGPT is ready", detail: "Connected to OpenAI.",
  };
  if (connection.state === "disconnected") return {
    title: "Not signed in to ChatGPT", detail: "Sign in to ChatGPT to estimate nutrition.",
    action: "sign-in", actionLabel: connectionActionLabels["sign-in"],
  };
  const issue = connection.issue;
  // Group unavailable connections into one message and an actionable settings
  // link, while preserving the underlying error category and recovery policy.
  if (["restricted", "unavailable"].includes(issue?.kind || connection.state)) return {
    title: "ChatGPT unavailable", detail: "Check your ChatGPT connection settings.",
    action: "settings", actionLabel: connectionActionLabels.settings,
  };
  if (issue?.action === "retry" || !issue) return {
    title: "Couldn’t connect to ChatGPT", detail: "Check your connection and try again.",
    action: "retry", actionLabel: connectionActionLabels.retry,
  };
  return { title: issue.title, detail: issue.message,
    action: issue.action, actionLabel: connectionActionLabels[issue.action] };
}

export function canEstimatePhoto({ photo, connection, busy, selecting, uncertain, mealSaved }) {
  return Boolean(photo && connection.state === "ready" && !busy && !selecting && !uncertain && !mealSaved);
}

export const PHOTO_ESTIMATION_PROGRESS = {
  sending: { title: "Sending your photo…", detail: "Connecting to OpenAI and sending your selected photo." },
  received: { title: "OpenAI received your request", detail: "Waiting for your nutrition estimate to begin." },
  analyzing: { title: "Estimating your meal…", detail: "OpenAI is working on your photo and nutrition estimate." },
  receiving: { title: "Receiving your estimate…", detail: "Your food breakdown is coming in." },
  completed: { title: "Preparing your meal review…", detail: "Checking the completed nutrition estimate." },
};

export const NO_FOOD_DETECTED = {
  title: "No Food Detected",
  message: "We couldn’t identify any food in this photo. Try a clear, well-lit photo with the whole meal in view, or add your food with text instead.",
};
