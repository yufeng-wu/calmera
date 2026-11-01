import { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Line } from "react-native-svg";
import DayTimeline from "@/components/insights/DayTimeline";
import InsightCard, { Chips, Strong } from "@/components/insights/InsightCard";
import TrendChart from "@/components/insights/TrendChart";
import { SURFACES } from "@/constants/surfaces";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { formatNearClock, formatNumber } from "@/lib/insights/stats.mjs";

export const PERIODS = [
  { id: "week", label: "Week", name: "7 days", accessibilityLabel: "Week, last 7 days" },
  { id: "month", label: "Month", name: "30 days", accessibilityLabel: "Month, last 30 days" },
  { id: "year", label: "Year", name: "12 months", accessibilityLabel: "Year, last 12 months" },
];
export const NUTRIENTS = [["calories", "Calories", "kcal", "calorieGoal"], ["protein", "Protein", "g", "proteinGoal"], ["carbs", "Carbs", "g", "carbsGoal"], ["fat", "Fat", "g", "fatGoal"]];
export const MEAL_LABELS = { Breakfast: "Breakfast", Lunch: "Lunch", Dinner: "Dinner", Snack: "Snacks" };
const FOOD_VIEWS = [["count", "Most eaten"], ["protein", "Protein"], ["calories", "Calories"]];
const SHARE_GAP = 10;
export const plural = (count, word) => `${formatNumber(count)} ${word}${count === 1 ? "" : "s"}`;

// A short description of one nutrient's chart for VoiceOver.
export function nutrientSummary(title, unit, span, { typical, chart }) {
  const present = chart.filter((item) => item.value != null);
  return `${title} by ${span > 30 ? "month" : "day"}. ${typical != null ? `A typical day is ${formatNumber(typical)} ${unit}. ` : ""}`
    + (present.length ? `Highest ${formatNumber(Math.max(...present.map((item) => item.value)))} ${unit}.` : "");
}

// The full version of each card on the Insights page, shown when someone taps into it.
export function TrendDetail({ stats, goals }) {
  const hasPartial = NUTRIENTS.some(([field]) => stats.metrics[field].chart.some((item) => item.partial && item.value != null));
  const footnote = stats.span > 30 ? "Each bar is a month's daily average. Lighter bars are partial months."
    : hasPartial ? "Lighter bars are today and days with one meal. They don't count toward typical." : null;
  const noTypical = NUTRIENTS.every(([field]) => stats.metrics[field].typical == null);
  return <InsightCard footnote={footnote} answer={noTypical ? "Your typical day appears after three days with two or more meals." : null}>
    {NUTRIENTS.map(([field, title, unit, goalField], index) => <NutrientSection key={field} title={title} unit={unit} span={stats.span}
      metric={stats.metrics[field]} goal={Number(goals[goalField]) || null} divider={index > 0} />)}
  </InsightCard>;
}

function NutrientSection({ title, unit, span, metric, goal, divider }) {
  const [selected, setSelected] = useState(null);
  // Reading a bar has less to say, and the chart shouldn't move under the finger.
  const [headlineHeight, setHeadlineHeight] = useState(0);
  const { typical, low, high, previous, chart } = metric;
  const point = selected == null ? null : chart[selected];
  const period = PERIODS.find(({ name }) => name === (span > 30 ? "12 months" : `${span} days`)).name;
  return <View style={[styles.nutrient, divider && styles.nutrientDivider]}>
    <Text accessibilityRole="header" style={styles.nutrientName}>{title}</Text>
    <View style={[styles.headline, { minHeight: headlineHeight }]} accessibilityLiveRegion="polite"
      onLayout={({ nativeEvent: { layout } }) => setHeadlineHeight((height) => Math.max(height, layout.height))}>
      {(point || typical != null) && <Text style={styles.metric}>{formatNumber(point ? point.value : typical)} <Text style={styles.unit}>{unit}</Text></Text>}
      {point ? <Text style={styles.answer}>{point.title}</Text>
        : typical != null && <>
          <Text style={styles.answer}>Half your days are between <Strong>{formatNumber(low)}</Strong> and <Strong>{formatNumber(high)}</Strong>.</Text>
          {previous != null && <Text style={styles.answer}>Previous {period}: {formatNumber(previous)} {unit}</Text>}
        </>}
    </View>
    {!!goal && <View style={styles.goalKey}>
      <Svg width={14} height={2}><Line x1={0} x2={14} y1={1} y2={1} stroke={COLORS.textLight} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="3 4" /></Svg>
      <Text style={styles.footnote}>Goal {formatNumber(goal)} {unit}</Text>
    </View>}
    <TrendChart points={chart} goal={goal} selected={selected} onSelect={setSelected} accessibilityLabel={nutrientSummary(title, unit, span, metric)} />
  </View>;
}

