import { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Line } from "react-native-svg";
import DayTimeline from "@/components/insights/DayTimeline";
import InsightCard, { Chips, Strong } from "@/components/insights/InsightCard";
import { MealBar, MealKey, describeShares } from "@/components/insights/MealShares";
import TrendChart from "@/components/insights/TrendChart";
import { SURFACES } from "@/constants/surfaces";
import { TYPOGRAPHY } from "@/constants/typography";
import { NUTRIENT_COLORS } from "@/constants/colors";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useFoodIcons } from "@/context/FoodIconsContext";
import { formatNearClock, formatNumber, goalScale, percentOfGoal } from "@/lib/insights/stats.mjs";

export const PERIODS = [
  { id: "week", label: "Week", name: "7 days", accessibilityLabel: "Week, past 7 days" },
  { id: "month", label: "Month", name: "30 days", accessibilityLabel: "Month, past 30 days" },
  { id: "year", label: "Year", name: "12 months", accessibilityLabel: "Year, past 12 months" },
];
export const NUTRIENTS = [["calories", "Calories", "kcal", "calorieGoal"], ["protein", "Protein", "g", "proteinGoal"], ["carbs", "Carbs", "g", "carbsGoal"], ["fat", "Fat", "g", "fatGoal"]];
export const MEAL_LABELS = { Breakfast: "Breakfast", Lunch: "Lunch", Dinner: "Dinner", Snack: "Snacks" };
const FOOD_VIEWS = [["count", "Most eaten"], ["calories", "Calories"], ["protein", "Protein"], ["carbs", "Carbs"], ["fat", "Fat"]];
export const plural = (count, word) => `${formatNumber(count)} ${word}${count === 1 ? "" : "s"}`;

export const periodName = (span) => span > 30 ? "12 months" : `${span} days`;

// A short description of one nutrient's chart for VoiceOver.
export function nutrientSummary(title, unit, span, { typical, previous, chart }, goal) {
  const present = chart.filter((item) => item.value != null);
  const percent = percentOfGoal(typical, goal);
  return `${title} by ${span > 30 ? "month" : "day"}. ${typical != null ? `An average day is ${formatNumber(typical)} ${unit}${percent != null ? `, ${percent}% of goal` : ""}. ` : ""}`
    + (previous != null ? `Previous ${periodName(span)}: ${formatNumber(previous)} ${unit}. ` : "")
    + (present.length ? `Highest ${formatNumber(Math.max(...present.map((item) => item.value)))} ${unit}.` : "");
}

// One scale for all four nutrient charts, so their goal lines sit at the same height.
export function nutrientScale(stats, goals) {
  return goalScale(NUTRIENTS.map(([field, , , goalField]) => ({ goal: Number(goals[goalField]) || null,
    points: [...stats.metrics[field].chart, ...(stats.metrics[field].previousChart ?? [])] })));
}

// Explains the marks in the nutrient charts. Compact charts only have the goal.
export function ChartKey({ stats, goals, compact }) {
  const metrics = NUTRIENTS.map(([field]) => stats.metrics[field]);
  const hasGoal = NUTRIENTS.some(([, , , goalField]) => Number(goals[goalField]) > 0);
  const hasTypical = metrics.some((metric) => metric.typical != null);
  if (!hasGoal && (compact || !hasTypical)) return null;
  return <View style={styles.key}>
    {!compact && hasTypical && <View style={styles.keyItem}>
      <Svg width={14} height={2}><Line x1={0} x2={14} y1={1} y2={1} stroke={COLORS.text} strokeWidth={1.5} /></Svg>
      <Text style={styles.footnote}>Average</Text>
    </View>}
    {hasGoal && <View style={styles.keyItem}>
      <Svg width={14} height={2}><Line x1={0} x2={14} y1={1} y2={1} stroke={COLORS.textLight} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="3 4" /></Svg>
      <Text style={styles.footnote}>Goal</Text>
    </View>}
  </View>;
}

