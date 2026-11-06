import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { FormCard, GlassButton, formStyles } from "@/components/GlassForm";
import FoodwrapRefreshScrollView from "@/components/FoodwrapRefreshScrollView";
import DayTimeline from "@/components/insights/DayTimeline";
import Heatmap, { WeekDots } from "@/components/insights/Heatmap";
import InsightCard from "@/components/insights/InsightCard";
import { ChartKey, FoodLine, MEAL_LABELS, NUTRIENTS, PERIODS, PairBar, SplitTable, nutrientScale, nutrientSummary, periodName, plural } from "@/components/insights/InsightDetails";
import { MealBar, MealKey, describeShares } from "@/components/insights/MealShares";
import PeriodTabs from "@/components/insights/PeriodTabs";
import TrendChart from "@/components/insights/TrendChart";
import { SURFACES } from "@/constants/surfaces";
import { NUTRIENT_COLORS } from "@/constants/colors";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { useInsights } from "@/hooks/useInsights";
import { formatNumber, formatRange, percentOfGoal } from "@/lib/insights/stats.mjs";

const dayLetter = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { weekday: "narrow" });
const weekdayName = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
const TOP_FOODS = 3;
const TOP_PRODUCE = 6;
const TYPICAL_TEXT = 132;
const SHARE_NAME = 62;
const SWIPE_DISTANCE = 50;
const SWIPE_SPEED = 500;
const SWIPE_TAP_GUARD = 150;

export default function InsightsScreen() {
  const { fontScale } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const [period, setPeriod] = useState("week");
  const { stats, goals, empty, loaded, error, refreshFailed, retryError, refresh } = useInsights(period);
  // Until history loads, the store holds only the days already opened, which would
  // read as a short history.
  const showData = loaded && !empty;
  const hidesCards = showData && (!stats.rhythm || !stats.shares || (stats.span > 7 && (!stats.difference || !stats.split)));
  // Cards are tappable all over, so a swipe across one has to not count as a tap.
  const swiping = useRef(false);
  const open = (card) => () => { if (!swiping.current) router.push({ pathname: "/insights/[card]", params: { card, period } }); };
  // The year's calendar scrolls sideways on its own, so a swipe that starts there isn't for us.
  const startedOnCalendar = useRef(false);
  // Swiping left moves to the longer period and right to the shorter one, stopping at the ends.
  const swipe = Gesture.Pan().runOnJS(true).activeOffsetX([-20, 20]).failOffsetY([-14, 14])
    .onStart(() => { swiping.current = true; })
    .onEnd(({ translationX, velocityX }) => {
      if (startedOnCalendar.current) return;
      if (Math.abs(translationX) < SWIPE_DISTANCE && Math.abs(velocityX) < SWIPE_SPEED) return;
      const next = PERIODS[PERIODS.findIndex(({ id }) => id === period) + (translationX < 0 ? 1 : -1)];
      if (!next) return;
      Haptics.selectionAsync().catch(() => {});
      setPeriod(next.id);
    })
    .onFinalize(() => {
      startedOnCalendar.current = false;
      setTimeout(() => { swiping.current = false; }, SWIPE_TAP_GUARD);
    });

  return <GestureDetector gesture={swipe}><View style={formStyles.screen}>
    <PeriodTabs key={fontScale} items={PERIODS} value={period} onChange={setPeriod} />
    <MaskedView style={styles.scrollMask} maskElement={<LinearGradient colors={["transparent", "black"]} locations={[0, 0.02]} style={styles.mask} />}>
      <FoodwrapRefreshScrollView onRefresh={refresh} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 32 }]}
        scrollIndicatorInsets={{ bottom: tabBarHeight }} showsVerticalScrollIndicator={false}>
        {!showData && error ? <RetryCard onRetry={retryError} />
          : !showData && !loaded ? <LoadingCards />
            : !showData ? <FirstRun onLog={() => router.navigate("/dashboard")} />
              : <Animated.View key={period} entering={FadeIn.duration(180)} style={styles.cards}>
                <Text style={styles.range}>{`Past ${PERIODS.find(({ id }) => id === period).name} · ${formatRange(stats.keys)}`}</Text>
                {refreshFailed && <Pressable accessibilityRole="button" onPress={() => refresh().catch(() => {})} hitSlop={{ top: 13, bottom: 13 }}><Text style={styles.staleNote}>{"Couldn't refresh. Tap to try again."}</Text></Pressable>}
                {!stats.daysLogged ? <FormCard style={styles.emptyCard}>
                  <Text style={styles.message}>{`No meals to show for the past ${PERIODS.find(({ id }) => id === period).name}.`}</Text>
                  {period !== "year" && <Pressable accessibilityRole="button" onPress={() => setPeriod(period === "week" ? "month" : "year")} hitSlop={12}>
                    <Text style={styles.link}>{`See ${period === "week" ? "month" : "year"}`}</Text>
                  </Pressable>}
                </FormCard>
                  : <>
                    <DaysCard stats={stats} onCalendarTouch={() => { startedOnCalendar.current = true; }} />
                    <TypicalCard stats={stats} goals={goals} onPress={open("typical")} />
                    {stats.foods.length > 0 && <FoodsCard foods={stats.foods} onPress={open("foods")} />}
                    {stats.produce && <ProduceCard produce={stats.produce} onPress={open("produce")} />}
                    {stats.rhythm && <RhythmCard rhythm={stats.rhythm} span={stats.span} onPress={open("rhythm")} />}
                    {stats.shares && <SharesCard shares={stats.shares} onPress={open("shares")} />}
                    {stats.difference && <DifferenceCard difference={stats.difference} onPress={open("difference")} />}
                    {stats.split && <SplitCard split={stats.split} onPress={open("split")} />}
                    {hidesCards && <Text style={styles.moreNote}>More shows up here as you log.</Text>}
                  </>}
              </Animated.View>}
      </FoodwrapRefreshScrollView>
    </MaskedView>
  </View></GestureDetector>;
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
    {[92, 340, 180].map((height) => <View key={height} style={[styles.skeleton, { height }]} />)}
  </View>;
}

