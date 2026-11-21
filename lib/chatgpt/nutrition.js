import { transcribeLocalClip } from "./transcription.mjs";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Alert, Linking } from "react-native";
import Constants from "expo-constants";
import { safeDiagnosticCode } from "./diagnostics.mjs";
import * as SecureStore from "expo-secure-store";
import { mealAI } from "@/lib/ai/mealAI";
import { loggingIssue } from "@/lib/ai/apiKeyPresentation.mjs";
import { friendlyError } from "./protocol.mjs";
import { mealSaveErrorPresentation } from "./saveErrorPresentation.mjs";
import { createVoiceLanguagePreferences } from "../voiceLanguagePreferences.mjs";

export async function estimateMacros(userId, foodName, quantity, { signal } = {}) {
  const ai = await mealAI(userId);
  if (signal?.aborted) throw new Error("request_cancelled");
  return ai.estimateQuantity({ foodName, quantity, signal });
}

export function inferenceError(error, router) {
  const message = error?.message || "";
  const saveError = mealSaveErrorPresentation(error);
  const keyIssue = loggingIssue(error);
  if (saveError) {
    Alert.alert(saveError.title, saveError.message);
  } else if (keyIssue) {
    // What was said, typed or photographed stays on screen, ready to send again.
    const message = `${keyIssue.message} Your meal is still here.`;
    Alert.alert(keyIssue.title, message, keyIssue.action === "settings" ? [
      { text: "Not Now", style: "cancel" },
      { text: "API Key", onPress: () => router.push("/api-key") },
    ] : undefined);
  } else if (/usage|429/.test(message)) {
    Alert.alert("ChatGPT usage limit", "Review your plan or calmera app limit in ChatGPT settings.", [
      { text: "Manage Usage", onPress: () => Linking.openURL("https://chatgpt.com/settings/usage").catch(() => {}) },
      { text: "Not Now", style: "cancel" },
    ]);
  } else if (/sign_in|refresh|401|development_build/.test(message)) {
    Alert.alert("Connect ChatGPT", "Connect your own ChatGPT account, or add your own API key, to use calmera.", [
      { text: "Connect ChatGPT", onPress: () => router.push("/chatgpt") },
      { text: "Use an API Key", onPress: () => router.push("/api-key") },
      { text: "Not Now", style: "cancel" },
    ]);
  } else {
    const diagnostic = Constants.expoConfig?.extra?.calmeraFullAppTest === true
      ? `\n\nTest code: ${safeDiagnosticCode(error)}` : "";
    Alert.alert("calmera.", friendlyError(error) + diagnostic);
  }
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
