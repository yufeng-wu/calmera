import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { FormCard, GlassButton, formStyles } from "@/components/GlassForm";
import DayTimeline from "@/components/insights/DayTimeline";
import Heatmap, { WeekDots } from "@/components/insights/Heatmap";
import InsightCard from "@/components/insights/InsightCard";
import { ChartKey, NUTRIENTS, PERIODS, SplitTable, nutrientScale, nutrientSummary, periodName, plural } from "@/components/insights/InsightDetails";
import { MealBar, MealKey, describeShares } from "@/components/insights/MealShares";
import PeriodTabs from "@/components/insights/PeriodTabs";
import TrendChart from "@/components/insights/TrendChart";
import { SURFACES } from "@/constants/surfaces";
import { NUTRIENT_COLORS } from "@/constants/colors";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { useInsights } from "@/hooks/useInsights";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { formatNumber, formatRange, percentOfGoal } from "@/lib/insights/stats.mjs";

const dayLetter = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { weekday: "narrow" });
const weekdayName = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
const TOP_PRODUCE = 6;
const TYPICAL_TEXT = 132;
const SHARE_NAME = 62;
const SWIPE_DISTANCE = 50;
const SWIPE_SPEED = 500;
const SWIPE_TAP_GUARD = 150;
// Both cards travel together on one spring, with no overshoot past the next card.
const SLIDE = { damping: 28, stiffness: 260, mass: 0.8, overshootClamping: true };

