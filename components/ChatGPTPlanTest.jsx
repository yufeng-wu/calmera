import { useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { styles as createStyles } from "@/assets/styles/create.styles";
import { cancelPendingAuthorization, checkDevelopmentCallback, createPlanClient, isChatGPTAvailable, pickMealPhoto } from "@/lib/chatgpt/planClient";
import { friendlyError } from "@/lib/chatgpt/protocol.mjs";

// Isolated inference probe: no Clerk session, backend import or meal-save action.
// The regular app exposes it only through its development route. The dedicated
// phone-test entry bundles it separately, without changing the main app's login.
export default function ChatGPTPlanTest({ onBack, standalone = false }) {
  const client = useMemo(() => createPlanClient(standalone ? "calmera_phone_probe" : "calmera_development_probe"), [standalone]);
  const [connected, setConnected] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [model, setModel] = useState(null);
  const [text, setText] = useState("Synthetic test: one medium banana, 118 g edible portion.");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [callbackReady, setCallbackReady] = useState(false);
  const [authorizationURL, setAuthorizationURL] = useState("");

  useEffect(() => {
    let active = true;
    if (client) (async () => {
      const key = "calmera.development.storage-check";
      await SecureStore.setItemAsync(key, "synthetic-only", { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      if (await SecureStore.getItemAsync(key) !== "synthetic-only") throw new Error("secure_storage_check_failed");
      if (active) setStorageReady(true);
      return client.connected();
    })().then(async value => {
      if (!active) return;
      setConnected(value);
      if (value) {
        const choices = await client.models();
        if (active) setModel(choices[0] || null);
      }
    }).catch(() => { if (active) setError("Secure storage or connection could not be initialized. Rebuild the signed development app before testing."); });
    return () => { active = false; };
  }, [client]);

  async function connect(useMacBrowser = false) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await client.connect(useMacBrowser ? { onAuthorizationURL: setAuthorizationURL } : {});
      const models = await client.models();
      setConnected(true); setModel(models[0] || null);
      if (!models.length) setError("No eligible models are available on this ChatGPT account.");
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); setAuthorizationURL(""); }
  }

  async function checkCallback() {
    if (busy) return;
    setBusy(true); setError(""); setCallbackReady(false);
    try { await checkDevelopmentCallback(); setCallbackReady(true); }
    catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function choosePhoto() {
    try { const image = await pickMealPhoto("library"); if (image) { setPhoto(image); setResult(null); } }
    catch (err) { setError(friendlyError(err)); }
  }

  async function run(mode) {
    if (!model || busy) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const entries = await client.estimate({ model: model.slug,
        text: mode === "photo" ? "" : text, image: mode === "photo" ? photo?.dataURL : undefined });
      setResult(entries);
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  function disconnect() {
    Alert.alert("Remove this test connection?", "Only the development probe's credentials are removed. Regular foodwrap connections and food data are untouched.", [
      { text: "Cancel", style: "cancel" }, { text: "Disconnect", onPress: async () => {
        await client.disconnect(); setConnected(false); setModel(null); setResult(null);
      } },
    ]);
  }

  return <View style={createStyles.container}>
    <View style={createStyles.header}>
      {onBack ? <TouchableOpacity onPress={onBack} disabled={busy} accessibilityLabel="Back"><Ionicons name="arrow-back" size={24} color={COLORS.text} /></TouchableOpacity> : <View style={{ width: 24 }} />}
      <Text style={createStyles.headerTitle}>{standalone ? "foodwrap. · ChatGPT test" : "Test ChatGPT · Development"}</Text><View style={{ width: 24 }} />
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={createStyles.card}>
        <Text style={styles.note}>Inference test only. No foodwrap account or database is used. Nothing is saved as a meal.</Text>
        <Text style={styles.note}>Test descriptions and selected photos go directly to OpenAI under your own ChatGPT plan. Usage limits apply.</Text>
        <TouchableOpacity style={styles.button} onPress={() => connect()} disabled={busy || !storageReady || !isChatGPTAvailable()}><Text style={styles.buttonText}>{connected ? "Reconnect ChatGPT" : "Continue with ChatGPT"}</Text></TouchableOpacity>
        <Text style={styles.note}>{storageReady ? "Secure storage ready" : "Checking secure storage…"}</Text>
        {!standalone && __DEV__ && <TouchableOpacity onPress={() => connect(true)} disabled={busy || !storageReady}><Text style={styles.link}>Use Mac browser · simulator testing only</Text></TouchableOpacity>}
        {authorizationURL ? authorizationURL.match(/.{1,180}/g).map((part, index) => <Text key={index} selectable style={styles.note} accessibilityLabel={`Simulator URL part ${index + 1}: ${part}`}>{part}</Text>) : null}
        {busy && !connected ? <TouchableOpacity onPress={cancelPendingAuthorization}><Text style={styles.link}>Cancel pending authorization</Text></TouchableOpacity> : null}
        {!standalone && __DEV__ && <TouchableOpacity onPress={checkCallback} disabled={busy || !storageReady}><Text style={styles.link}>Check iPhone callback · synthetic only</Text></TouchableOpacity>}
        {callbackReady && <Text style={styles.note}>Browser callback passed · no account used</Text>}
        {connected && <><Text style={styles.note}>Connected · {model?.display_name || model?.slug || "Loading models…"}</Text>
          <TouchableOpacity onPress={disconnect} disabled={busy}><Text style={styles.link}>Disconnect this test connection</Text></TouchableOpacity></>}
      </View>
      <View style={createStyles.card}>
        <TextInput style={styles.input} value={text} onChangeText={setText} editable={!busy} multiline maxLength={3000} accessibilityLabel="Synthetic test description" />
        <TouchableOpacity style={[styles.button, (!model || busy) && styles.disabled]} onPress={() => run("text")} disabled={!model || busy}><Text style={styles.buttonText}>Run text test</Text></TouchableOpacity>
      </View>
      <View style={createStyles.card}>
        {photo && <Image source={{ uri: photo.dataURL }} style={styles.photo} accessibilityLabel="Selected test meal image" />}
        <TouchableOpacity style={styles.photoButton} onPress={choosePhoto} disabled={busy}><Ionicons name="image-outline" size={22} color={COLORS.primary} /><Text style={styles.link}>Choose test photo</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.button, (!photo || !model || busy) && styles.disabled]} onPress={() => run("photo")} disabled={!photo || !model || busy}><Text style={styles.buttonText}>Run photo test</Text></TouchableOpacity>
      </View>
      {busy && <ActivityIndicator color={COLORS.primary} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result && <View style={createStyles.card}>
        <Text style={styles.note}>Completed · not saved · estimates only</Text>
        {!result.length && <Text style={styles.note}>No food identified.</Text>}
        {result.map((entry, index) => <View key={index} style={styles.result}>
          <Text style={styles.title}>{entry.foodName} · {entry.quantity}</Text>
          <Text style={styles.note}>{entry.calories} kcal · P {entry.protein} g · C {entry.carbs} g · F {entry.fat} g</Text>
        </View>)}
      </View>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 10 },
  note: { color: COLORS.textLight, fontSize: 13, lineHeight: 20, marginBottom: 10 },
  title: { color: COLORS.text, fontSize: 15, fontWeight: "600", marginBottom: 6 },
  input: { color: COLORS.text, fontSize: 15, minHeight: 72, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12 },
  button: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 16, alignItems: "center", marginVertical: 10 },
  buttonText: { color: COLORS.white, fontWeight: "600" },
  photoButton: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 12 },
  link: { color: COLORS.primary, fontSize: 14 },
  disabled: { opacity: 0.4 },
  photo: { width: "100%", height: 210, resizeMode: "contain", borderRadius: 12 },
  result: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 8 },
  error: { color: COLORS.expense, lineHeight: 20, padding: 10 },
});
