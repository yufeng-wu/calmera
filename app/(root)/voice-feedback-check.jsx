import { useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { voiceFeedbackDiagnostics } from "@/lib/chatgpt/voiceFeedbackDiagnostics.mjs";
import RNFS from "react-native-fs";
import { phoneTestVoiceAudio } from "@/lib/chatgpt/phoneTestVoice.mjs";
import { voiceClipMetadata } from "@/lib/chatgpt/nutrition";
import { COLORS } from "@/constants/colors";

export default function VoiceFeedbackCheck() {
  const [fixtureResult, setFixtureResult] = useState("Not checked");
  const events = useSyncExternalStore(voiceFeedbackDiagnostics.subscribe, voiceFeedbackDiagnostics.getSnapshot, voiceFeedbackDiagnostics.getSnapshot);
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/dashboard" />;
  return <ScrollView contentContainerStyle={{ padding: 28, gap: 16, backgroundColor: COLORS.background, flexGrow: 1 }}>
    <Text style={{ fontSize: 20, color: COLORS.text }}>Voice feedback check · revision 3</Text>
    <Text>State and timing only. No audio, transcripts, meals, account details or credentials.</Text>
    <Pressable accessibilityRole="button" onPress={async () => {
      setFixtureResult("Checking…");
      try {
        const directory = `${RNFS.CachesDirectoryPath}/AV`;
        await RNFS.mkdir(directory);
        const path = `${directory}/calmera-duration-check.aiff`;
        await RNFS.writeFile(path, phoneTestVoiceAudio, "base64");
        const metadata = await voiceClipMetadata(`file://${path}`);
        setFixtureResult(`Synthetic file: ${Math.round(metadata.durationMs)} ms · ${metadata.byteCount} bytes`);
      } catch { setFixtureResult("Synthetic file metadata unavailable"); }
    }} style={{ paddingVertical: 16 }}><Text>Check synthetic file duration (no microphone or inference)</Text></Pressable>
    <Text>{fixtureResult}</Text>
    {events.length === 0 && <Text>No recording attempted in this app session.</Text>}
    {events.map((event, index) => <Text key={index}>{event.code} · {event.elapsedMs} ms{event.durationMs === undefined ? "" : ` · clip ${event.durationMs} ms`}</Text>)}
  </ScrollView>;
}
