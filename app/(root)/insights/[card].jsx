import { StyleSheet, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { FormHeader, FormScreen, FormScrollView, formStyles } from "@/components/GlassForm";
import InsightCard from "@/components/insights/InsightCard";
import { FoodsDetail, PERIODS, ProduceDetail, RhythmDetail, SharesDetail, SplitDetail, TrendDetail } from "@/components/insights/InsightDetails";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useInsights } from "@/hooks/useInsights";
import usePageExit from "@/hooks/usePageExit";
import { formatRange } from "@/lib/insights/stats.mjs";

const CARDS = {
  typical: ["Average", (stats, goals) => <TrendDetail stats={stats} goals={goals} />],
  foods: ["Top foods", (stats) => stats.foods.length > 0 && <FoodsDetail stats={stats} />],
  produce: ["Veggies and fruit", (stats) => stats.produce && <ProduceDetail produce={stats.produce} />],
  rhythm: ["When you eat", (stats) => stats.rhythm && <RhythmDetail rhythm={stats.rhythm} span={stats.span} />],
  shares: ["What each meal adds", (stats) => stats.shares && <SharesDetail shares={stats.shares} />],
  split: ["Weekdays and weekends", (stats) => stats.split && <SplitDetail split={stats.split} />],
};

// Everything behind one card on the Insights page, for the period it was opened from.
export default function InsightDetail() {
  const { card, period: asked } = useLocalSearchParams();
  const leave = usePageExit("/insights");
  const period = PERIODS.find(({ id }) => id === asked) ?? PERIODS[0];
  const { stats, goals } = useInsights(period.id);
  const [title, render] = CARDS[card] ?? ["Insights", () => null];
  return <FormScreen>
    <FormHeader title={card === "typical" ? "Average day" : title} onBack={leave} />
    <FormScrollView contentContainerStyle={[formStyles.content, styles.content]} showsVerticalScrollIndicator={false}>
      {card !== "typical" && <Text style={styles.range}>{`Past ${period.name} · ${formatRange(stats.keys)}`}</Text>}
      {render(stats, goals) || <InsightCard answer="Nothing to show for this period." />}
    </FormScrollView>
  </FormScreen>;
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  range: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
});
