import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FormCard, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useInsights } from "@/hooks/useInsights";
import { FOCUS } from "@/lib/insights/digest.mjs";
import { STARTERS, VERDICTS } from "@/lib/insights/harness.mjs";

const COPY_PROMPT = "Here is a summary of my food log from the calmera app. Tell me briefly whether I'm eating well for my focus, and the one or two changes that would help most.";

export default function InsightsScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const { digest, sample, prefs, savePrefs, context, insight, personal, reportStatus } = useInsights();
  const verdict = VERDICTS[insight.verdict];
  const openChat = (question) => router.push({ pathname: "/insights-chat", params: question ? { q: question } : {} });
  const copyForAI = () => Share.share({ message: `${COPY_PROMPT}\n\n${context}` }).catch(() => {});
  const goal = (value, target, unit) => target ? `${value} / ${target} ${unit}` : `${value} ${unit}`;

  return <View style={formStyles.screen}>
    <View style={[styles.header, { minHeight: Math.max(64, 40 * fontScale + 20) }]}>
      <Text accessibilityRole="header" style={styles.title}>Insights</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {sample && <View style={styles.sampleBadge}>
        <Ionicons name="flask-outline" size={14} color={COLORS.primary} />
        <Text style={styles.sampleText}>Sample week. Log 3 days to see yours.</Text>
      </View>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.focusRow}>
        {Object.entries(FOCUS).map(([id, focus]) => {
          const selected = prefs.focus === id;
          return <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected }}
            onPress={() => savePrefs({ focus: id })} style={[styles.chip, selected && styles.chipSelected]}>
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{focus.emoji} {focus.label}</Text>
          </Pressable>;
        })}
      </ScrollView>

      <FormCard style={styles.verdictCard}>
        <View style={styles.verdictTop}>
          <View style={[styles.pill, { backgroundColor: verdict.tint }]}>
            <Text style={[styles.pillText, { color: verdict.ink }]}>{verdict.emoji}  {verdict.label}</Text>
          </View>
          <Text style={styles.range}>This week</Text>
        </View>
        <Text style={styles.headline}>{insight.headline}</Text>
        <Text style={styles.summary}>{insight.summary}</Text>
        <View style={styles.source}>
          {reportStatus === "loading" ? <><ActivityIndicator size="small" color={COLORS.textLight} />
            <Text style={styles.sourceText}>Getting your personal check-in…</Text></>
            : <Text style={styles.sourceText}>{personal ? "Personal check-in by your ChatGPT" : "Quick check. Connect ChatGPT for a personal one."}</Text>}
        </View>
      </FormCard>

      {insight.tips.map((tip, index) => <FormCard key={tip.title} style={styles.tipCard}>
        <View style={styles.tipRow}>
          <Text style={styles.tipNumber}>{index + 1}</Text>
          <View style={styles.tipCopy}>
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <Text style={styles.tipWhy}>{tip.why}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => openChat(`Tell me more: ${tip.title}`)}
          style={({ pressed }) => [styles.askMore, pressed && styles.pressed]}>
          <Text style={styles.askMoreText}>Ask more</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
        </Pressable>
      </FormCard>)}

      <Text style={styles.section}>AT A GLANCE</Text>
      <View style={styles.stats}>
        {[
          ["🔥", "Calories", goal(digest.average.calories, digest.goals.calories, "kcal")],
          ["🍗", "Protein", goal(digest.average.protein, digest.goals.protein, "g")],
          ["🥦", "Veggies", `${digest.groups.veg} this week`],
          ["🍳", "Breakfast", `${digest.breakfastDays} of ${digest.daysLogged} days`],
        ].map(([emoji, label, value]) => <View key={label} style={styles.stat}>
          <Text style={styles.statLabel}>{emoji} {label}</Text>
          <Text style={styles.statValue}>{value}</Text>
        </View>)}
      </View>

      <Text style={styles.section}>ASK ANYTHING</Text>
      <Pressable accessibilityRole="button" onPress={() => openChat()} style={({ pressed }) => [styles.askBox, pressed && styles.pressed]}>
        <Ionicons name="sparkles" size={18} color={COLORS.primary} />
        <Text style={styles.askPlaceholder}>Ask about your eating…</Text>
      </Pressable>
      <View style={styles.starters}>
        {STARTERS.slice(0, 3).map((question) => <Pressable key={question} onPress={() => openChat(question)}
          style={({ pressed }) => [styles.starter, pressed && styles.pressed]}>
          <Text style={styles.starterText}>{question}</Text>
        </Pressable>)}
      </View>

      <FormCard variant="grouped" style={styles.group}>
        <SettingsRow title="Copy for AI" subtitle="Share your week with any chatbot" icon="copy-outline" onPress={copyForAI} />
        <SettingsRow title="Customize your analyst" subtitle="Tone, focus and your own instructions" icon="options-outline" divider
          onPress={() => router.push("/insights-harness")} />
      </FormCard>
      <Text style={styles.footnote}>Estimates from your logs, not medical advice.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, justifyContent: "center", alignItems: "center" },
  title: { ...TYPOGRAPHY.pageTitle, color: COLORS.text },
  content: { padding: 20, paddingTop: 8, paddingBottom: 150, gap: 12 },
  sampleBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: "#FBEADF" },
  sampleText: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  focusRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#E8DFD6" },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { ...TYPOGRAPHY.captionMedium, color: COLORS.text },
  chipTextSelected: { color: COLORS.white },
  verdictCard: { gap: 10 },
  verdictTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { ...TYPOGRAPHY.captionMedium },
  range: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  headline: { fontSize: 22, fontWeight: "700", lineHeight: 28, letterSpacing: -0.3, color: COLORS.text },
  summary: { ...TYPOGRAPHY.body, color: COLORS.text },
  source: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  sourceText: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  tipCard: { gap: 10, paddingVertical: 16 },
  tipRow: { flexDirection: "row", gap: 12 },
  tipNumber: { width: 26, height: 26, borderRadius: 13, overflow: "hidden", textAlign: "center", lineHeight: 26,
    backgroundColor: "#FBEADF", color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  tipCopy: { flex: 1, gap: 3 },
  tipTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  tipWhy: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  askMore: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10 },
  askMoreText: { ...TYPOGRAPHY.button, color: COLORS.primary },
  pressed: { opacity: 0.6 },
  section: { ...TYPOGRAPHY.eyebrow, color: COLORS.textLight, marginTop: 8, marginLeft: 4 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexBasis: "47%", flexGrow: 1, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, gap: 4 },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  statValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
  askBox: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 16,
    borderRadius: 26, backgroundColor: "#FFFFFF", borderWidth: StyleSheet.hairlineWidth, borderColor: "#E8DFD6" },
  askPlaceholder: { ...TYPOGRAPHY.input, color: COLORS.textLight },
  starters: { gap: 8 },
  starter: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: "#FBEADF" },
  starterText: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  group: { padding: 0, gap: 0, overflow: "hidden", marginTop: 8 },
  footnote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
});
