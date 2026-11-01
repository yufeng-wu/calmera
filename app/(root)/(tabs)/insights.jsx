import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { FormCard, GlassButton, formStyles } from "@/components/GlassForm";
import FoodwrapRefreshScrollView from "@/components/FoodwrapRefreshScrollView";
import DayTimeline from "@/components/insights/DayTimeline";
import Heatmap, { WeekDots } from "@/components/insights/Heatmap";
import InsightCard, { Chips, Strong } from "@/components/insights/InsightCard";
import PeriodTabs from "@/components/insights/PeriodTabs";
import TrendChart from "@/components/insights/TrendChart";
import { SURFACES } from "@/constants/surfaces";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { useInsights } from "@/hooks/useInsights";
import { formatNearClock, formatNumber, formatRange } from "@/lib/insights/stats.mjs";

const PERIODS = [
  { id: "week", label: "Week", name: "7 days", accessibilityLabel: "Week, last 7 days" },
  { id: "month", label: "Month", name: "30 days", accessibilityLabel: "Month, last 30 days" },
  { id: "year", label: "Year", name: "12 months", accessibilityLabel: "Year, last 12 months" },
];
const NUTRIENTS = [["calories", "Calories", "kcal", "calorieGoal"], ["protein", "Protein", "g", "proteinGoal"], ["carbs", "Carbs", "g", "carbsGoal"], ["fat", "Fat", "g", "fatGoal"]];
const MEAL_LABELS = { Breakfast: "Breakfast", Lunch: "Lunch", Dinner: "Dinner", Snack: "Snacks" };
const FOOD_VIEWS = [["count", "Most eaten"], ["protein", "Protein"], ["calories", "Calories"]];
const dayLetter = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { weekday: "narrow" });
const plural = (count, word) => `${formatNumber(count)} ${word}${count === 1 ? "" : "s"}`;

export default function InsightsScreen() {
  const { fontScale } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const [period, setPeriod] = useState("week");
  const { stats, goals, empty, loaded, error, retryError, refresh } = useInsights(period);
  // Until history loads, the store holds only the days already opened, which would
  // read as a short history.
  const showData = loaded && !empty;
  const hidesCards = showData && (!stats.rhythm || (stats.span > 7 && (!stats.difference || !stats.split)));

  return <View style={formStyles.screen}>
    <PeriodTabs key={fontScale} items={PERIODS} value={period} onChange={setPeriod} />
    <MaskedView style={styles.scrollMask} maskElement={<LinearGradient colors={["transparent", "black"]} locations={[0, 0.02]} style={styles.mask} />}>
      <FoodwrapRefreshScrollView onRefresh={refresh} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 32 }]}
        scrollIndicatorInsets={{ bottom: tabBarHeight }} showsVerticalScrollIndicator={false}>
        {!showData && error ? <RetryCard onRetry={retryError} />
          : !showData && !loaded ? <LoadingCards />
            : !showData ? <FirstRun onLog={() => router.navigate("/dashboard")} />
              : <Animated.View key={period} entering={FadeIn.duration(180)} style={styles.cards}>
                <Text style={styles.range}>{`Last ${PERIODS.find(({ id }) => id === period).name} · ${formatRange(stats.keys)}`}</Text>
                {!!error && <Pressable accessibilityRole="button" onPress={retryError} hitSlop={{ top: 12, bottom: 12 }}><Text style={styles.staleNote}>{"Couldn't refresh. Tap to try again."}</Text></Pressable>}
                {!stats.daysLogged ? <FormCard style={styles.emptyCard}>
                  <Text style={styles.message}>{`No meals to show for the last ${PERIODS.find(({ id }) => id === period).name}.`}</Text>
                  {period !== "year" && <Pressable accessibilityRole="button" onPress={() => setPeriod(period === "week" ? "month" : "year")} hitSlop={12}>
                    <Text style={styles.link}>{`See ${period === "week" ? "month" : "year"}`}</Text>
                  </Pressable>}
                </FormCard>
                  : <>
                    <DaysCard stats={stats} />
                    <TrendCard stats={stats} goals={goals} />
                    <FoodsCard stats={stats} />
                    {stats.rhythm && <RhythmCard rhythm={stats.rhythm} />}
                    {stats.difference && <DifferenceCard difference={stats.difference} />}
                    {stats.split && <SplitCard split={stats.split} />}
                    {hidesCards && <Text style={styles.moreNote}>More shows up here as you log.</Text>}
                  </>}
              </Animated.View>}
      </FoodwrapRefreshScrollView>
    </MaskedView>
  </View>;
}