export function RhythmDetail({ rhythm }) {
  return <InsightCard footnote="The dot is your usual time. Half your days fall inside the band. Times are when you logged, unless edited.">
    <DayTimeline meals={rhythm.meals} />
  </InsightCard>;
}

export function SharesDetail({ shares }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  const { meals, largest, days } = shares;
  return <InsightCard footnote={`From ${plural(days, "day")} with two or more meals. Each column adds up to 100%.`}
    answer={largest ? <>Your largest share of calories is {MEAL_LABELS[largest.meal].toLowerCase()}, at <Strong>{largest.calories}%</Strong>.</> : null}>
    <View>
      <View style={styles.shareHead}>
        {!stacked && <View style={styles.shareMeal} />}
        {NUTRIENTS.map(([field, name]) => <Text key={field} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3} style={styles.shareTitle}>{name}</Text>)}
      </View>
      {meals.map((row) => <View key={row.meal} style={[styles.shareRow, styles.divider, stacked && styles.shareRowStacked]} accessible
        accessibilityLabel={`${MEAL_LABELS[row.meal]}: ${NUTRIENTS.filter(([field]) => row[field] != null).map(([field, name]) => `${row[field]}% of ${name.toLowerCase()}`).join(", ")}`}>
        <Text style={[styles.shareName, !stacked && styles.shareMeal]}>{MEAL_LABELS[row.meal]}</Text>
        <View style={styles.shareCells}>
          {NUTRIENTS.map(([field]) => <View key={field} style={styles.shareCell}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.shareValue}>{row[field] == null ? "–" : `${row[field]}%`}</Text>
            <View style={styles.shareTrack}>
              {row[field] > 0 && <View style={[styles.shareFill, { width: `${row[field]}%` }]} />}
            </View>
          </View>)}
        </View>
      </View>)}
    </View>
  </InsightCard>;
}