function FirstRun({ onLog }) {
  return <FormCard style={styles.emptyCard}>
    <Text accessibilityRole="header" style={styles.emptyTitle}>Your patterns will show up here</Text>
    <Text style={styles.message}>This page fills in over a few days of logging: when you eat, your go-to foods and an average day.</Text>
    <GlassButton title="Log a meal" role="accent" onPress={onLog} style={styles.emptyAction} />
  </FormCard>;
}

function DaysCard({ stats, onCalendarTouch }) {
  const { fontScale } = useWindowDimensions();
  const { span, keys, loggedDays, started, todayKey, daysLogged } = stats;
  const label = plural(daysLogged, "day");
  const which = span === 7 ? ` ${keys.filter((_, index) => loggedDays[index]).map(weekdayName).join(", ")}.` : "";
  if (span > 30) {
    return <InsightCard title="Days logged">
      <View style={styles.days} accessible accessibilityLabel={`${label} logged`}>
        <Text style={styles.metric}>{label}</Text>
        <View onTouchStart={onCalendarTouch}>
          <Heatmap keys={keys} logged={loggedDays} started={started} todayKey={todayKey} />
        </View>
      </View>
    </InsightCard>;
  }
  return <FormCard style={styles.daysCard}>
    <View style={[styles.daysBeside, fontScale > 1.3 && styles.daysStacked]} accessible accessibilityRole="header"
      accessibilityLabel={`Days logged: ${label}.${which}`}>
      <View style={styles.daysSummary}>
        <Text accessibilityRole="header" style={styles.cardTitle}>Days logged</Text>
        <Text style={styles.metric}>{label}</Text>
      </View>
      {span === 30 ? <WeekDots keys={keys} logged={loggedDays} started={started} todayKey={todayKey} />
        : <View style={styles.dayRow}>
          {keys.map((key, index) => <View key={key} style={styles.dayCell}>
            <View style={[styles.dayDot, !started[index] && styles.dayNotStarted, loggedDays[index] && styles.dayLogged, key === todayKey && styles.dayToday]} />
            <Text maxFontSizeMultiplier={1.3} style={styles.dayLabel}>{dayLetter(key)}</Text>
          </View>)}
        </View>}
    </View>
  </FormCard>;
}

function TypicalCard({ stats, goals, onPress }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  const noTypical = NUTRIENTS.every(([field]) => stats.metrics[field].typical == null);
  const scale = nutrientScale(stats, goals);
  return <InsightCard title={`Past ${periodName(stats.span)} average`} onPress={onPress} answer={noTypical ? "Appears after three days with two or more meals, not counting today." : null}>
    <ChartKey compact stats={stats} goals={goals} />
    <View>
      {NUTRIENTS.map(([field, title, unit, goalField], index) => {
        const metric = stats.metrics[field];
        const goal = Number(goals[goalField]) || null;
        const { typical } = metric;
        const percent = percentOfGoal(typical, goal);
        const detail = !goal ? null
          : typical != null ? `${formatNumber(typical)} of ${formatNumber(goal)} ${unit}` : `Goal ${formatNumber(goal)} ${unit}`;
        return <View key={field} style={[styles.typicalRow, index > 0 && styles.divider, stacked && styles.typicalStacked]}>
          <View style={stacked ? null : { width: TYPICAL_TEXT * fontScale }}>
            <Text style={styles.footnote}>{title}</Text>
            <Text numberOfLines={stacked ? undefined : 1} style={styles.metric}>
              {percent != null ? `${percent}%` : formatNumber(typical)}
              {percent == null && <Text style={styles.unit}> {unit}</Text>}
              {percent != null && <Text style={styles.footnote}> of goal</Text>}
            </Text>
            {!!detail && <Text numberOfLines={stacked ? undefined : 1} style={styles.footnote}>{detail}</Text>}
          </View>
          <View style={stacked ? null : styles.typicalChart}>
            <TrendChart compact color={NUTRIENT_COLORS[field]} height={66} points={metric.chart} goal={goal} top={goal ? goal * scale : undefined}
              accessibilityLabel={nutrientSummary(title, unit, stats.span, metric, goal)} />
          </View>
        </View>;
      })}
    </View>
  </InsightCard>;
}