function RetryCard({ onRetry }) {
  return <FormCard style={styles.emptyCard}>
    <Text style={styles.message}>{"Couldn't load your meals."}</Text>
    <GlassButton title="Try again" onPress={onRetry} style={styles.emptyAction} />
  </FormCard>;
}

function LoadingCards() {
  return <View accessible accessibilityLabel="Loading your meals" style={styles.cards}>
    <View style={styles.rangeSkeleton} />
    {[148, 248, 200].map((height) => <View key={height} style={[styles.skeleton, { height }]} />)}
  </View>;
}

function FirstRun({ onLog }) {
  return <FormCard style={styles.emptyCard}>
    <Text accessibilityRole="header" style={styles.emptyTitle}>Your patterns will show up here</Text>
    <Text style={styles.message}>This page fills in over a few days of logging: when you eat, your go-to foods and a typical day.</Text>
    <GlassButton title="Log a meal" role="accent" onPress={onLog} style={styles.emptyAction} />
  </FormCard>;
}

function DaysCard({ stats }) {
  const { span, keys, loggedDays, started, todayKey, daysLogged } = stats;
  const label = plural(daysLogged, "day");
  if (span === 30) {
    return <FormCard style={styles.daysCard}>
      <View style={styles.daysBeside} accessible accessibilityLabel={`${label} logged`}>
        <View style={styles.daysSummary}>
          <Text accessibilityRole="header" style={styles.cardTitle}>Days logged</Text>
          <Text style={styles.metric}>{label}</Text>
        </View>
        <WeekDots keys={keys} logged={loggedDays} started={started} todayKey={todayKey} />
      </View>
    </FormCard>;
  }
  return <InsightCard title="Days logged">
    <View style={styles.days} accessible accessibilityLabel={`${label} logged`}>
      <Text style={styles.metric}>{label}</Text>
      {span > 30 ? <Heatmap keys={keys} logged={loggedDays} started={started} todayKey={todayKey} />
        : <View style={styles.dayRow}>
          {keys.map((key, index) => <View key={key} style={styles.dayCell}>
            <View style={[styles.dayDot, !started[index] && styles.dayNotStarted, loggedDays[index] && styles.dayLogged, key === todayKey && styles.dayToday]} />
            <Text style={styles.dayLabel}>{dayLetter(key)}</Text>
          </View>)}
        </View>}
    </View>
  </InsightCard>;
}

