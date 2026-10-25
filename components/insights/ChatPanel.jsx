import { useEffect, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useAuth } from "@clerk/clerk-expo";
import GlassSurface from "@/components/GlassSurface";
import OpenAILogo from "@/components/OpenAILogo";
import { EFFORTS, STARTERS } from "@/lib/insights/harness.mjs";
import { useDictation } from "@/lib/insights/dictation";
import { getVoiceLanguage } from "@/lib/chatgpt/nutrition";

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

// Model picker, in the header like ChatGPT. Lists models on the user's own plan.
function ModelHeader({ prefs, savePrefs, loadModels, contextLabel }) {
  const [catalog, setCatalog] = useState({ models: [], current: null });
  useEffect(() => { loadModels?.().then(setCatalog).catch(() => {}); }, [loadModels, prefs?.chatModel]);
  const current = catalog.models.find((model) => model.slug === catalog.current);
  const pickModel = () => {
    if (!catalog.models.length) { Alert.alert("Connect ChatGPT", "Connect ChatGPT in Settings to choose a model."); return; }
    choose("Model", catalog.models.map((model) => model.display_name || model.slug),
      (index) => savePrefs({ chatModel: catalog.models[index].slug }));
  };
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose model" onPress={pickModel} style={styles.modelPill}>
      <GlassSurface />
      <OpenAILogo />
      <Text style={styles.modelText} numberOfLines={1}>{current?.display_name || current?.slug || "ChatGPT"}</Text>
      <Ionicons name="chevron-down" size={13} color={COLORS.textLight} />
    </Pressable>
    <Text style={styles.powered}>Powered by your own ChatGPT subscription</Text>
    {!!contextLabel && <Text style={styles.context}>{contextLabel}</Text>}
  </View>;
}

const Bars = ({ level }) => <View style={styles.bars}>
  {[0.5, 0.8, 1, 0.7, 0.45, 0.9, 0.6].map((weight, index) =>
    <View key={index} style={[styles.bar, { height: 4 + Math.round(18 * level * weight) }]} />)}
</View>;

// ChatGPT-style composer: text on top; + menu, tool chips, dictation and send below.
function Composer({ draft, setDraft, onSend, busy, prefs, savePrefs, dictation, bottomInset }) {
  const efforts = Object.keys(EFFORTS);
  const pickEffort = () => choose("Thinking", efforts.map((id) => `${EFFORTS[id]}${prefs.effort === id ? "  ✓" : ""}`),
    (index) => savePrefs({ effort: efforts[index] }));
  const openMenu = () => choose("Tools", [...efforts.map((id) => `${EFFORTS[id]} thinking${prefs.effort === id ? "  ✓" : ""}`),
    prefs.webSearch ? "Turn off web search" : "Turn on web search"], (index) => {
    if (index < efforts.length) savePrefs({ effort: efforts[index] });
    else savePrefs({ webSearch: !prefs.webSearch });
  });
  const canSend = Boolean(draft.trim()) && !busy;
  return <View style={[styles.composerWrap, { paddingBottom: bottomInset }]}>
    <View style={styles.composer}>
      <GlassSurface style={styles.composerGlass} />
      {dictation.recording ? <View style={styles.listening}>
        <Text style={[styles.input, !dictation.transcript && styles.listeningHint]} numberOfLines={4}>
          {dictation.transcript || "Listening…"}
        </Text>
        <View style={styles.composerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel dictation" onPress={dictation.cancel} style={styles.iconButton}>
            <Ionicons name="close" size={20} color={COLORS.text} />
          </Pressable>
          <Bars level={dictation.level} />
          <Pressable accessibilityRole="button" accessibilityLabel="Use dictation" onPress={dictation.finish} style={styles.sendButton}>
            <Ionicons name="checkmark" size={20} color={COLORS.white} />
          </Pressable>
        </View>
      </View> : <>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Ask anything" placeholderTextColor={COLORS.textLight}
          style={styles.input} multiline maxLength={1000} />
        <View style={styles.composerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Tools" onPress={openMenu} style={styles.iconButton}>
            <Ionicons name="add" size={22} color={COLORS.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Thinking level" onPress={pickEffort} style={styles.chip}>
            <Ionicons name="bulb-outline" size={14} color={COLORS.text} />
            <Text style={styles.chipText}>{EFFORTS[prefs.effort] || EFFORTS.medium}</Text>
          </Pressable>
          {prefs.webSearch && <Pressable accessibilityRole="button" accessibilityLabel="Turn off web search"
            onPress={() => savePrefs({ webSearch: false })} style={[styles.chip, styles.chipOn]}>
            <Ionicons name="globe-outline" size={14} color={COLORS.primary} />
            <Text style={[styles.chipText, styles.chipTextOn]}>Search</Text>
            <Ionicons name="close" size={12} color={COLORS.primary} />
          </Pressable>}
          <View style={styles.spacer} />
          {dictation.available && <Pressable accessibilityRole="button" accessibilityLabel="Dictate" onPress={dictation.start} style={styles.iconButton}>
            <Ionicons name="mic-outline" size={21} color={COLORS.text} />
          </Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!canSend} onPress={onSend}
            style={[styles.sendButton, !canSend && styles.sendDisabled]}>
            <Ionicons name="arrow-up" size={20} color={COLORS.white} />
          </Pressable>
        </View>
      </>}
    </View>
  </View>;
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
  const { userId } = useAuth();
  const [language, setLanguage] = useState("en-US");
  useEffect(() => { if (userId) getVoiceLanguage(userId).then((value) => value && setLanguage(value)).catch(() => {}); }, [userId]);
  const dictation = useDictation({ language, onDone: (text) => setDraft((current) => current ? `${current.trimEnd()} ${text}` : text) });

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
      {prefs ? <ModelHeader prefs={prefs} savePrefs={savePrefs} loadModels={loadModels} contextLabel={contextLabel} />
        : <Text style={styles.context}>{contextLabel}</Text>}
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
    <Composer draft={draft} setDraft={setDraft} onSend={() => send(draft)} busy={busy} dictation={dictation}
      prefs={prefs || { effort: "medium", webSearch: false }} savePrefs={savePrefs || (() => {})} bottomInset={bottomInset} />
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
  header: { alignItems: "center", gap: 6, marginBottom: 4 },
  modelPill: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 240, minHeight: 36, paddingHorizontal: 14, borderRadius: 18 },
  modelText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, flexShrink: 1 },
  powered: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  composerWrap: { paddingHorizontal: 12, paddingTop: 6 },
  composer: { borderRadius: 28, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, gap: 2 },
  composerGlass: { borderRadius: 28 },
  composerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 10, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: StyleSheet.hairlineWidth, borderColor: "#E8DFD6" },
  chipOn: { backgroundColor: "#FBEADF", borderColor: "#F2D3BF" },
  chipText: { ...TYPOGRAPHY.captionMedium, color: COLORS.text },
  chipTextOn: { color: COLORS.primary },
  spacer: { flex: 1 },
  sendButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.text },
  listening: { gap: 2 },
  listeningHint: { color: COLORS.textLight },
  bars: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 38 },
  bar: { width: 4, borderRadius: 2, backgroundColor: COLORS.text },
  bubbleText: { ...TYPOGRAPHY.body, color: COLORS.text },
  userText: { color: COLORS.white },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8 },
  thinkingText: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  previewNote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center", marginTop: 4 },
  input: { ...TYPOGRAPHY.input, minHeight: 40, maxHeight: 120, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, color: COLORS.text },
  sendDisabled: { opacity: 0.25 },
});
