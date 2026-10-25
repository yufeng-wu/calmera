import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn, ZoomOut } from "react-native-reanimated";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import GlassSurface from "@/components/GlassSurface";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { EFFORTS, STARTERS } from "@/lib/insights/harness.mjs";
import { useDictation } from "@/lib/insights/dictation";
import { getVoiceLanguage } from "@/lib/chatgpt/nutrition";
import { pickMealPhoto } from "@/lib/chatgpt/planClient";
import { GlassMenu, PressScale } from "./NativeControls";
import ChatSettingsSheet from "./ChatSettingsSheet";

const layout = LinearTransition.springify().damping(20).stiffness(200);

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

const Bars = ({ level }) => <View style={styles.bars}>
  {[0.5, 0.8, 1, 0.7, 0.45, 0.9, 0.6].map((weight, index) =>
    <View key={index} style={[styles.bar, { height: 4 + Math.round(18 * level * weight) }]} />)}
</View>;

// ChatGPT-style composer: text on top; + menu, dashboard, search, dictation and send below.
function Composer({ draft, setDraft, image, setImage, onSend, busy, prefs, savePrefs, dictation, onDashboard, bottomInset }) {
  const attach = async (source) => {
    try {
      const picked = await pickMealPhoto(source);
      if (picked?.dataURL) setImage(picked.dataURL);
    } catch (error) {
      if (!/cancel/i.test(error?.message || "")) {
        Alert.alert(source === "camera" ? "Camera unavailable" : "Photos unavailable",
          source === "camera" ? "This device can't open the camera." : "Couldn't open your photos.");
      }
    }
  };
  const menu = [
    { id: "camera", title: "Camera", symbol: "camera" },
    { id: "library", title: "Photos", symbol: "photo.on.rectangle" },
    { id: "search", title: "Web search", symbol: "globe", checked: prefs.webSearch },
  ];
  const onMenu = (id) => (id === "search" ? savePrefs({ webSearch: !prefs.webSearch }) : attach(id));
  const canSend = (Boolean(draft.trim()) || Boolean(image)) && !busy;
  return <View style={[styles.composerWrap, { paddingBottom: bottomInset }]}>
    <Animated.View layout={layout} style={styles.composer}>
      <GlassSurface style={styles.composerGlass} />
      {dictation.recording ? <Animated.View key="listening" entering={FadeIn.duration(160)} style={styles.listening}>
        <Text style={[styles.input, !dictation.transcript && styles.listeningHint]} numberOfLines={4}>
          {dictation.transcript || "Listening…"}
        </Text>
        <View style={styles.composerRow}>
          <PressScale accessibilityRole="button" accessibilityLabel="Cancel dictation" onPress={dictation.cancel} style={styles.iconButton}>
            <Ionicons name="close" size={20} color={COLORS.text} />
          </PressScale>
          <Bars level={dictation.level} />
          <PressScale accessibilityRole="button" accessibilityLabel="Use dictation" onPress={dictation.finish} style={styles.sendButton}>
            <Ionicons name="checkmark" size={20} color={COLORS.white} />
          </PressScale>
        </View>
      </Animated.View> : <Animated.View key="typing" entering={FadeIn.duration(160)}>
        {!!image && <Animated.View entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(140)} style={styles.attachment}>
          <Image source={{ uri: image }} style={styles.attachmentImage} contentFit="cover" />
          <PressScale accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setImage(null)} style={styles.attachmentRemove}>
            <Ionicons name="close" size={13} color={COLORS.white} />
          </PressScale>
        </Animated.View>}
        <TextInput value={draft} onChangeText={setDraft} placeholder={image ? "Ask about this photo" : "Ask anything"}
          placeholderTextColor={COLORS.textLight} style={styles.input} multiline maxLength={1000} />
        <View style={styles.composerRow}>
          <GlassMenu symbol="plus" icon="add" label="Add" items={menu} onSelect={onMenu} size={38} />
          <PressScale accessibilityRole="button" accessibilityLabel={`Model and thinking: ${EFFORTS[prefs.effort] || EFFORTS.medium}`}
            onPress={onDashboard} style={styles.chip}>
            <Ionicons name="speedometer-outline" size={16} color={COLORS.text} />
            <Text style={styles.chipText}>{EFFORTS[prefs.effort] || EFFORTS.medium}</Text>
          </PressScale>
          {prefs.webSearch && <Animated.View entering={ZoomIn.springify().damping(15)} exiting={ZoomOut.duration(120)}>
            <PressScale accessibilityRole="button" accessibilityLabel="Turn off web search"
              onPress={() => savePrefs({ webSearch: false })} style={[styles.chip, styles.chipOn]}>
              <Ionicons name="globe-outline" size={15} color={COLORS.primary} />
              <Text style={[styles.chipText, styles.chipTextOn]}>Search</Text>
            </PressScale>
          </Animated.View>}
          <View style={styles.spacer} />
          {dictation.available && <PressScale accessibilityRole="button" accessibilityLabel="Dictate" onPress={dictation.start} style={styles.iconButton}>
            <Ionicons name="mic-outline" size={21} color={COLORS.text} />
          </PressScale>}
          <PressScale accessibilityRole="button" accessibilityLabel="Send" disabled={!canSend} onPress={onSend}
            style={[styles.sendButton, !canSend && styles.sendDisabled]}>
            <Ionicons name="arrow-up" size={20} color={COLORS.white} />
          </PressScale>
        </View>
      </Animated.View>}
    </Animated.View>
  </View>;
}