function TrendCard({ stats, goals }) {
  const [field, setField] = useState("calories");
  const [selected, setSelected] = useState(null);
  // Reading a bar has less to say, and the chart shouldn't move under the finger.
  const [headlineHeight, setHeadlineHeight] = useState(0);
  const [, title, unit, goalField] = NUTRIENTS.find(([id]) => id === field);
  const { typical, low, high, previous, chart } = stats.metrics[field];
  const point = selected == null ? null : chart[selected];
  const goal = Number(goals[goalField]) || null;
  const period = PERIODS.find(({ name }) => name === (stats.span > 30 ? "12 months" : `${stats.span} days`)).name;
  const hasPartial = chart.some((item) => item.partial && item.value != null);
  const footnote = stats.span > 30 ? "Each bar is a month's daily average. Lighter bars are partial months."
    : hasPartial ? "Lighter bars are today and days with one meal. They don't count toward typical." : null;
  const present = chart.filter((item) => item.value != null);
  const summary = `${title} by ${stats.span > 30 ? "month" : "day"}. ${typical != null ? `A typical day is ${formatNumber(typical)} ${unit}. ` : ""}`
    + (present.length ? `Highest ${formatNumber(Math.max(...present.map((item) => item.value)))} ${unit}.` : "");
  return <InsightCard title="A typical day" footnote={footnote}>
    <Chips label="Nutrient" items={NUTRIENTS.map(([id, name]) => [id, name])} value={field} onChange={(id) => { setField(id); setSelected(null); }} />
    <View style={[styles.headline, { minHeight: headlineHeight }]} accessibilityLiveRegion="polite"
      onLayout={({ nativeEvent: { layout } }) => setHeadlineHeight((height) => Math.max(height, layout.height))}>
      {(point || typical != null) && <Text style={styles.metric}>{formatNumber(point ? point.value : typical)} <Text style={styles.unit}>{unit}</Text></Text>}
      {point ? <Text style={styles.answer}>{point.title}</Text>
        : typical != null ? <>
          <Text style={styles.answer}>Half your days are between <Strong>{formatNumber(low)}</Strong> and <Strong>{formatNumber(high)}</Strong>.</Text>
          {previous != null && <Text style={styles.answer}>Previous {period}: {formatNumber(previous)} {unit}</Text>}
        </> : <Text style={styles.answer}>Your typical day appears after three days with two or more meals.</Text>}
    </View>
    {!!goal && <View style={styles.goalKey}>
      <Svg width={14} height={2}><Line x1={0} x2={14} y1={1} y2={1} stroke={COLORS.textLight} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="3 4" /></Svg>
      <Text style={styles.footnote}>Goal {formatNumber(goal)} {unit}</Text>
    </View>}
    <TrendChart points={chart} goal={goal} selected={selected} onSelect={setSelected} accessibilityLabel={summary} />
  </InsightCard>;
}

function RhythmCard({ rhythm }) {
  return <InsightCard title="When you eat" footnote="The dot is your usual time. Half your days fall inside the band. Times are when you logged, unless edited."
    answer={rhythm.halfBy != null ? <>{"You've had half your calories by about "}<Strong>{formatNearClock(rhythm.halfBy)}</Strong>.</> : null}>
    <DayTimeline meals={rhythm.meals} />
  </InsightCard>;
}

function DifferenceCard({ difference }) {
  const { fontScale } = useWindowDimensions();
  const { goal, higherDays, lowerDays, meals, widest, foods } = difference;
  const higherName = goal ? `${formatNumber(goal)} g or more` : "Higher days", lowerName = goal ? `Under ${formatNumber(goal)} g` : "Other days";
  const top = Math.max(...meals.flatMap((meal) => [meal.higher, meal.lower]), 1);
  const shown = meals.filter((meal) => meal.higher >= 1 || meal.lower >= 1);
  const days = `From ${plural(higherDays + lowerDays, "day")} with two or more meals. A pattern, not a cause.`;
  return <InsightCard title={goal ? `On days with ${formatNumber(goal)} g of protein or more` : "On your higher-protein days"}
    answer={widest ? <>Biggest difference: {MEAL_LABELS[widest.meal].toLowerCase()}, with <Strong>{formatNumber(widest.higher)} g</Strong> of protein against <Strong>{formatNumber(widest.lower)} g</Strong>.</> : null}
    footnote={goal ? days : `Higher days are the half with the most protein. ${days}`}>
    <View style={styles.pairs}>
      {shown.map((meal) => <View key={meal.meal} style={[styles.pair, fontScale > 1.3 && styles.pairStacked]} accessible
        accessibilityLabel={`${MEAL_LABELS[meal.meal]}: ${formatNumber(meal.higher)} grams on days with ${higherName}, ${formatNumber(meal.lower)} grams on days with ${lowerName}`}>
        <Text style={[styles.pairName, fontScale > 1.3 && styles.pairNameStacked]}>{MEAL_LABELS[meal.meal]}</Text>
        <View style={styles.pairBars}>
          <PairBar value={meal.higher} top={top} color={COLORS.primary} />
          <PairBar value={meal.lower} top={top} color={COLORS.soft} />
        </View>
      </View>)}
    </View>
    <View style={styles.key}>
      <KeyItem color={COLORS.primary} label={`${higherName} (${higherDays})`} />
      <KeyItem color={COLORS.soft} label={`${lowerName} (${lowerDays})`} />
    </View>
    {foods.length > 0 && <View style={styles.diffFoods}>
      <Text style={styles.diffHeading}>More often on these days</Text>
      {foods.map((food) => <FoodLine key={food.name} name={food.name} detail={`${food.higher} of ${higherDays} days, against ${food.lower} of ${lowerDays}`} />)}
    </View>}
  </InsightCard>;
}