// The full version of each card on the Insights page, shown when someone taps into it.
export function TrendDetail({ stats, goals }) {
  const hasPartial = NUTRIENTS.some(([field]) => stats.metrics[field].chart.some((item) => item.partial && item.value != null));
  const footnote = [stats.span > 30 ? "Each bar is a month’s daily average. Pale bars are partial months."
    : hasPartial ? "The pale bar is today, which is still going. Today and days with one meal don’t count toward the average." : null,
  "Touch a bar to read it."].filter(Boolean).join(" ");
  const noTypical = NUTRIENTS.every(([field]) => stats.metrics[field].typical == null);
  const scale = nutrientScale(stats, goals);
  return <InsightCard footnote={footnote} answer={noTypical ? "Your average day appears after three days with two or more meals, not counting today." : null}>
    <ChartKey stats={stats} goals={goals} />
    {NUTRIENTS.map(([field, title, unit, goalField], index) => <NutrientSection key={field} color={NUTRIENT_COLORS[field]} title={title} unit={unit} span={stats.span} scale={scale}
      metric={stats.metrics[field]} goal={Number(goals[goalField]) || null} divider={index > 0} />)}
  </InsightCard>;
}

// How this period's average moved from the previous one, in the same terms as the headline.
function changeFrom(typical, previous, goal, unit, span) {
  if (typical == null || previous == null) return null;
  const percent = percentOfGoal(typical, goal);
  const difference = percent != null ? percent - percentOfGoal(previous, goal) : Math.round(typical) - Math.round(previous);
  const before = `previous ${periodName(span)}`;
  if (difference === 0) return `Same as ${before}`;
  const size = Math.abs(difference);
  return `${difference > 0 ? "↑" : "↓"} ${percent != null ? plural(size, "point") : `${formatNumber(size)} ${unit}`} from ${before}`;
}

// The previous period on the left and this one on the right, as two matching charts. On
// very large text they stack, with this period first.
function NutrientSection({ color, title, unit, span, scale, metric, goal, divider }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  const { typical, previous, chart, previousChart } = metric;
  const top = goal ? goal * scale : undefined;
  const name = periodName(span);
  return <View style={[styles.nutrient, divider && styles.nutrientDivider]}>
    <Text accessibilityRole="header" style={styles.nutrientName}>{title}</Text>
    <View style={[styles.sides, stacked && styles.sidesStacked]}>
      {previousChart && <>
        <PeriodSide color={color} heading={`Previous ${name}`} unit={unit} points={previousChart} average={previous} goal={goal} top={top}
          accessibilityLabel={nutrientSummary(`${title}, previous ${name},`, unit, span, { typical: previous, chart: previousChart }, goal)} />
        {!stacked && <View style={styles.sideDivider} />}
      </>}
      <PeriodSide color={color} heading={`Past ${name}`} unit={unit} points={chart} average={typical} goal={goal} top={top} change={changeFrom(typical, previous, goal, unit, span)}
        accessibilityLabel={nutrientSummary(title, unit, span, metric, goal)} />
    </View>
  </View>;
}

function PeriodSide({ color, heading, unit, points, average, goal, top, change, accessibilityLabel }) {
  const [selected, setSelected] = useState(null);
  // Reading a bar has less to say, and the chart shouldn't move under the finger.
  const [headlineHeight, setHeadlineHeight] = useState(0);
  const point = selected == null ? null : points[selected];
  const shown = point ? point.value : average;
  const percent = percentOfGoal(shown, goal);
  return <View style={styles.side}>
    <View style={[styles.headline, { minHeight: headlineHeight }]} accessibilityLiveRegion="polite"
      onLayout={({ nativeEvent: { layout } }) => setHeadlineHeight((height) => Math.max(height, layout.height))}>
      <Text style={styles.footnote}>{heading}</Text>
      {shown != null && <Text style={styles.metric}>{percent != null ? `${percent}%` : formatNumber(shown)} <Text style={styles.footnote}>{percent != null ? "of goal" : unit}</Text></Text>}
      {point ? <Text style={styles.footnote}>{percent != null ? `${formatNumber(point.value)} ${unit} · ` : ""}{point.title}</Text>
        : <>
          {percent != null && <Text style={styles.footnote}>{formatNumber(average)} of {formatNumber(goal)} {unit}</Text>}
          {!!change && <Text style={styles.footnote}>{change}</Text>}
        </>}
    </View>
    <TrendChart color={color} points={points} goal={goal} top={top} typical={average}
      selected={selected} onSelect={setSelected} accessibilityLabel={accessibilityLabel}
      describe={(point) => `${point.title}: ${formatNumber(point.value)} ${unit}${goal ? `, ${percentOfGoal(point.value, goal)}% of goal` : ""}`} />
  </View>;
}

