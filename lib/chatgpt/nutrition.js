import { transcribeLocalClip } from "./transcription.mjs";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Alert, Linking } from "react-native";
import Constants from "expo-constants";
import { safeDiagnosticCode } from "./diagnostics.mjs";
import * as SecureStore from "expo-secure-store";
import { mealAI } from "@/lib/ai/mealAI";
import { loggingProblem } from "@/lib/ai/loggingProblem.mjs";
import { friendlyError } from "./protocol.mjs";
import { mealSaveErrorPresentation } from "./saveErrorPresentation.mjs";
import { createVoiceLanguagePreferences } from "../voiceLanguagePreferences.mjs";

export async function estimateMacros(userId, foodName, quantity, { signal } = {}) {
  const ai = await mealAI(userId);
  if (signal?.aborted) throw new Error("request_cancelled");
  return ai.estimateQuantity({ foodName, quantity, signal });
}

// Every logging error ends here. A problem with the AI connection opens the one page that can
// fix it; `inSheet` is for the voice sheet, which nothing can open over.
export function inferenceError(error, router, { inSheet = false } = {}) {
  const saveError = mealSaveErrorPresentation(error);
  if (saveError) { Alert.alert(saveError.title, saveError.message); return; }
  const problem = loggingProblem(error, { inSheet });
  if (problem) {
    const open = problem.action === "provider" ? () => Linking.openURL(problem.url).catch(() => {})
      : () => router.push({ pathname: "/ai-connection", params: { then: "back" } });
    Alert.alert(problem.title, problem.message, problem.action ? [
      { text: "Not Now", style: "cancel" },
      { text: problem.actionLabel, onPress: open },
    ] : undefined);
    return;
  }
  const diagnostic = Constants.expoConfig?.extra?.calmeraFullAppTest === true
    ? `\n\nTest code: ${safeDiagnosticCode(error)}` : "";
  Alert.alert("calmera.", friendlyError(error) + diagnostic);
}

// One coordinator retains actual per-user writes across page reopening.
const voiceLanguages = createVoiceLanguagePreferences({
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
});
export const getVoiceLanguage = (userId, options) => voiceLanguages.load(userId, options);
export const setVoiceLanguage = (userId, language) => voiceLanguages.save(userId, language);

// Transcribes only the just-recorded app-owned clip. The raw clip never leaves
// the phone. The original long-press recorder and animation remain the UI.
export async function transcribeMealAudio(uri, language) {
  return transcribeLocalClip(requireOptionalNativeModule("ExpoSpeechRecognition"), uri, language);
}

// Numeric metadata only; the native method accepts this app's AV cache paths.
export async function voiceClipMetadata(uri) {
  const native = requireOptionalNativeModule("CalmeraChatGPT");
  return native?.voiceClipMetadata ? native.voiceClipMetadata(uri) : null;
}