function PairBar({ value, top, color }) {
  return <View style={styles.pairRow}>
    <View style={[styles.pairBar, { backgroundColor: color, width: `${Math.max(value / top * 72, 2)}%` }]} />
    <Text style={styles.pairValue}>{formatNumber(value)} g</Text>
  </View>;
}

const KeyItem = ({ color, label }) => <View style={styles.keyItem}>
  <View style={[styles.keyDot, { backgroundColor: color }]} />
  <Text style={styles.footnote}>{label}</Text>
</View>;

function FoodLine({ name, value, detail, isNew, divider }) {
  const { iconFor } = useFoodIcons();
  return <View style={[styles.food, divider && styles.divider]} accessible accessibilityLabel={[name, value, detail, isNew && "new"].filter(Boolean).join(", ")}>
    <Text style={styles.foodIcon}>{iconFor({ foodName: name }).emoji}</Text>
    <View style={styles.foodCopy}>
      <Text style={styles.foodName}>{name}</Text>
      {!!detail && <Text style={styles.footnote}>{detail}</Text>}
    </View>
    {isNew && <Text style={styles.newBadge}>New</Text>}
    {!!value && <Text style={styles.foodValue}>{value}</Text>}
  </View>;
}

function FoodsCard({ stats }) {
  const [view, setView] = useState("count");
  const foods = stats.foodsBy[view];
  if (!stats.foods.length) return null;
  const value = (food) => view === "count" ? `${food.count}×` : `${Math.round(food[view] / stats.foodTotals[view] * 100)}%`;
  const note = view === "count" ? null : `Share of your ${view === "protein" ? "protein" : "calories"} in this period.`;
  return <InsightCard title="Your foods" footnote={note}>
    <Chips label="Sort foods" items={FOOD_VIEWS} value={view} onChange={setView} />
    {foods.length ? <View>
      {foods.map((food, index) => <FoodLine key={food.id} name={food.name} value={value(food)} isNew={food.isNew} divider={index > 0} />)}
    </View> : <Text style={styles.answer}>No {view} logged in this period.</Text>}
  </InsightCard>;
}

