import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { STARTERS } from "@/lib/insights/harness.mjs";

// Conversation with the analyst. ask(messages) returns { text, preview }.
export default function ChatPanel({ ask, contextLabel, initialQuestion, bottomInset = 12 }) {
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
      setMessages([...next, { role: "assistant", text: reply.text }]);
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
      {messages.map((message, index) => <View key={index}
        style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.bubbleText, message.role === "user" && styles.userText]}>{message.text}</Text>
      </View>)}
      {busy && <View style={[styles.bubble, styles.aiBubble, styles.thinking]}>
        <ActivityIndicator size="small" color={COLORS.textLight} />
        <Text style={styles.thinkingText}>Reading your data…</Text>
      </View>}
      {preview && !busy && <Text style={styles.previewNote}>Preview reply. Connect ChatGPT in Settings for real answers.</Text>}
    </ScrollView>
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
  bubble: { maxWidth: "88%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  userBubble: { alignSelf: "flex-end", backgroundColor: COLORS.text },
  aiBubble: { alignSelf: "flex-start", backgroundColor: "#FFFFFF" },
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