export function DifferenceDetail({ difference }) {
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

export function PairBar({ value, top, color }) {
  return <View style={styles.pairRow}>
    <View style={[styles.pairBar, { backgroundColor: color, width: `${Math.max(value / top * 72, 2)}%` }]} />
    <Text style={styles.pairValue}>{formatNumber(value)} g</Text>
  </View>;
}

const KeyItem = ({ color, label }) => <View style={styles.keyItem}>
  <View style={[styles.keyDot, { backgroundColor: color }]} />
  <Text style={styles.footnote}>{label}</Text>
</View>;

export function FoodLine({ name, value, detail, isNew, divider, compact }) {
  const { iconFor } = useFoodIcons();
  return <View style={[styles.food, compact && styles.foodCompact, divider && styles.divider]} accessible accessibilityLabel={[name, value, detail, isNew && "new"].filter(Boolean).join(", ")}>
    <Text style={styles.foodIcon}>{iconFor({ foodName: name }).emoji}</Text>
    <View style={styles.foodCopy}>
      <Text numberOfLines={compact ? 1 : undefined} style={styles.foodName}>{name}</Text>
      {!!detail && <Text style={styles.footnote}>{detail}</Text>}
    </View>
    {isNew && <Text style={styles.newBadge}>New</Text>}
    {!!value && <Text style={styles.foodValue}>{value}</Text>}
  </View>;
}

export function FoodsDetail({ stats }) {
  const [view, setView] = useState("count");
  const foods = stats.foodsBy[view];
  const value = (food) => view === "count" ? `${food.count}×` : `${Math.round(food[view] / stats.foodTotals[view] * 100)}%`;
  const note = view === "count" ? null : `Share of your ${view === "protein" ? "protein" : "calories"} in this period.`;
  return <InsightCard footnote={note}>
    <Chips label="Sort foods" items={FOOD_VIEWS} value={view} onChange={setView} />
    {foods.length ? <View>
      {foods.map((food, index) => <FoodLine key={food.id} name={food.name} value={value(food)} isNew={food.isNew} divider={index > 0} />)}
    </View> : <Text style={styles.answer}>No {view} logged in this period.</Text>}
  </InsightCard>;
}

export function ProduceDetail({ produce }) {
  const { vegetables, fruits, unchecked } = produce;
  const kinds = (count, word) => `${formatNumber(count)} ${count === 1 ? "kind" : "kinds"} of ${word}`;
  const note = unchecked ? `Only foods logged by voice, text or photo are checked. ${plural(unchecked, "food")} here ${unchecked === 1 ? "wasn't" : "weren't"}.` : null;
  return <InsightCard footnote={note}
    answer={vegetables.length || fruits.length ? `${kinds(vegetables.length, "vegetable")} and ${kinds(fruits.length, "fruit")}.` : "No vegetables or fruit in the foods checked."}>
    <ProduceGroup title="Vegetables" items={vegetables} />
    <ProduceGroup title="Fruits" items={fruits} />
  </InsightCard>;
}

function ProduceGroup({ title, items }) {
  const { iconFor } = useFoodIcons();
  if (!items.length) return null;
  return <View style={styles.produceGroup}>
    <Text accessibilityRole="header" style={styles.nutrientName}>{title}</Text>
    <View style={styles.produceItems}>
      {items.map((item) => <View key={item.id} style={styles.produceItem} accessible accessibilityLabel={`${item.name}, ${plural(item.count, "time")}`}>
        <Text style={styles.produceIcon}>{iconFor({ foodName: item.name }).emoji}</Text>
        <Text style={styles.foodName}>{item.name}</Text>
        <Text style={styles.footnote}>{item.count}×</Text>
      </View>)}
    </View>
  </View>;
}

// Weekdays against weekends. The page shows only the rows named in `only`.
export function SplitTable({ split, only }) {
  const rows = [
    ["Calories", "kcal", (side) => formatNumber(side.calories)],
    ["Protein", "g", (side) => formatNumber(side.protein)],
    ["First meal time", "", (side) => formatNearClock(side.firstMeal)],
    ["Dinner time", "", (side) => formatNearClock(side.dinner)],
  ].filter(([title, , read]) => (!only || only.includes(title)) && (read(split.weekday) !== "–" || read(split.weekend) !== "–"));
  return <View>
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
  </View>;
}

export function SplitDetail({ split }) {
  return <InsightCard footnote={`Typical values, from ${plural(split.weekday.days, "weekday")} and ${plural(split.weekend.days, "weekend day")}.`}>
    <SplitTable split={split} />
  </InsightCard>;
}

const styles = StyleSheet.create({
  metric: { ...TYPOGRAPHY.metric, color: COLORS.text },
  unit: { ...TYPOGRAPHY.body, color: COLORS.text },
  answer: { ...TYPOGRAPHY.body, color: COLORS.text },
  footnote: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  nutrient: { gap: 10 },
  nutrientDivider: { marginTop: 6, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.separator },
  nutrientName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textLight },
  headline: { gap: 2 },
  goalKey: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: -6 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.separator },
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
  foodCompact: { paddingVertical: 5 },
  foodIcon: { fontSize: 24, lineHeight: 30 },
  foodCopy: { flex: 1 },
  foodName: { ...TYPOGRAPHY.body, color: COLORS.text },
  newBadge: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
  foodValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
  produceGroup: { gap: 8, marginTop: 4 },
  produceItems: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 8 },
  produceItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  produceIcon: { fontSize: 18, lineHeight: 24 },
  shareHead: { flexDirection: "row", gap: SHARE_GAP, paddingBottom: 8 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: SHARE_GAP, paddingVertical: 12 },
  shareRowStacked: { flexDirection: "column", alignItems: "stretch", gap: 6 },
  shareMeal: { width: 74 },
  shareName: { ...TYPOGRAPHY.body, color: COLORS.text },
  shareTitle: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.textLight },
  shareCells: { flex: 1, flexDirection: "row", gap: SHARE_GAP },
  shareCell: { flex: 1, gap: 4 },
  shareValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
  shareTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.track, overflow: "hidden" },
  shareFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  compareHead: { flexDirection: "row", paddingBottom: 8 },
  compareRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  compareLabel: { flex: 1 },
  compareName: { ...TYPOGRAPHY.body, color: COLORS.text },
  compareTitle: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.textLight, textAlign: "right" },
  compareValue: { ...TYPOGRAPHY.bodyMedium, flex: 1, color: COLORS.text, textAlign: "right", fontVariant: ["tabular-nums"] },
  compareUnit: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
});
