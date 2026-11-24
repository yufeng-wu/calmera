// Pure helpers for the voice log sheet. The speech engine is injected so tests stay synthetic.

// Listening pauses itself after a minute; iOS recognition sessions also end on their own near then.
export const VOICE_LIMIT_MS = 60000;

// iOS asks for the microphone and speech recognition together. Ask only while the system still
// can; once the user has said no, only Settings can turn it back on.
export async function ensureVoicePermission(speech) {
  if (!speech) return "unavailable";
  const current = await speech.getPermissionsAsync();
  if (current?.granted) return "granted";
  if (current?.canAskAgain === false) return "blocked";
  const asked = await speech.requestPermissionsAsync();
  if (asked?.granted) return "granted";
  return asked?.canAskAgain === false ? "blocked" : "denied";
}

// expo-speech-recognition reports volume from -2 (silence) to 10 (loud). Speech mostly sits
// between 0 and 6, so ease the low end up and keep a floor of quiet at zero.
export function levelFromVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const unit = Math.min(1, Math.max(0, (number + 2) / 10));
  return unit < 0.12 ? 0 : Math.sqrt((unit - 0.12) / 0.88);
}

// A pause ends one recognition session; the next session's words follow the earlier ones.
export { joinTranscript } from "./transcript.mjs";

export function formatElapsed(ms) {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// Progress the ChatGPT stream reports, in order. "completed" means the estimate has fully arrived.
export const VOICE_STAGES = Object.freeze(["sending", "received", "analyzing", "receiving", "completed"]);

export function stageIndex(stage) {
  const index = VOICE_STAGES.indexOf(stage);
  return index < 0 ? 0 : index;
}

// Model names come from the ChatGPT catalog; fall back to the product name when unknown.
export function modelLabel(models, slug) {
  const found = Array.isArray(models) ? models.find(model => model?.slug === slug) : null;
  const name = typeof found?.display_name === "string" ? found.display_name.trim() : "";
  return name || "ChatGPT";
}

// The four steps under the orange, named for what's happening rather than as commands, so
// none reads like a button. "receiving" is still the estimate arriving, so it stays on step 3.
export const VOICE_STEPS = Object.freeze(["Send", "Estimate", "Review", "Ready"]);

export function voiceStep(stage, done = false) {
  if (done || stage === "completed") return VOICE_STEPS.length;
  return Math.min(VOICE_STEPS.length - 2, stageIndex(stage) - (stage === "receiving" ? 1 : 0));
}

export function stageCopy(stage, model = "ChatGPT") {
  switch (stage) {
    case "received": return { title: "Reading your meal", detail: `${model} is picking out each food you said` };
    case "analyzing": return { title: "Estimating calories", detail: `${model} is weighing up the portions` };
    case "receiving": return { title: "Almost there", detail: "Writing your foods down" };
    case "completed": return { title: "Ready to check", detail: "Look it over, then save" };
    default: return { title: `Sending to ${model}`, detail: "Only your words are sent, never audio" };
  }
}

// Short, varied prompts for an empty transcript, so the sheet never opens on the same line twice in a row.
export const VOICE_HINTS = Object.freeze([
  "“Two scrambled eggs and a slice of toast”",
  "“A large oat latte and a blueberry muffin”",
  "“Chicken burrito bowl with extra guac for lunch”",
  "“A bowl of ramen and two gyoza”",
  "“Greek yogurt with honey and granola”",
]);

export function voiceHint(seed) {
  const index = Math.abs(Math.floor(Number(seed) || 0)) % VOICE_HINTS.length;
  return VOICE_HINTS[index];
}