// Conversation with the analyst. ask(messages) returns { text, preview, note }.
export default function ChatPanel({ ask, contextLabel, initialQuestion, bottomInset = 12, prefs, savePrefs, loadModels }) {
  const settings = prefs || { effort: "medium", webSearch: false };
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dashboard, setDashboard] = useState(false);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const asked = useRef(null);
  const { userId } = useAuth();
  const [language, setLanguage] = useState("en-US");
  useEffect(() => { if (userId) getVoiceLanguage(userId).then((value) => value && setLanguage(value)).catch(() => {}); }, [userId]);
  const dictation = useDictation({ language, onDone: (text) => setDraft((current) => current ? `${current.trimEnd()} ${text}` : text) });

  const send = async (text, photo = null) => {
    const question = text.trim();
    if ((!question && !photo) || busy) return;
    const next = [...messages, { role: "user", text: question || "What can you tell me about this?", images: photo ? [photo] : undefined }];
    setMessages(next); setDraft(""); setImage(null); setBusy(true);
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
      <View style={styles.header}>
        <Text style={styles.powered}>Powered by your own ChatGPT subscription{contextLabel ? ` · ${contextLabel}` : ""}</Text>
      </View>
      {!messages.length && <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={styles.empty}>
        <Text style={styles.emptyTitle}>Ask about your data</Text>
        <Text style={styles.emptyBody}>Answers use your logged meals and, if connected, Apple Health. Numbers are computed on your phone.</Text>
      </Animated.View>}
      {messages.map((message, index) => <Animated.View key={index} entering={FadeInDown.springify().damping(18)} layout={layout}
        style={message.role === "user" ? styles.userRow : styles.aiRow}>
        {message.images?.map((uri) => <Image key={uri.slice(-24)} source={{ uri }} style={styles.sentImage} contentFit="cover" />)}
        <View style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.aiBubble]}>
          {message.role === "user" ? <Text selectable style={[styles.bubbleText, styles.userText]}>{message.text}</Text>
            : <Rich text={message.text} style={styles.bubbleText} />}
        </View>
        {!!message.note && <Text style={styles.note}>{message.note}</Text>}
      </Animated.View>)}
      {busy && <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={[styles.bubble, styles.aiBubble, styles.thinking]}>
        <ActivityIndicator size="small" color={COLORS.textLight} />
        <Text style={styles.thinkingText}>{settings.webSearch ? "Thinking and searching…" : "Thinking…"}</Text>
      </Animated.View>}
      {preview && !busy && <Text style={styles.previewNote}>Preview reply. Connect ChatGPT in Settings for real answers.</Text>}
    </ScrollView>
    {!messages.length && !busy && <View style={styles.starters}>
      {STARTERS.map((question, index) => <Animated.View key={question} entering={FadeInDown.delay(70 * index).springify().damping(18)}
        exiting={FadeOut.duration(120)}>
        <PressScale onPress={() => send(question)} scaleTo={0.96} style={styles.starter}>
          <Text style={styles.starterText}>{question}</Text>
        </PressScale>
      </Animated.View>)}
    </View>}
    <Composer draft={draft} setDraft={setDraft} image={image} setImage={setImage} onSend={() => send(draft, image)} busy={busy}
      dictation={dictation} prefs={settings} savePrefs={savePrefs || (() => {})} onDashboard={() => setDashboard(true)} bottomInset={bottomInset} />
    {prefs && <ChatSettingsSheet visible={dashboard} onClose={() => setDashboard(false)} prefs={prefs} savePrefs={savePrefs} loadModels={loadModels} />}
  </View>;
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  thread: { padding: 20, paddingTop: 8, gap: 10 },
  header: { alignItems: "center", gap: 2, marginBottom: 4 },
  powered: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  context: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  empty: { gap: 8, marginTop: 16 },
  emptyTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  emptyBody: { ...TYPOGRAPHY.body, color: COLORS.textLight, marginBottom: 6 },
  // Suggestions sit right-aligned above the composer, sized to their text like sent bubbles.
  starters: { alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  starter: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: 6,
    backgroundColor: "#FFFFFF", borderWidth: StyleSheet.hairlineWidth, borderColor: "#E8DFD6" },
  starterText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  userRow: { alignItems: "flex-end", gap: 6 },
  aiRow: { alignItems: "flex-start", gap: 4 },
  sentImage: { width: 160, height: 160, borderRadius: 18 },
  bubble: { maxWidth: "88%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  userBubble: { backgroundColor: COLORS.text },
  aiBubble: { backgroundColor: "#FFFFFF" },
  bold: { fontWeight: "600" },
  italic: { fontStyle: "italic" },
  link: { color: COLORS.primary, textDecorationLine: "underline" },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textLight, marginLeft: 4 },
  bubbleText: { ...TYPOGRAPHY.body, color: COLORS.text },
  userText: { color: COLORS.white },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8 },
  thinkingText: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  previewNote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center", marginTop: 4 },
  composerWrap: { paddingHorizontal: 12, paddingTop: 6 },
  composer: { borderRadius: 28, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8 },
  composerGlass: { borderRadius: 28 },
  composerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 11, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: StyleSheet.hairlineWidth, borderColor: "#E8DFD6" },
  chipOn: { backgroundColor: "#FBEADF", borderColor: "#F2D3BF" },
  chipText: { ...TYPOGRAPHY.captionMedium, color: COLORS.text },
  chipTextOn: { color: COLORS.primary },
  spacer: { flex: 1 },
  sendButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.text },
  sendDisabled: { backgroundColor: "rgba(74,52,40,0.3)" },
  input: { ...TYPOGRAPHY.input, minHeight: 40, maxHeight: 120, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, color: COLORS.text },
  listening: { gap: 2 },
  listeningHint: { color: COLORS.textLight },
  bars: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 38 },
  bar: { width: 4, borderRadius: 2, backgroundColor: COLORS.text },
  attachment: { width: 64, height: 64, margin: 6, marginBottom: 0 },
  attachmentImage: { width: 64, height: 64, borderRadius: 14 },
  attachmentRemove: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.text, borderWidth: 2, borderColor: "#FFFFFF" },
});
