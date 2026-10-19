import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import RNFS from "react-native-fs";
import { COLORS } from "@/constants/colors";
import { FOOD_ENTRIES_API_URL } from "@/constants/api";
import { nutritionClient, transcribeMealAudio } from "@/lib/chatgpt/nutrition";
import { saveEstimatedEntries } from "@/lib/chatgpt/entryPersistence.mjs";
import { safeDiagnosticCode } from "@/lib/chatgpt/diagnostics.mjs";
import { phoneTestVoiceAudio } from "@/lib/chatgpt/phoneTestVoice.mjs";
import { getLocalTimeWithOffset } from "@/lib/utils";

export default function VoiceTestRoute() {
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/dashboard" />;
  return <SyntheticVoiceTest />;
}

function SyntheticVoiceTest() {
  const { userId, getToken } = useAuth();
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [transcript, setTranscript] = useState("");
  const [saved, setSaved] = useState([]);

  async function run() {
    if (started) return;
    setStarted(true);
    setBusy(true);
    try {
      // Fixed generated file in this app's cache; never open microphone input.
      const path = `${RNFS.CachesDirectoryPath}/calmera-synthetic-banana.aiff`;
      await RNFS.writeFile(path, phoneTestVoiceAudio, "base64");
      setStatus("Transcribing the synthetic audio on this iPhone…");
      const text = await transcribeMealAudio(`file://${path}`, "en-US");
      setTranscript(text);
      setStatus("Analyzing with your ChatGPT plan…");
      const { client, model } = await nutritionClient(userId);
      const entries = (await client.estimate({ text, model })).map(entry => ({
        ...entry, foodName: `${entry.foodName} - CALMERA PHONE VOICE TEST 2026-10-18`,
      }));
      setStatus("Saving only the synthetic food entries…");
      const rows = await saveEstimatedEntries(entries, {
        createdAt: getLocalTimeWithOffset(), getToken, url: FOOD_ENTRIES_API_URL,
      });
      setSaved(rows);
      setStatus("Completed and saved");
    } catch (error) {
      setStatus(`Failed: ${safeDiagnosticCode(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Synthetic voice test</Text>
    <Text style={styles.note}>Separate test build only. Reads one generated audio file, transcribes on device, then uses your ChatGPT plan and the existing meal-save API. No microphone recording or personal audio is read.</Text>
    <TouchableOpacity style={[styles.button, started && { opacity: 0.5 }]} onPress={run} disabled={started}>
      {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Run synthetic voice test</Text>}
    </TouchableOpacity>
    <Text style={styles.status}>{status}</Text>
    {!!transcript && <Text style={styles.note}>Synthetic transcript: {transcript}</Text>}
    {saved.map(row => <Text key={row.id} style={styles.note}>{row.foodName} · {row.quantity} · {row.calories} kcal</Text>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: COLORS.background, gap: 20 },
  title: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  note: { fontSize: 15, lineHeight: 23, color: COLORS.textLight },
  status: { fontSize: 18, fontWeight: "600", color: COLORS.text },
  button: { borderRadius: 18, padding: 18, alignItems: "center", backgroundColor: COLORS.primary },
  buttonText: { fontSize: 16, fontWeight: "600", color: COLORS.white },
});
