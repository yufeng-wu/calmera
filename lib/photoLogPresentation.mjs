export function photoConnectionPresentation(connection) {
  if (connection.state === "checking") return {
    title: "Checking ChatGPT connection…", detail: "Making sure OpenAI is ready for your photo.", icon: "sync-outline",
  };
  if (connection.state === "ready") return {
    title: "ChatGPT is ready", detail: "Connected to OpenAI.", icon: "checkmark-circle-outline",
  };
  if (connection.state === "disconnected") return {
    title: "Connect ChatGPT", detail: "Connect your ChatGPT account to estimate this photo.", icon: "information-circle-outline", action: "sign-in",
  };
  const issue = connection.issue;
  return { title: issue?.title || "Connection unavailable", detail: issue?.message || "Check your connection and try again.",
    icon: "information-circle-outline", action: issue ? issue.action : "retry" };
}

export function canEstimatePhoto({ photo, connection, busy, selecting, uncertain, mealSaved }) {
  return Boolean(photo && connection.state === "ready" && !busy && !selecting && !uncertain && !mealSaved);
}

export const PHOTO_ESTIMATION_PROGRESS = {
  preparing: { title: "Preparing your photo…", detail: "Checking your ChatGPT connection before sending." },
  sending: { title: "Sending your photo…", detail: "Your selected photo is on its way to OpenAI." },
  received: { title: "OpenAI received your request", detail: "Waiting for your nutrition estimate to begin." },
  analyzing: { title: "Estimating your meal…", detail: "OpenAI is working on your photo and nutrition estimate." },
  receiving: { title: "Receiving your estimate…", detail: "Your food breakdown is coming in." },
  completed: { title: "Preparing your meal review…", detail: "Checking the completed nutrition estimate." },
};

export const NO_FOOD_DETECTED = {
  title: "No Food Detected",
  message: "We couldn’t identify any food in this photo. Try a clear, well-lit photo with the whole meal in view, or add your food with text instead.",
};