function SplitCard({ split }) {
  const rows = [
    ["Calories", "kcal", (side) => formatNumber(side.calories)],
    ["Protein", "g", (side) => formatNumber(side.protein)],
    ["First meal time", "", (side) => formatNearClock(side.firstMeal)],
    ["Dinner time", "", (side) => formatNearClock(side.dinner)],
  ].filter(([, , read]) => read(split.weekday) !== "–" || read(split.weekend) !== "–");
  return <InsightCard title="Weekdays and weekends" footnote={`Typical values, from ${plural(split.weekday.days, "weekday")} and ${plural(split.weekend.days, "weekend day")}.`}>
    <View>
      <View style={styles.compareHead}>
        <View style={styles.compareLabel} />
        <Text style={styles.compareTitle}>Weekdays</Text>
        <Text style={styles.compareTitle}>Weekends</Text>
      </View>
      {rows.map(([title, unit, read]) => <View key={title} style={[styles.compareRow, styles.divider]} accessible
        accessibilityLabel={`${title}: ${read(split.weekday)} ${unit} on weekdays, ${read(split.weekend)} ${unit} on weekends`}>
        <Text style={[styles.compareLabel, styles.compareName]}>{title}</Text>
        <Text style={styles.compareValue}>{read(split.weekday)}{unit ? <Text style={styles.compareUnit}> {unit}</Text> : null}</Text>
        <Text style={styles.compareValue}>{read(split.weekend)}{unit ? <Text style={styles.compareUnit}> {unit}</Text> : null}</Text>
      </View>)}
    </View>
  </InsightCard>;
}


const styles = StyleSheet.create({
  scrollMask: { flex: 1 },
  mask: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 6, gap: 14 },
  cards: { gap: 14 },
  range: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  staleNote: { ...TYPOGRAPHY.caption, color: COLORS.primary, textAlign: "center" },
  moreNote: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  skeleton: { borderRadius: 24, backgroundColor: COLORS.track, opacity: 0.45 },
  emptyCard: { gap: 10, alignItems: "center", paddingVertical: 28 },
  emptyTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text, textAlign: "center" },
  message: { ...TYPOGRAPHY.body, color: COLORS.textLight, textAlign: "center" },
  link: { ...TYPOGRAPHY.button, color: COLORS.primary },
  emptyAction: { alignSelf: "stretch", marginTop: 6 },
  rangeSkeleton: { height: 18 },
  cardTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  metric: { ...TYPOGRAPHY.metric, color: COLORS.text },
  unit: { ...TYPOGRAPHY.body, color: COLORS.text },
  answer: { ...TYPOGRAPHY.body, color: COLORS.text },
  footnote: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  headline: { gap: 2 },
  goalKey: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: -6 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.separator },
  daysCard: { padding: 18 },
  days: { gap: 8 },
  daysBeside: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  daysSummary: { flex: 1, gap: 4 },
  dayRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  dayCell: { alignItems: "center", gap: 4 },
  dayDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.track },
  dayNotStarted: { backgroundColor: "transparent" },
  dayLogged: { backgroundColor: COLORS.primary },
  dayToday: { borderWidth: 2, borderColor: COLORS.text },
  dayLabel: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  pairs: { gap: 12 },
  pair: { flexDirection: "row", alignItems: "center", gap: 10 },
  pairStacked: { flexDirection: "column", alignItems: "stretch", gap: 4 },
  pairName: { ...TYPOGRAPHY.body, width: 72, color: COLORS.text },
  pairNameStacked: { width: "auto" },
  pairBars: { flex: 1 },
  pairRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 18 },
  pairBar: { height: 8, borderRadius: 4 },
  pairValue: { ...TYPOGRAPHY.caption, color: COLORS.textLight, fontVariant: ["tabular-nums"] },
  key: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 2 },
  keyItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  keyDot: { width: 8, height: 8, borderRadius: 4 },
  diffFoods: { marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.separator },
  diffHeading: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  food: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  foodIcon: { fontSize: 24, lineHeight: 30 },
  foodCopy: { flex: 1 },
  foodName: { ...TYPOGRAPHY.body, color: COLORS.text },
  newBadge: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  foodValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
  compareHead: { flexDirection: "row", paddingBottom: 8 },
  compareRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  compareLabel: { flex: 1 },
  compareName: { ...TYPOGRAPHY.body, color: COLORS.text },
  compareTitle: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.textLight, textAlign: "right" },
  compareValue: { ...TYPOGRAPHY.bodyMedium, flex: 1, color: COLORS.text, textAlign: "right", fontVariant: ["tabular-nums"] },
  compareUnit: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
});
