import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { FormCard, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import MetricRow from "@/components/insights/MetricRow";
import ChatPanel from "@/components/insights/ChatPanel";
import { SURFACES } from "@/constants/surfaces";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useInsights } from "@/hooks/useInsights";
import { FOCUS } from "@/lib/insights/digest.mjs";
import { VERDICTS } from "@/lib/insights/harness.mjs";
import { average, change, count, formatClock, formatNumber, latest } from "@/lib/insights/series.mjs";

const SEGMENTS = [["week", "7 days"], ["month", "30 days"], ["chat", "Chat"]];
const COPY_PROMPT = "Here is a summary of my food log (and Apple Health data) from the calmera app. Tell me briefly whether I'm eating well for my focus, and the one or two changes that would help most.";
const shortDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function InsightsScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const [segment, setSegment] = useState("week");
  const data = useInsights();
  const ask = (question) => router.push({ pathname: "/insights-chat", params: { q: question } });
  const copyForAI = () => Share.share({ message: `${COPY_PROMPT}\n\n${data.context}` }).catch(() => {});

  return <View style={formStyles.screen}>
    <View style={[styles.header, { minHeight: Math.max(64, 40 * fontScale + 20) }]}>
      <Text accessibilityRole="header" style={styles.title}>Insights</Text>
    </View>
    <View style={styles.segments} accessibilityRole="tablist">
      {SEGMENTS.map(([id, label]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: segment === id }}
        onPress={() => setSegment(id)} style={[styles.segment, segment === id && styles.segmentSelected]}>
        <Text style={[styles.segmentText, segment === id && styles.segmentTextSelected]}>{label}</Text>
      </Pressable>)}
    </View>

    {segment !== "chat" && <ScrollView key={segment} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 32 }]}
      showsVerticalScrollIndicator={false}>
      {data.sample && <Text style={styles.sample}>Showing sample data until you have 3 logged days this week.</Text>}
      {segment === "week" ? <WeeklyReport data={data} onChangeFocus={() => router.push("/insights-harness")} />
        : <Text style={styles.compareNote}>Last 30 days, compared with the 30 days before.</Text>}
      <NutritionCard period={segment === "week" ? data.week : data.month} goals={data.goals} ask={ask} />
      <MealTimingCard period={segment === "week" ? data.week : data.month} ask={ask} />
      <ActivityCard period={segment === "week" ? data.week : data.month} health={data.health} ask={ask} />
      {segment === "month" && <FoodsCard foods={data.month.digest.topFoods} />}
      <FormCard variant="grouped" style={styles.group}>
        <SettingsRow title="Copy for AI" subtitle="Share this summary with any chatbot" icon="copy-outline" onPress={copyForAI} />
        <SettingsRow title="Customize your analyst" subtitle="Focus, tone and your own instructions" icon="options-outline" divider
          onPress={() => router.push("/insights-harness")} />
      </FormCard>
      <Text style={styles.footnote}>Food values are estimates from your logs. Not medical advice.</Text>
    </ScrollView>}

    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}
      style={[styles.chat, segment !== "chat" && styles.hidden]}>
      <ChatPanel ask={data.ask} bottomInset={tabBarHeight + 8}
        contextLabel={data.sample ? "Using sample data" : "Using your last 30 days"} />
    </KeyboardAvoidingView>
  </View>;
}

function WeeklyReport({ data, onChangeFocus }) {
  const { insight, report, reportStatus, refreshReport, prefs } = data;
  const verdict = VERDICTS[insight.verdict];
  const loading = reportStatus === "loading";
  return <FormCard style={styles.report}>
    <View style={styles.reportTop}>
      <Text style={styles.eyebrow}>WEEKLY REPORT</Text>
      <Text style={styles.reportDate}>Week of {shortDate(report.week)}</Text>
    </View>
    <View style={styles.status}>
      <View style={[styles.dot, { backgroundColor: verdict.color }]} />
      <Text style={[styles.statusText, { color: verdict.color }]}>{verdict.label}</Text>
    </View>
    <Text style={styles.headline}>{insight.headline}</Text>
    {!!insight.summary && <Text style={styles.summary}>{insight.summary}</Text>}
    {insight.tips.map((tip, index) => <View key={tip.title} style={styles.finding}>
      <Text style={styles.findingNumber}>{index + 1}</Text>
      <View style={styles.findingCopy}>
        <Text style={styles.findingTitle}>{tip.title}</Text>
        <Text style={styles.findingWhy}>{tip.why}</Text>
      </View>
    </View>)}
    <View style={styles.reportFooter}>
      <Pressable onPress={onChangeFocus} hitSlop={8}>
        <Text style={styles.footerText}>Focus: <Text style={styles.footerLink}>{FOCUS[prefs.focus]?.label}</Text></Text>
      </Pressable>
      {loading ? <ActivityIndicator size="small" color={COLORS.textLight} />
        : report.personal && <Pressable accessibilityLabel="Regenerate report" onPress={refreshReport} hitSlop={8}>
          <Ionicons name="refresh" size={16} color={COLORS.textLight} />
        </Pressable>}
    </View>
    <Text style={styles.source}>
      {loading ? "Writing this week's report…"
        : report.personal ? `Written by your ChatGPT on ${new Date(report.createdAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`
          : "Rules-based summary. Connect ChatGPT in Settings for a written report."}
    </Text>
  </FormCard>;
}