// What the timing chart shows, in words, under the bigger chart.
function mealNotes(meal) {
  if (meal.clusters) {
    const habits = meal.clusters.map(({ average, count, days }) => `Around ${formatNearClock(average)}: ${plural(count, "snack")} on ${plural(days, "day")}.`);
    const other = meal.events.length - meal.clusters.reduce((all, { count }) => all + count, 0);
    if (!habits.length) return [`No regular time yet. ${plural(meal.events.length, "snack")} on ${plural(meal.days, "day")}.`];
    return other ? [...habits, `Other times: ${plural(other, "snack")}.`] : habits;
  }
  const [low, high] = [formatNearClock(meal.low), formatNearClock(meal.high)];
  return [`Average ${formatNearClock(meal.average)}. ${low === high ? `Most days at about ${low}.` : `Half your days are between ${low} and ${high}.`}`,
    `From ${plural(meal.days, "day")}.`];
}

export function RhythmDetail({ rhythm, span }) {
  return <InsightCard footnote="Each dot is one meal or snack, and the line is its average. Foods logged within 45 minutes count as one snack. Times are when you logged, unless edited.">
    <DayTimeline rhythm={rhythm} span={span} detail />
    <View style={styles.rhythmNotes}>
      {rhythm.meals.map((meal) => <View key={meal.meal} style={styles.rhythmNote}>
        <Text accessibilityRole="header" style={styles.nutrientName}>{MEAL_LABELS[meal.meal]}</Text>
        {mealNotes(meal).map((line) => <Text key={line} style={styles.answer}>{line}</Text>)}
      </View>)}
      {rhythm.tooFew.map(({ meal, days }) => <Text key={meal} style={styles.answer}>
        {`${MEAL_LABELS[meal]}: logged on ${plural(days, "day")}, too few for an average.`}
      </Text>)}
    </View>
  </InsightCard>;
}

// The overview's bars, bigger, with each meal's percent and its amount on an average day.
export function SharesDetail({ shares }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  const { meals, days } = shares;
  return <InsightCard footnote={`Each bar is 100% of that nutrient. Amounts are per day, from ${plural(days, "day")} with two or more meals.`}>
    <MealKey meals={meals} />
    {NUTRIENTS.map(([field, title, unit], index) => <View key={field} accessible accessibilityLabel={describeShares(title, meals, field)}
      style={[styles.shareSection, index > 0 && styles.nutrientDivider]}>
      <Text style={styles.nutrientName}>{title}</Text>
      <View style={styles.shareBarRow}><MealBar meals={meals} field={field} height={12} /></View>
      {stacked ? meals.map((row) => <View key={row.meal} style={styles.shareLine}>
        <Text style={styles.answer}>{MEAL_LABELS[row.meal]}</Text>
        <Text style={styles.shareValue}>{row[field] == null ? "–" : `${row[field]}%`}<Text style={styles.shareHeading}>{`  ${formatNumber(row.amounts[field])} ${unit}`}</Text></Text>
      </View>) : <View style={styles.shareColumns}>
        {meals.map((row) => <View key={row.meal} style={styles.shareColumn}>
          <Text style={styles.shareHeading}>{MEAL_LABELS[row.meal]}</Text>
          <Text style={styles.shareValue}>{row[field] == null ? "–" : `${row[field]}%`}</Text>
          <Text style={styles.shareHeading}>{`${formatNumber(row.amounts[field])} ${unit}`}</Text>
        </View>)}
      </View>}
    </View>)}
  </InsightCard>;
}

