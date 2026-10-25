import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FormHeader, formStyles } from "@/components/GlassForm";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useInsights } from "@/hooks/useInsights";
import { STARTERS } from "@/lib/insights/harness.mjs";

export default function InsightsChat() {
  const router = useRouter();
  const { q } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { ask, digest, sample } = useInsights({ report: false });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const asked = useRef(false);

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
      if (!controller.signal.aborted) setMessages([...next, { role: "assistant", text: "I couldn't reach ChatGPT just now. Try again in a moment.", failed: true }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (typeof q === "string" && q && !asked.current) { asked.current = true; send(q); }
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => abortRef.current?.abort(), []);

  return <KeyboardAvoidingView style={formStyles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <FormHeader title="Ask calmera" onBack={() => router.back()} />
    <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} keyboardDismissMode="interactive"
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
      <View style={styles.contextChip}>
        <Ionicons name="eye-outline" size={13} color={COLORS.textLight} />
        <Text style={styles.contextText}>
          Using {sample ? "a sample week" : `your last 7 days · ${digest.daysLogged} days logged`}
        </Text>
      </View>
      {!messages.length && <View style={styles.empty}>
        <Text style={styles.emptyTitle}>What do you want to know?</Text>
        {STARTERS.map((question) => <Pressable key={question} onPress={() => send(question)}
          style={({ pressed }) => [styles.starter, pressed && styles.pressed]}>
          <Text style={styles.starterText}>{question}</Text>
        </Pressable>)}
      </View>}
      {messages.map((message, index) => <View key={index}
        style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.bubbleText, message.role === "user" && styles.userText]}>{message.text}</Text>
      </View>)}
      {busy && <View style={[styles.bubble, styles.aiBubble, styles.thinking]}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.thinkingText}>Looking at your week…</Text>
      </View>}
      {preview && !busy && <Text style={styles.previewNote}>Preview reply. Connect ChatGPT in Settings for real answers.</Text>}
    </ScrollView>
    <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <TextInput value={draft} onChangeText={setDraft} placeholder="Ask about your eating…" placeholderTextColor={COLORS.textLight}
        style={styles.input} multiline maxLength={1000} onSubmitEditing={() => send(draft)} />
      <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!draft.trim() || busy} onPress={() => send(draft)}
        style={[styles.send, (!draft.trim() || busy) && styles.sendDisabled]}>
        <Ionicons name="arrow-up" size={20} color={COLORS.white} />
      </Pressable>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  thread: { padding: 20, paddingTop: 4, gap: 10 },
  contextChip: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "center", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, backgroundColor: "#F4ECE5" },
  contextText: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  empty: { gap: 8, marginTop: 24 },
  emptyTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text, marginBottom: 4 },
  starter: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: "#FBEADF" },
  starterText: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  pressed: { opacity: 0.6 },
  bubble: { maxWidth: "86%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  userBubble: { alignSelf: "flex-end", backgroundColor: COLORS.primary, borderBottomRightRadius: 6 },
  aiBubble: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderBottomLeftRadius: 6 },
  bubbleText: { ...TYPOGRAPHY.body, color: COLORS.text },
  userText: { color: COLORS.white },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8 },
  thinkingText: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  previewNote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center", marginTop: 4 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  input: { ...TYPOGRAPHY.input, flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    borderRadius: 22, backgroundColor: "#FFFFFF", color: COLORS.text, borderWidth: StyleSheet.hairlineWidth, borderColor: "#E8DFD6" },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  sendDisabled: { opacity: 0.4 },
});
