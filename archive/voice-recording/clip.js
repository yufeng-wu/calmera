// From lib/chatgpt/nutrition.js: the two helpers the hold-to-record voice log used.
import { requireOptionalNativeModule } from "expo-modules-core";
import { transcribeLocalClip } from "./transcription.mjs";

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
