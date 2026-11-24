import { useCallback, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen, FormScrollView, FormHeader, formStyles } from "@/components/GlassForm";
import SettingsRow from "@/components/settings/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/settings/SettingsSection";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { AI_PAGE, SETTINGS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import usePageExit from "@/hooks/usePageExit";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { PRICES_CHECKED } from "@/lib/ai/prices.mjs";
import { PROVIDER_PAGES } from "@/lib/ai/loggingProblem.mjs";
import { formatCost, formatTokens, plural, summarizeUsage } from "@/lib/ai/usage.mjs";
import { connectionServices } from "@/lib/ai/connectionServices";
import { previewConnectionServices, sampleUsage } from "@/lib/ai/previewConnection.mjs";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BAR_AREA = 56;
const CHECKED = new Date(`${PRICES_CHECKED}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const LINKS = { anthropic: "Anthropic billing", openai: "OpenAI billing", chatgpt: "ChatGPT usage" };

// What calmera's AI requests used over the last 7 days, from the record kept on this iPhone:
// a week at a glance, then each company and, within it, each model. Costs are estimates from
// list prices; a ChatGPT sign-in is paid for by the plan, so it shows requests and tokens only.
export default function AIUsage({ calmeraPreview = false, calmeraPreviewState = "sample" }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/ai-connection");
  const { fontScale } = useWindowDimensions();
  const services = useMemo(() => (calmeraPreview
    ? previewConnectionServices("none", { usage: calmeraPreviewState === "empty" ? [] : sampleUsage() }) : connectionServices(LOCAL_OWNER)),
  [calmeraPreview, calmeraPreviewState]);
  const [summary, setSummary] = useState(null);
  const visit = useRef(0);
  useFocusEffect(useCallback(() => {
    const mine = ++visit.current;
    services.usageRows().catch(() => []).then(rows => { if (visit.current === mine) setSummary(summarizeUsage(rows)); });
    return () => { visit.current += 1; };
  }, [services]));

  const total = summary?.total;
  const priced = Boolean(total?.priced);
  const planOnly = total?.requests > 0 && total.plan === total.requests;
  return <FormScreen style={[formStyles.screen, styles.page]}>
    <FormHeader title="Usage" onBack={leave} />
    <FormScrollView key={`ai-usage-${fontScale}`} contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      <Text style={settingsStyles.lead}>AI requests from this iPhone over the last 7 days.</Text>
      {/* The record is on this iPhone and answers at once, so nothing stands in for it. */}
      {summary && <>
        <SettingsSection cardStyle={styles.card}>
          <View style={styles.week}>
            <View style={styles.headline} accessible accessibilityLabel={total.requests
              ? `${priced ? `About ${formatCost(total.cost)}, estimated. ` : ""}${plural(total.requests, "request")}, ${formatTokens(total.tokens)} tokens.`
              : "No AI requests in the last 7 days."}>
              <View style={styles.headlineMain}>
                <Text style={styles.hero}>{priced ? formatCost(total.cost) : total.requests ? plural(total.requests, "request") : "Nothing yet"}</Text>
                <Text style={styles.heroLabel}>{priced ? "estimated cost" : planOnly ? "included in your ChatGPT plan"
                  : total.requests ? "Cost estimate unavailable" : "Meals you log with AI show up here."}</Text>
              </View>
              {total.requests > 0 && <View style={styles.headlineSide}>
                {priced && <Text style={styles.sideValue}>{plural(total.requests, "request")}</Text>}
                {total.tokens > 0 && <Text style={styles.sideValue}>{formatTokens(total.tokens)} tokens</Text>}
                {total.searches > 0 && <Text style={styles.sideValue}>{plural(total.searches, "search", "searches")}</Text>}
              </View>}
            </View>
            {total.requests > 0 && <DayBars days={summary.days} />}
          </View>
        </SettingsSection>

        {summary.companies.map(company => <SettingsSection key={company.id} label={company.name} cardStyle={styles.card} footnote={companyNote(company)}>
          {company.models.map((model, index) => <SettingsRow key={model.id} title={model.name} divider={index > 0}
            subtitle={[plural(model.requests, "request"), model.input + model.output ? `${formatTokens(model.input + model.output)} tokens` : null,
              model.searches ? plural(model.searches, "search", "searches") : null].filter(Boolean).join(" · ")}
            value={company.id === "chatgpt" ? "Plan" : model.cost === null ? "No price" : formatCost(model.cost)} />)}
        </SettingsSection>)}

        {total.requests > 0 && <View style={styles.links}>
          {summary.companies.map(company => <Pressable key={company.id} accessibilityRole="link" hitSlop={8}
            onPress={() => { if (!calmeraPreview) Linking.openURL(PROVIDER_PAGES[company.id].url).catch(() => {}); }}
            style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
            <Text style={styles.linkText}>{LINKS[company.id]}</Text><Ionicons name="open-outline" size={13} color={COLORS.primary} />
          </Pressable>)}
        </View>}
        <Text style={settingsStyles.footnote}>{`Costs are estimates from Anthropic’s and OpenAI’s list prices, checked ${CHECKED}. Your provider’s bill is the real number. Only numbers are kept here, never what you logged.`}</Text>
      </>}
    </FormScrollView>
  </FormScreen>;
}

function companyNote(company) {
  if (company.id === "chatgpt") return "Counts toward your ChatGPT plan, not billed per request.";
  const all = `${formatCost(company.cost)} in all, estimated.`;
  return company.unpriced ? `${all} Models with no listed price show their requests and tokens only.` : all;
}

// Requests per day, one bar each, today last and named. Bars grow from one baseline; a day with
// none draws nothing. Each bar says its day and count to VoiceOver.
function DayBars({ days }) {
  const most = Math.max(1, ...days.map(day => day.requests));
  return <View accessibilityLabel="Requests per day">
    <Text style={styles.barsTitle}>Requests per day</Text>
    <View style={styles.bars}>
      {days.map((day, index) => {
        const today = index === days.length - 1;
        const height = day.requests ? Math.max(4, Math.round((BAR_AREA * day.requests) / most)) : 0;
        return <View key={day.key} style={styles.column} accessible accessibilityLabel={`${today ? "Today" : WEEKDAYS[day.weekday]}, ${plural(day.requests, "request")}`}>
          <Text style={styles.barCount}>{today && day.requests ? day.requests : " "}</Text>
          <View style={styles.barSlot}>{height > 0 && <View style={[styles.bar, { height }]} />}</View>
        </View>;
      })}
    </View>
    <View style={styles.days} accessible={false} importantForAccessibility="no-hide-descendants">
      {/* One line each: at large text sizes a day shrinks rather than breaking mid-word. */}
      {days.map((day, index) => <Text key={day.key} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}
        style={[styles.barDay, index === days.length - 1 && styles.barToday]}>
        {index === days.length - 1 ? "Today" : WEEKDAYS[day.weekday].slice(0, 3)}</Text>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: AI_PAGE.page },
  card: { backgroundColor: AI_PAGE.card },
  week: { padding: SETTINGS.rowPadding, gap: 18 },
  headline: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headlineMain: { flex: 1, gap: 2 },
  hero: { ...TYPOGRAPHY.metric, color: SETTINGS.ink },
  heroLabel: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft },
  headlineSide: { alignItems: "flex-end", gap: 2, paddingTop: 4 },
  sideValue: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, fontVariant: ["tabular-nums"] },
  barsTitle: { ...TYPOGRAPHY.eyebrow, color: SETTINGS.inkSoft, textTransform: "uppercase", marginBottom: 6 },
  bars: { flexDirection: "row", alignItems: "flex-end", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SETTINGS.hairline },
  column: { flex: 1, alignItems: "center", gap: 4 },
  barCount: { ...TYPOGRAPHY.captionMedium, color: SETTINGS.ink, fontVariant: ["tabular-nums"] },
  barSlot: { height: BAR_AREA, justifyContent: "flex-end" },
  // Thin, rounded at the top, square on the baseline.
  bar: { width: 18, backgroundColor: SETTINGS.accent, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  days: { flexDirection: "row", paddingTop: 6 },
  barDay: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, flex: 1, textAlign: "center" },
  barToday: { ...TYPOGRAPHY.captionMedium, color: SETTINGS.ink },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 16, paddingHorizontal: 4, marginTop: -8 },
  link: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  linkText: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  linkPressed: { opacity: 0.45 },
});