export default function InsightsScreen() {
  const { fontScale, width } = useWindowDimensions();
  const { reduceMotion } = useMotionPreference();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const [period, setPeriod] = useState("week");
  // The period a tap or a finished swipe is sliding to. The tabs show it straight away,
  // while the cards are still on their way.
  const [chosen, setChosen] = useState(null);
  const { stats, statsOf, goals, empty, loaded, error, retryError } = useInsights(period);
  // Until history loads, the store holds only the days already opened, which would
  // read as a short history.
  const showData = loaded && !empty;
  // Cards are tappable all over, so a swipe across one has to not count as a tap.
  const swiping = useRef(false);
  const open = (card) => () => { if (!swiping.current) router.push({ pathname: "/insights/[card]", params: { card, period } }); };
  // The year's calendar scrolls sideways on its own, so a swipe that starts there isn't for us.
  const onCalendar = useSharedValue(false);
  // The periods sit side by side like cards along one strip, and `page` is where the
  // strip is: 0 on the week, 1 on the month, 2 on the year. Each card is drawn at its own
  // place along the strip, so the neighbour the finger pulls towards rides in, and the
  // handover at the end changes nothing on screen: the card that arrived simply stays.
  const page = useSharedValue(0);
  const sliding = useSharedValue(false);
  const previewDirection = useSharedValue(0);
  // Where the card beside the current one sits on the strip. A next-door period sits at
  // its own place. One further along (week to year) is drawn right next to this card, so
  // a tap slides one card's width, and the strip is renumbered in the frame it lands.
  const besideAt = useSharedValue(1);
  const index = PERIODS.findIndex(({ id }) => id === period);
  const [neighbour, setNeighbour] = useState(null); // the period beside this one while sliding
  // A slide waits for the card it brings in to be drawn, so it never slides in a blank.
  const drawn = useRef(null);
  const waiting = useRef(null);
  const placeBeside = (id, direction) => {
    previewDirection.value = id ? direction : 0;
    if (id) besideAt.value = index + direction;
    if (drawn.current !== id) drawn.current = null;
    setNeighbour(id);
  };
  const preview = (direction) => placeBeside(PERIODS[index + direction]?.id ?? null, direction);
  const settle = () => { previewDirection.value = 0; drawn.current = null; setNeighbour(null); };
  const arrive = (next) => {
    setPeriod(next);
    setChosen(null);
    settle();
    sliding.value = false;
  };
  const slideTo = (next, direction) => {
    if (!next || next === period || sliding.value) return;
    Haptics.selectionAsync().catch(() => {});
    sliding.value = true;
    setChosen(next);
    const target = PERIODS.findIndex(({ id }) => id === next);
    if (reduceMotion) { page.value = target; return arrive(next); }
    const go = () => {
      page.value = withSpring(index + direction, SLIDE, (finished) => {
        "worklet";
        if (!finished) return;
        besideAt.value = target;
        page.value = target;
        runOnJS(arrive)(next);
      });
    };
    if (neighbour === next && drawn.current === next) return go();
    const slide = { next, go };
    waiting.current = slide;
    placeBeside(next, direction);
    setTimeout(() => { if (waiting.current === slide) { waiting.current = null; go(); } }, 500);
  };
  const besideDrawn = (id) => {
    drawn.current = id;
    const slide = waiting.current;
    if (slide?.next !== id) return;
    waiting.current = null;
    slide.go();
  };
  const choosePeriod = (next) => slideTo(next, PERIODS.findIndex(({ id }) => id === next) > index ? 1 : -1);
  const markSwiping = () => { swiping.current = true; };
  const unmarkSwiping = () => { setTimeout(() => { swiping.current = false; }, SWIPE_TAP_GUARD); };
  const swipe = Gesture.Pan().activeOffsetX([-20, 20]).failOffsetY([-14, 14])
    .onStart(() => { runOnJS(markSwiping)(); })
    .onUpdate(({ translationX }) => {
      if (sliding.value || onCalendar.value) return;
      const direction = translationX < 0 ? 1 : -1;
      if (direction !== previewDirection.value) {
        besideAt.value = index + direction;
        runOnJS(preview)(direction);
      }
      // Past the last period the cards only give a little, like the end of a scroll.
      page.value = index - translationX / (PERIODS[index + direction] ? width : 3 * width);
    })
    .onEnd(({ translationX, velocityX }) => {
      if (sliding.value || onCalendar.value) return;
      const direction = translationX < 0 ? 1 : -1;
      const next = PERIODS[index + direction]?.id;
      const committed = Math.abs(translationX) >= SWIPE_DISTANCE || Math.abs(velocityX) >= SWIPE_SPEED;
      if (next && committed) runOnJS(slideTo)(next, direction);
      else page.value = withSpring(index, SLIDE, (finished) => { if (finished) runOnJS(settle)(); });
    })
    .onFinalize(() => {
      onCalendar.value = false;
      runOnJS(unmarkSwiping)();
    });

  return <GestureDetector gesture={swipe}><View style={formStyles.screen}>
    <PeriodTabs key={fontScale} items={PERIODS} value={chosen ?? period} onChange={choosePeriod} />
    <MaskedView style={styles.scrollMask} maskElement={<LinearGradient colors={["transparent", "black"]} locations={[0, 0.02]} style={styles.mask} />}>
      <ScrollView alwaysBounceVertical contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 32 }]}
        scrollIndicatorInsets={{ bottom: tabBarHeight }} showsVerticalScrollIndicator={false}>
        {!showData && error ? <RetryCard onRetry={retryError} />
          : !showData && !loaded ? <LoadingCards />
            : !showData ? <FirstRun onLog={() => router.navigate("/dashboard")} />
              : <View>
                {[period, neighbour].filter(Boolean).map((id) => <PeriodSlot key={id} position={PERIODS.findIndex((item) => item.id === id)}
                  besideAt={besideAt} page={page} width={width} beside={id !== period} reduceMotion={reduceMotion}
                  onDrawn={id !== period ? () => besideDrawn(id) : undefined}>
                  {id === period
                    ? <PeriodCards period={id} stats={stats} goals={goals} open={open}
                      onCalendarTouch={() => { onCalendar.value = true; }} onSeeLonger={(next) => slideTo(next, 1)} />
                    : <PeriodCards period={id} stats={statsOf(id)} goals={goals} open={() => () => {}} />}
                </PeriodSlot>)}
              </View>}
      </ScrollView>
    </MaskedView>
  </View></GestureDetector>;
}

// One period's place along the strip of cards. The one beside the current period is drawn
// over it, one screen away, and can't be tapped.
function PeriodSlot({ position, besideAt, page, width, beside, reduceMotion, onDrawn, children }) {
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: ((beside ? besideAt.value : position) - page.value) * width }] }));
  return <Animated.View pointerEvents={beside ? "none" : "auto"} entering={reduceMotion && !beside ? FadeIn.duration(180) : undefined}
    onLayout={onDrawn} style={[styles.cards, beside && styles.neighbour, motion]}>
    {children}
  </Animated.View>;
}

