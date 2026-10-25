import { useEffect, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { EFFORTS, STARTERS } from "@/lib/insights/harness.mjs";

function choose(title, options, onPick) {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions({ title, options: [...options, "Cancel"], cancelButtonIndex: options.length },
      (index) => { if (index < options.length) onPick(index); });
  } else {
    Alert.alert(title, undefined, [...options.map((option, index) => ({ text: option, onPress: () => onPick(index) })), { text: "Cancel", style: "cancel" }]);
  }
}

// Just enough Markdown for answers: **bold**, *italic*, and [source](url) links.
// Link parentheses around a citation are dropped so it reads as "(source)".
function Rich({ text, style }) {
  const parts = [];
  const pattern = /\(?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\)?|\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
  let last = 0, match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = parts.length;
    if (match[1]) {
      const url = match[2].replace(/[?&]utm_source=openai$/, "");
      parts.push(<Text key={key} style={styles.link} onPress={() => Linking.openURL(url).catch(() => {})}>{` ${match[1]}`}</Text>);
    } else if (match[3]) parts.push(<Text key={key} style={styles.bold}>{match[3]}</Text>);
    else parts.push(<Text key={key} style={styles.italic}>{match[4]}</Text>);
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Text selectable style={style}>{parts}</Text>;
}

// Model, thinking level and web search for the next question. Saved per user.
function ChatControls({ prefs, savePrefs, loadModels }) {
  const [catalog, setCatalog] = useState({ models: [], current: null });
  useEffect(() => { loadModels?.().then(setCatalog).catch(() => {}); }, [loadModels]);
  const current = catalog.models.find((model) => model.slug === catalog.current);
  const pickModel = () => {
    if (!catalog.models.length) { Alert.alert("Connect ChatGPT", "Connect ChatGPT in Settings to choose a model."); return; }
    choose("Model", catalog.models.map((model) => model.display_name || model.slug),
      (index) => savePrefs({ chatModel: catalog.models[index].slug }));
  };
  const efforts = Object.keys(EFFORTS);
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.controlBar} contentContainerStyle={styles.controls}>
    <Pressable accessibilityRole="button" accessibilityLabel="Model" onPress={pickModel} style={styles.control}>
      <Text style={styles.controlText} numberOfLines={1}>{current?.display_name || current?.slug || "Model"}</Text>
      <Ionicons name="chevron-down" size={12} color={COLORS.textLight} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Thinking" style={styles.control}
      onPress={() => choose("Thinking", efforts.map((id) => EFFORTS[id]), (index) => savePrefs({ effort: efforts[index] }))}>
      <Ionicons name="bulb-outline" size={14} color={COLORS.text} />
      <Text style={styles.controlText}>Thinking: {EFFORTS[prefs.effort] || EFFORTS.medium}</Text>
      <Ionicons name="chevron-down" size={12} color={COLORS.textLight} />
    </Pressable>
    <Pressable accessibilityRole="switch" accessibilityLabel="Web search" accessibilityState={{ checked: prefs.webSearch }}
      onPress={() => savePrefs({ webSearch: !prefs.webSearch })} style={[styles.control, prefs.webSearch && styles.controlOn]}>
      <Ionicons name="globe-outline" size={14} color={prefs.webSearch ? COLORS.white : COLORS.text} />
      <Text style={[styles.controlText, prefs.webSearch && styles.controlTextOn]}>Search</Text>
    </Pressable>
  </ScrollView>;
}

