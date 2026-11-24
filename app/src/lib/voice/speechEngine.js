import { requireOptionalNativeModule } from "expo-modules-core";

// The live recognizer behind the voice sheet. Null where the native module isn't built in.
export function speechEngine() {
  return requireOptionalNativeModule("ExpoSpeechRecognition");
}