// "+12% vs last week"; a change that rounds to zero reads "same as".
function deltaText(delta, span) {
  if (delta == null) return null;
  const label = span === 7 ? "last week" : "previous 30 days";
  const percent = Math.round(delta * 100);
  return percent === 0 ? `same as ${label}` : `${percent > 0 ? "+" : "−"}${Math.abs(percent)}% vs ${label}`;
}

// Shared copy for a row's comparison line.
function compareText(span, current, previous, goal, unit) {
  if (span === 7 && goal && current != null) return `Daily average · ${Math.round((current / goal) * 100)}% of ${formatNumber(goal)} ${unit} goal`;
  return ["Daily average", deltaText(change(current, previous), span)].filter(Boolean).join(" · ");
}

function NutritionCard({ period, goals, ask }) {
  const { span, nutrition: now, previousNutrition: before } = period;
  const rows = [
    ["Calories", "kcal", now.calories, before.calories, goals.calorieGoal],
    ["Protein", "g", now.protein, before.protein, goals.proteinGoal],
    ["Carbs", "g", now.carbs, before.carbs, goals.carbsGoal],
    ["Fat", "g", now.fat, before.fat, goals.fatGoal],
  ];
  const question = (title) => `How has my ${title.toLowerCase()} looked over the past ${span} days, and what should I change?`;
  return <SectionCard title="Nutrition">
    {rows.map(([title, unit, values, previous, goal], index) => <MetricRow key={title} title={title} unit={unit} divider={index > 0}
      value={formatNumber(average(values))} values={values} goal={goal}
      detail={compareText(span, average(values), average(previous), goal, unit)} onPress={() => ask(question(title))} />)}
    <MetricRow title="Days logged" value={`${count(now.logged)} of ${span}`} unit="" values={now.logged} divider
      detail={span === 7 ? "Logging most days keeps the averages honest" : `${count(before.logged)} of ${span} the period before`}
      onPress={() => ask(`How consistent was my logging over the past ${span} days?`)} />
  </SectionCard>;
}

function MealTimingCard({ period, ask }) {
  const { span, nutrition: now, previousNutrition: before } = period;
  const totalCalories = now.calories.reduce((total, value) => total + (value || 0), 0);
  const snackShare = totalCalories ? now.snackCalories.reduce((total, value) => total + (value || 0), 0) / totalCalories : null;
  const snackDelta = change(average(now.snackCalories), average(before.snackCalories));
  return <SectionCard title="Meal timing">
    {[["Breakfast", now.breakfast], ["Lunch", now.lunch], ["Dinner", now.dinner]].map(([title, values], index) =>
      <MetricRow key={title} title={title} value={formatClock(average(values))} unit="" values={values} type="line" divider={index > 0}
        detail={`Average time · logged on ${count(values)} of ${span} days`}
        onPress={() => ask(`Is my ${title.toLowerCase()} timing over the past ${span} days working for my focus?`)} />)}
    <MetricRow title="Snacks" value={formatNumber(average(now.snackCalories))} unit="kcal" values={now.snackCalories} divider
      detail={[`Per day · ${formatNumber(average(now.snackCount), 1)} snacks`,
        snackShare != null && `${Math.round(snackShare * 100)}% of calories`,
        deltaText(snackDelta, span),
      ].filter(Boolean).join(" · ")}
      onPress={() => ask(`What do my snacks over the past ${span} days say, and what would be a better swap?`)} />
  </SectionCard>;
}

const total = (values) => values.reduce((sum, value) => sum + (value || 0), 0);
// Workouts are occasional, so show the period's total and session count, not a daily average.
function workoutText(span, values, previous) {
  const sessions = count(values);
  return [`Total · ${sessions} workout${sessions === 1 ? "" : "s"}`, deltaText(change(total(values), total(previous)), span)]
    .filter(Boolean).join(" · ");
}

