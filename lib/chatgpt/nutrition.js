import { transcribeLocalClip } from "./transcription.mjs";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Alert, Linking } from "react-native";
import Constants from "expo-constants";
import { safeDiagnosticCode } from "./diagnostics.mjs";
import * as SecureStore from "expo-secure-store";
import { createPlanClient } from "./planClient";
import { friendlyError } from "./protocol.mjs";
import { mealSaveErrorPresentation } from "./saveErrorPresentation.mjs";
import { createVoiceLanguagePreferences } from "../voiceLanguagePreferences.mjs";

export async function nutritionClient(userId) {
  const client = createPlanClient(userId);
  if (!await client.connected()) throw new Error("chatgpt_sign_in_required");
  const models = await client.models();
  const preferred = await client.getSelectedModel();
  const model = models.find(item => item.slug === preferred)?.slug || models[0]?.slug;
  if (!model) throw new Error("plan_usage_unavailable");
  return { client, model };
}

export async function estimateMacros(userId, foodName, quantity, { signal } = {}) {
  const { client, model } = await nutritionClient(userId);
  if (signal?.aborted) throw new Error("request_cancelled");
  return client.estimateQuantity({ foodName, quantity, model, signal });
}

export function inferenceError(error, router) {
  const message = error?.message || "";
  const saveError = mealSaveErrorPresentation(error);
  if (saveError) {
    Alert.alert(saveError.title, saveError.message);
  } else if (/usage|429/.test(message)) {
    Alert.alert("ChatGPT usage limit", "Review your plan or foodwrap app limit in ChatGPT settings.", [
      { text: "Manage usage", onPress: () => Linking.openURL("https://chatgpt.com/settings/usage").catch(() => {}) },
      { text: "Not now", style: "cancel" },
    ]);
  } else if (/sign_in|refresh|401|development_build/.test(message)) {
    Alert.alert("Connect ChatGPT", "Connect your own ChatGPT account to use foodwrap.", [
      { text: "Not now", style: "cancel" },
      { text: "Connect", onPress: () => router.push("/chatgpt") },
    ]);
  } else {
    const diagnostic = Constants.expoConfig?.extra?.calmeraFullAppTest === true
      ? `\n\nTest code: ${safeDiagnosticCode(error)}` : "";
    Alert.alert("foodwrap.", friendlyError(error) + diagnostic);
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