function FoodsCard({ foods, onPress }) {
  return <InsightCard title="Leaderboard" onPress={onPress}>
    <View>
      {foods.slice(0, TOP_FOODS).map((food, index) => <FoodLine key={food.id} compact name={food.name} icon={food.icon} value={`${food.count}×`} divider={index > 0} />)}
    </View>
  </InsightCard>;
}

function ProduceCard({ produce, onPress }) {
  const { iconFor } = useFoodIcons();
  const { vegetables, fruits } = produce;
  const counts = [vegetables.length && plural(vegetables.length, "vegetable"), fruits.length && plural(fruits.length, "fruit")].filter(Boolean);
  // One emoji covers many greens, so each appears once, and ones without a real match are left out.
  const icons = new Map();
  for (const item of [...vegetables, ...fruits].sort((a, b) => b.count - a.count)) {
    const icon = iconFor({ foodName: item.name });
    if (icon.id !== "meal" && !icons.has(icon.emoji)) icons.set(icon.emoji, item.name);
  }
  return <InsightCard title="Veg and fruit" onPress={onPress} answer={counts.length ? counts.join(" · ") : "None in the foods checked."}>
    {icons.size > 0 && <View style={styles.produceIcons}>
      {[...icons.keys()].slice(0, TOP_PRODUCE).map((emoji) => <Text key={emoji} style={styles.produceIcon}>{emoji}</Text>)}
    </View>}
  </InsightCard>;
}

function RhythmCard({ rhythm, span, onPress }) {
  return <InsightCard title="When you eat" onPress={onPress} footnote="Each dot is one meal or snack. The line is the average.">
    <DayTimeline rhythm={rhythm} span={span} />
  </InsightCard>;
}

// One bar per nutrient, sliced by meal. The exact percents and amounts are one tap away.
function SharesCard({ shares, onPress }) {
  const { fontScale } = useWindowDimensions();
  const { meals } = shares;
  return <InsightCard title="What each meal adds" onPress={onPress} footnote="Each bar is 100% of that nutrient.">
    <MealKey meals={meals} />
    <View style={styles.shareRows}>
      {NUTRIENTS.map(([field, title]) => <View key={field} accessible accessibilityLabel={describeShares(title, meals, field)} style={styles.shareRow}>
        <Text numberOfLines={1} style={[styles.shareName, { width: SHARE_NAME * fontScale }]}>{title}</Text>
        <MealBar meals={meals} field={field} />
      </View>)}
    </View>
  </InsightCard>;
}

function DifferenceCard({ difference, onPress }) {
  const { widest, meals } = difference;
  const top = Math.max(...meals.flatMap((meal) => [meal.higher, meal.lower]), 1);
  return <InsightCard title="Higher-protein days" onPress={onPress}
    answer={widest ? `${MEAL_LABELS[widest.meal]}: ${formatNumber(widest.higher)} g on these days, ${formatNumber(widest.lower)} g on others.` : "No meal stands out."}>
    {!!widest && <View>
      <PairBar value={widest.higher} top={top} color={COLORS.primary} />
      <PairBar value={widest.lower} top={top} color={COLORS.soft} />
    </View>}
  </InsightCard>;
}

function SplitCard({ split, onPress }) {
  return <InsightCard title="Weekdays and weekends" onPress={onPress}>
    <SplitTable split={split} only={["Calories", "Dinner time"]} />
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
  footnote: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.separator },
  daysCard: { padding: 18 },
  days: { gap: 8 },
  daysBeside: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  daysStacked: { flexDirection: "column", alignItems: "flex-start" },
  daysSummary: { flex: 1, gap: 4 },
  dayRow: { flexDirection: "row", gap: 5 },
  dayCell: { alignItems: "center", gap: 2 },
  dayDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.track },
  dayNotStarted: { backgroundColor: "transparent" },
  dayLogged: { backgroundColor: COLORS.primary },
  dayToday: { borderWidth: 2, borderColor: COLORS.text },
  dayLabel: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  typicalRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  typicalStacked: { flexDirection: "column", alignItems: "stretch", gap: 6 },
  typicalChart: { flex: 1 },
  produceIcons: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  produceIcon: { fontSize: 24, lineHeight: 30 },
  shareRows: { gap: 12 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  shareName: { ...TYPOGRAPHY.body, color: COLORS.text },
});