export function DifferenceDetail({ difference }) {
  const { fontScale } = useWindowDimensions();
  const { goal, higherDays, lowerDays, meals, widest, foods } = difference;
  const higherName = goal ? `${formatNumber(goal)} g or more` : "Higher days", lowerName = goal ? `Under ${formatNumber(goal)} g` : "Other days";
  const top = Math.max(...meals.flatMap((meal) => [meal.higher, meal.lower]), 1);
  const shown = meals.filter((meal) => meal.higher >= 1 || meal.lower >= 1);
  const days = `From ${plural(higherDays + lowerDays, "day")} with 2 or more meals. A pattern, not a cause.`;
  return <InsightCard title={goal ? `On days with ${formatNumber(goal)} g of protein or more` : "On your higher-protein days"}
    answer={widest ? <>Biggest difference: {MEAL_LABELS[widest.meal].toLowerCase()}, with <Strong>{formatNumber(widest.higher)} g</Strong> of protein versus <Strong>{formatNumber(widest.lower)} g</Strong>.</> : null}
    footnote={goal ? days : `Higher days are the half with the most protein. ${days}`}>
    <View style={styles.key}>
      <KeyItem color={COLORS.primary} label={`${higherName} · ${plural(higherDays, "day")}`} />
      <KeyItem color={COLORS.soft} label={`${lowerName} · ${plural(lowerDays, "day")}`} />
    </View>
    <View style={styles.pairs}>
      {shown.map((meal) => <View key={meal.meal} style={[styles.pair, fontScale > 1.3 && styles.pairStacked]} accessible
        accessibilityLabel={`${MEAL_LABELS[meal.meal]}: ${formatNumber(meal.higher)} grams of protein on higher-protein days, ${formatNumber(meal.lower)} grams on other days`}>
        <Text style={[styles.pairName, fontScale > 1.3 && styles.pairNameStacked]}>{MEAL_LABELS[meal.meal]}</Text>
        <View style={styles.pairBars}>
          <PairBar value={meal.higher} top={top} color={COLORS.primary} />
          <PairBar value={meal.lower} top={top} color={COLORS.soft} />
        </View>
      </View>)}
    </View>
    {foods.length > 0 && <View style={styles.diffFoods}>
      <Text style={styles.diffHeading}>More often on these days</Text>
      {foods.map((food) => <FoodLine key={food.name} name={food.name} entryIds={food.entryIds} detail={`${food.higher} of ${higherDays} days, versus ${food.lower} of ${lowerDays}`} />)}
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

export function FoodLine({ name, icon, entryIds, value, detail, isNew, divider, compact }) {
  const { iconFor } = useFoodIcons();
  return <View style={[styles.food, compact && styles.foodCompact, divider && styles.divider]} accessible accessibilityLabel={[name, value, detail, isNew && "new"].filter(Boolean).join(", ")}>
    <Text style={styles.foodIcon}>{iconFor(icon ?? { foodName: name, entryIds }).emoji}</Text>
    <View style={styles.foodCopy}>
      <Text numberOfLines={compact ? 1 : 2} style={styles.foodName}>{name}</Text>
      {!!detail && <Text style={styles.footnote}>{detail}</Text>}
    </View>
    {isNew && <Text style={styles.newBadge}>New</Text>}
    {!!value && <Text style={styles.foodValue}>{value}</Text>}
  </View>;
}

export function FoodsDetail({ stats }) {
  const [view, setView] = useState("count");
  const foods = stats.foodsBy[view];
  const unit = view === "calories" ? "kcal" : "g";
  const value = (food) => view === "count" ? `${food.count}×` : `${formatNumber(food[view])} ${unit}`;
  const name = FOOD_VIEWS.find(([id]) => id === view)[1].toLowerCase();
  const note = view === "count" ? null : `Total ${name} from each food in this period.`;
  return <InsightCard footnote={note}>
    <Chips label="Sort foods" items={FOOD_VIEWS} value={view} onChange={setView} />
    {foods.length ? <View>
      {foods.map((food, index) => <FoodLine key={food.id} name={food.name} icon={food.icon} value={value(food)} isNew={food.isNew} divider={index > 0} />)}
    </View> : <Text style={styles.answer}>No {view === "count" ? "foods" : name} logged in this period.</Text>}
  </InsightCard>;
}

export function ProduceDetail({ produce }) {
  const { vegetables, fruits, unchecked } = produce;
  const kinds = (count, word) => `${formatNumber(count)} ${count === 1 ? "kind" : "kinds"} of ${word}`;
  const note = unchecked ? `Only foods logged by voice, text or photo are checked, so ${plural(unchecked, "food")} ${unchecked === 1 ? "was" : "were"} skipped.` : null;
  return <InsightCard footnote={note}
    answer={vegetables.length || fruits.length ? `${kinds(vegetables.length, "vegetable")} and ${kinds(fruits.length, "fruit")}.` : "No vegetables or fruit spotted yet."}>
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
        <Text style={[styles.foodName, styles.produceName]}>{item.name}</Text>
        <Text style={styles.footnote}>{item.count}×</Text>
      </View>)}
    </View>
  </View>;
}