// Everything under the tabs for one period: the date range, then the cards.
function PeriodCards({ period, stats, goals, open, onCalendarTouch, onSeeLonger }) {
  const name = PERIODS.find(({ id }) => id === period).name;
  const hidesCards = !stats.rhythm || !stats.shares || (stats.span > 7 && !stats.split);
  return <>
    <Text style={styles.range}>{`Past ${name} · ${formatRange(stats.keys)}`}</Text>
    {!stats.daysLogged ? <FormCard style={styles.emptyCard}>
      <Text style={styles.message}>{`No meals logged in the past ${name}.`}</Text>
      {period !== "year" && onSeeLonger && <Pressable accessibilityRole="button" onPress={() => onSeeLonger(period === "week" ? "month" : "year")} hitSlop={12}>
        <Text style={styles.link}>{`See ${period === "week" ? "month" : "year"}`}</Text>
      </Pressable>}
    </FormCard>
      : <>
        <DaysCard stats={stats} onCalendarTouch={onCalendarTouch} />
        <TypicalCard stats={stats} goals={goals} onPress={open("typical")} />
        {stats.foods.length > 0 && <FoodsCard foodsBy={stats.foodsBy} onPress={open("foods")} />}
        {stats.produce && <ProduceCard produce={stats.produce} onPress={open("produce")} />}
        {stats.rhythm && <RhythmCard rhythm={stats.rhythm} span={stats.span} onPress={open("rhythm")} />}
        {stats.shares && <SharesCard shares={stats.shares} onPress={open("shares")} />}
        {stats.split && <SplitCard split={stats.split} onPress={open("split")} />}
        {hidesCards && <Text style={styles.moreNote}>More cards appear as you log.</Text>}
      </>}
  </>;
}

function RetryCard({ onRetry }) {
  return <FormCard style={styles.emptyCard}>
    <Text style={styles.message}>{"Couldn’t load your meals."}</Text>
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
    return <FormCard style={[styles.daysCard, styles.days]}>
      <View style={[styles.daysHeader, fontScale > 1.3 && styles.daysStacked]} accessible accessibilityRole="header" accessibilityLabel={`Days logged: ${label}.`}>
        <Text style={styles.cardTitle}>Days logged</Text>
        <Text style={styles.metric}>{label}</Text>
      </View>
      <View onTouchStart={onCalendarTouch}>
        <Heatmap keys={keys} logged={loggedDays} started={started} todayKey={todayKey} />
      </View>
    </FormCard>;
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

// The food that gave the most of each nutrient over the period, every log of it added up.
function FoodsCard({ foodsBy, onPress }) {
  const { iconFor } = useFoodIcons();
  const rows = NUTRIENTS.map(([field, title, unit]) => [field, title, unit, foodsBy[field][0]]).filter(([, , , food]) => food);
  return <InsightCard title="Top foods" onPress={onPress}>
    <View>
      {rows.map(([field, title, unit, food], index) => <View key={field} accessible style={[styles.topFood, index > 0 && styles.topFoodDivider]}
        accessibilityLabel={`Most ${title.toLowerCase()}: ${food.name}, ${formatNumber(food[field])} ${unit === "g" ? "grams" : "kilocalories"}.`}>
        <View style={styles.topFoodNutrient}>
          <View style={[styles.topFoodDot, { backgroundColor: NUTRIENT_COLORS[field] }]} />
          <Text numberOfLines={1} style={styles.topFoodLabel}>{title}</Text>
        </View>
        <Text style={styles.topFoodIcon}>{iconFor(food.icon).emoji}</Text>
        <Text numberOfLines={1} style={styles.topFoodName}>{food.name}</Text>
        <Text style={styles.topFoodValue}>{`${formatNumber(food[field])} ${unit}`}</Text>
      </View>)}
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
  return <InsightCard title="Veggies and fruit" onPress={onPress} answer={counts.length ? counts.join(" · ") : "None spotted yet."}>
    {icons.size > 0 && <View style={styles.produceIcons}>
      {[...icons.keys()].slice(0, TOP_PRODUCE).map((emoji) => <Text key={emoji} style={styles.produceIcon}>{emoji}</Text>)}
    </View>}
  </InsightCard>;
}

function RhythmCard({ rhythm, span, onPress }) {
  return <InsightCard title="When you eat" onPress={onPress}>
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
  neighbour: { position: "absolute", top: 0, left: 0, right: 0 },
  range: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  topFood: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 },
  topFoodDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.track },
  topFoodNutrient: { flexDirection: "row", alignItems: "center", gap: 6, width: 76 },
  topFoodDot: { width: 7, height: 7, borderRadius: 3.5 },
  topFoodLabel: { ...TYPOGRAPHY.caption, flexShrink: 1, color: COLORS.textLight },
  topFoodIcon: { fontSize: 20, lineHeight: 26 },
  topFoodName: { ...TYPOGRAPHY.body, flex: 1, color: COLORS.text },
  topFoodValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
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
  daysHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  dayRow: { flexDirection: "row", gap: 5 },
  dayCell: { alignItems: "center", gap: 2 },
  dayDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.track },
  dayNotStarted: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: COLORS.track },
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