// Conversation with the analyst. ask(messages) returns { text, preview, note }.
export default function ChatPanel({ ask, contextLabel, initialQuestion, bottomInset = 12, prefs, savePrefs, loadModels }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const asked = useRef(null);

  const send = async (text) => {
    const question = text.trim();
    if (!question || busy) return;
    const next = [...messages, { role: "user", text: question }];
    setMessages(next); setDraft(""); setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reply = await ask(next, { signal: controller.signal });
      setPreview(reply.preview);
      setMessages([...next, { role: "assistant", text: reply.text, note: reply.note }]);
    } catch {
      if (!controller.signal.aborted) setMessages([...next, { role: "assistant", text: "Couldn't reach ChatGPT just now. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialQuestion && asked.current !== initialQuestion) { asked.current = initialQuestion; send(initialQuestion); }
  }, [initialQuestion]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => abortRef.current?.abort(), []);

  return <View style={styles.panel}>
    <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} keyboardDismissMode="interactive"
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
      <Text style={styles.context}>{contextLabel}</Text>
      {!messages.length && <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Ask about your data</Text>
        <Text style={styles.emptyBody}>Answers use your logged meals and, if connected, Apple Health. Numbers are computed on your phone.</Text>
        {STARTERS.map((question) => <Pressable key={question} onPress={() => send(question)}
          style={({ pressed }) => [styles.starter, pressed && styles.pressed]}>
          <Text style={styles.starterText}>{question}</Text>
          <Ionicons name="arrow-up-outline" size={14} color={COLORS.textLight} style={styles.starterIcon} />
        </Pressable>)}
      </View>}
      {messages.map((message, index) => <View key={index} style={message.role === "user" ? styles.userRow : styles.aiRow}>
        <View style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.aiBubble]}>
          {message.role === "user" ? <Text selectable style={[styles.bubbleText, styles.userText]}>{message.text}</Text>
            : <Rich text={message.text} style={styles.bubbleText} />}
        </View>
        {!!message.note && <Text style={styles.note}>{message.note}</Text>}
      </View>)}
      {busy && <View style={[styles.bubble, styles.aiBubble, styles.thinking]}>
        <ActivityIndicator size="small" color={COLORS.textLight} />
        <Text style={styles.thinkingText}>{prefs?.webSearch ? "Thinking and searching…" : "Thinking…"}</Text>
      </View>}
      {preview && !busy && <Text style={styles.previewNote}>Preview reply. Connect ChatGPT in Settings for real answers.</Text>}
    </ScrollView>
    {prefs && <ChatControls prefs={prefs} savePrefs={savePrefs} loadModels={loadModels} />}
    <View style={[styles.composer, { paddingBottom: bottomInset }]}>
      <TextInput value={draft} onChangeText={setDraft} placeholder="Ask a question" placeholderTextColor={COLORS.textLight}
        style={styles.input} multiline maxLength={1000} />
      <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!draft.trim() || busy} onPress={() => send(draft)}
        style={[styles.send, (!draft.trim() || busy) && styles.sendDisabled]}>
        <Ionicons name="arrow-up" size={20} color={COLORS.white} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  thread: { padding: 20, paddingTop: 8, gap: 10 },
  context: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  empty: { gap: 8, marginTop: 16 },
  emptyTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  emptyBody: { ...TYPOGRAPHY.body, color: COLORS.textLight, marginBottom: 6 },
  starter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13,
    borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: StyleSheet.hairlineWidth, borderColor: "#E8DFD6" },
  starterText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, flex: 1 },
  starterIcon: { transform: [{ rotate: "45deg" }] },
  pressed: { opacity: 0.6 },
  userRow: { alignItems: "flex-end" },
  aiRow: { alignItems: "flex-start", gap: 4 },
  bubble: { maxWidth: "88%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  userBubble: { backgroundColor: COLORS.text },
  aiBubble: { backgroundColor: "#FFFFFF" },
  bold: { fontWeight: "600" },
  italic: { fontStyle: "italic" },
  link: { color: COLORS.primary, textDecorationLine: "underline" },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textLight, marginLeft: 4 },
  controlBar: { flexGrow: 0 },
  controls: { gap: 8, paddingHorizontal: 16, paddingTop: 8, alignItems: "center" },
  control: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 200, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: "#FFFFFF", borderWidth: StyleSheet.hairlineWidth, borderColor: "#E8DFD6" },
  controlOn: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  controlText: { ...TYPOGRAPHY.captionMedium, color: COLORS.text, flexShrink: 1 },
  controlTextOn: { color: COLORS.white },
  bubbleText: { ...TYPOGRAPHY.body, color: COLORS.text },
  userText: { color: COLORS.white },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8 },
  thinkingText: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  previewNote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center", marginTop: 4 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  input: { ...TYPOGRAPHY.input, flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    borderRadius: 22, backgroundColor: "#FFFFFF", color: COLORS.text, borderWidth: StyleSheet.hairlineWidth, borderColor: "#E8DFD6" },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  sendDisabled: { opacity: 0.35 },
});