// Weekdays against weekends. The page shows only the rows named in `only`.
export function SplitTable({ split, only }) {
  const { fontScale } = useWindowDimensions();
  const rows = [
    ["Calories", "kcal", (side) => formatNumber(side.calories)],
    ["Protein", "g", (side) => formatNumber(side.protein)],
    ["First meal time", "", (side) => formatNearClock(side.firstMeal)],
    ["Dinner time", "", (side) => formatNearClock(side.dinner)],
  ].filter(([title, , read]) => (!only || only.includes(title)) && (read(split.weekday) !== "–" || read(split.weekend) !== "–"));
  if (fontScale > 1.3) {
    return <View>
      {rows.map(([title, unit, read], index) => <View key={title} style={[styles.compareStacked, index > 0 && styles.divider]} accessible
        accessibilityLabel={`${title}: ${read(split.weekday)} ${unit} on weekdays, ${read(split.weekend)} ${unit} on weekends`}>
        <Text style={styles.compareName}>{title}</Text>
        <Text style={styles.compareStackedValue}>Weekdays: {read(split.weekday)} {unit}</Text>
        <Text style={styles.compareStackedValue}>Weekends: {read(split.weekend)} {unit}</Text>
      </View>)}
    </View>;
  }
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
  return <InsightCard footnote={`Averages, from ${plural(split.weekday.days, "weekday")} and ${plural(split.weekend.days, "weekend day")}.`}>
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
  rhythmNotes: { gap: 12, paddingTop: 4 },
  rhythmNote: { gap: 2 },
  sides: { flexDirection: "row", gap: 12 },
  sidesStacked: { flexDirection: "column-reverse", gap: 16 },
  side: { flex: 1, minWidth: 0, gap: 10, justifyContent: "space-between" },
  sideDivider: { width: StyleSheet.hairlineWidth, backgroundColor: SURFACES.separator },
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
  produceItem: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%" },
  produceName: { flexShrink: 1 },
  produceIcon: { fontSize: 18, lineHeight: 24 },
  shareSection: { gap: 8 },
  shareBarRow: { flexDirection: "row" },
  shareColumns: { flexDirection: "row", gap: 6 },
  shareColumn: { flex: 1, minWidth: 0 },
  shareLine: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 8 },
  shareHeading: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  shareValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
  compareHead: { flexDirection: "row", paddingBottom: 8 },
  compareRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  compareLabel: { flex: 1 },
  compareName: { ...TYPOGRAPHY.body, color: COLORS.text },
  compareTitle: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.textLight, textAlign: "right" },
  compareValue: { ...TYPOGRAPHY.bodyMedium, flex: 1, color: COLORS.text, textAlign: "right", fontVariant: ["tabular-nums"] },
  compareUnit: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  compareStacked: { gap: 2, paddingVertical: 12 },
  compareStackedValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, fontVariant: ["tabular-nums"] },
});