function ActivityCard({ period, health, ask }) {
  const { span, activity: now, previousActivity: before } = period;
  if (health.status === "unavailable") return null;
  if (health.status !== "ready") {
    return <SectionCard title="Activity" badge="Apple Health">
      <View style={styles.connect}>
        <Text style={styles.connectText}>Add steps, workouts, sleep and weight so your report accounts for how active you are. Read-only, and it stays on this phone unless you ask ChatGPT.</Text>
        {health.status === "checking" ? <ActivityIndicator color={COLORS.primary} />
          : <Pressable accessibilityRole="button" onPress={health.connect} style={({ pressed }) => [styles.connectButton, pressed && { opacity: 0.7 }]}>
            <Text style={styles.connectButtonText}>{health.status === "error" ? "Try again" : "Connect Apple Health"}</Text>
          </Pressable>}
      </View>
    </SectionCard>;
  }
  const weights = now.weight.filter((value) => value != null);
  const weightChange = weights.length > 1 ? weights[weights.length - 1] - weights[0] : null;
  const rows = [
    ["Active energy", "kcal", now.activeEnergy, before.activeEnergy, "bar", 0],
    ["Steps", "", now.steps, before.steps, "bar", 0],
    ["Sleep", "h", now.sleepHours, before.sleepHours, "line", 1],
  ];
  return <SectionCard title="Activity" badge="Apple Health">
    {rows.map(([title, unit, values, previous, type, digits], index) => <MetricRow key={title} title={title} unit={unit} type={type}
      divider={index > 0} value={formatNumber(average(values), digits)} values={values}
      detail={compareText(span, average(values), average(previous), null, unit)}
      onPress={() => ask(`How does my ${title.toLowerCase()} over the past ${span} days relate to what I eat?`)} />)}
    <MetricRow title="Workouts" unit="min" divider value={formatNumber(total(now.exerciseMinutes))} values={now.exerciseMinutes}
      detail={workoutText(span, now.exerciseMinutes, before.exerciseMinutes)}
      onPress={() => ask(`How do my workouts over the past ${span} days fit with what I eat?`)} />
    {weights.length > 0 && <MetricRow title="Weight" unit="kg" type="line" divider value={formatNumber(latest(now.weight), 1)} values={now.weight}
      detail={weightChange == null ? "Latest" : `Latest · ${weightChange >= 0 ? "+" : "−"}${Math.abs(weightChange).toFixed(1)} kg over ${span} days`}
      onPress={() => ask(`Is my weight trend over the past ${span} days consistent with my focus?`)} />}
  </SectionCard>;
}

function FoodsCard({ foods }) {
  if (!foods.length) return null;
  return <SectionCard title="Biggest calorie sources">
    {foods.map((food, index) => <View key={food.name} style={[styles.food, index > 0 && styles.divider]}>
      <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
      <Text style={styles.foodMeta}>{food.count}×</Text>
      <Text style={styles.foodValue}>{formatNumber(food.calories)} kcal</Text>
    </View>)}
  </SectionCard>;
}

function SectionCard({ title, badge, children }) {
  return <FormCard style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!badge && <Text style={styles.badge}>{badge}</Text>}
    </View>
    {children}
  </FormCard>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, justifyContent: "center", alignItems: "center" },
  title: { ...TYPOGRAPHY.pageTitle, color: COLORS.text },
  segments: { flexDirection: "row", gap: 4, marginHorizontal: 20, marginBottom: 6 },
  segment: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  segmentSelected: { backgroundColor: "#EFE7E0" },
  segmentText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textLight },
  segmentTextSelected: { color: COLORS.text, fontWeight: "600" },
  content: { padding: 20, paddingTop: 8, gap: 14 },
  sample: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  compareNote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, marginLeft: 4 },
  report: { gap: 10 },
  reportTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { ...TYPOGRAPHY.eyebrow, color: COLORS.textLight },
  reportDate: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  status: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...TYPOGRAPHY.captionMedium },
  headline: { fontSize: 21, fontWeight: "700", lineHeight: 27, letterSpacing: -0.3, color: COLORS.text },
  summary: { ...TYPOGRAPHY.body, color: COLORS.text },
  finding: { flexDirection: "row", gap: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.separator },
  findingNumber: { ...TYPOGRAPHY.captionMedium, width: 22, height: 22, lineHeight: 22, borderRadius: 11, overflow: "hidden", textAlign: "center",
    color: COLORS.text, backgroundColor: "#EFE7E0" },
  findingCopy: { flex: 1, gap: 2 },
  findingTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  findingWhy: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  reportFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  footerText: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  footerLink: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  source: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  section: { padding: 0, gap: 0, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  sectionTitle: { fontSize: 20, fontWeight: "700", lineHeight: 26, color: COLORS.text },
  badge: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.separator },
  connect: { padding: 18, paddingTop: 8, gap: 14 },
  connectText: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  connectButton: { alignSelf: "flex-start", paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22, backgroundColor: COLORS.text },
  connectButtonText: { ...TYPOGRAPHY.button, color: COLORS.white },
  food: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingVertical: 14 },
  foodName: { ...TYPOGRAPHY.body, color: COLORS.text, flex: 1 },
  foodMeta: { ...TYPOGRAPHY.caption, color: COLORS.textLight, fontVariant: ["tabular-nums"] },
  foodValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"], minWidth: 76, textAlign: "right" },
  group: { padding: 0, gap: 0, overflow: "hidden" },
  footnote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  chat: { flex: 1 },
  hidden: { display: "none" },
});
