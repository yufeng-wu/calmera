import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

const FULL_HEIGHT = 112;
const LABEL_WIDTH = 48;
// Bars that are still partial are a paler step of the same color.
const PARTIAL_OPACITY = 0.4;
// Axis labels sit under fixed bars, so they can only grow so far.
const AXIS_TEXT = 1.3;

// Bars spaced evenly across the width.
function layout(width, count) {
  const pitch = width / Math.max(1, count);
  return {
    pitch,
    center: (index) => pitch * (index + 0.5),
    indexAt: (x) => Math.min(count - 1, Math.max(0, Math.floor(x / pitch))),
  };
}

// Bars for one nutrient, with a dashed line at the goal. Days without a log are a small
// dot, so gaps read as gaps rather than zeros. The full chart adds a solid line at the
// average. Touch a bar, or drag across, to read it. A compact chart is just the bars and the goal. It has no labels, and touches go
// to the card around it.
export default function TrendChart({ points: bars, goal, top: ceiling, typical, selected, onSelect, accessibilityLabel, compact, height = FULL_HEIGHT, color = COLORS.primary }) {
  const [width, setWidth] = useState(0);
  const latest = useRef(null);
  latest.current = { bars, width, selected, onSelect };
  const indexAt = (x) => {
    const { bars: all, width: full } = latest.current;
    return layout(full, all.length).indexAt(x);
  };
  const choose = (index) => {
    const { bars: all, selected: current, onSelect } = latest.current;
    if (all[index].value == null || index === current) return;
    Haptics.selectionAsync().catch(() => {});
    onSelect(index);
  };
  const startX = useRef(0);
  const dragging = useRef(false);
  // Nothing happens on touch down, so a page scroll starting here doesn't pick a bar.
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, { dx, dy }) => Math.abs(dx) > Math.abs(dy),
    onPanResponderGrant: () => { dragging.current = false; },
    onPanResponderMove: (_event, { dx, dy }) => {
      if (!dragging.current && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) dragging.current = true;
      if (dragging.current) choose(indexAt(startX.current + dx));
    },
    onPanResponderRelease: (_event, { dx, dy }) => {
      if (dragging.current || Math.abs(dx) > 6 || Math.abs(dy) > 6) return;
      const index = indexAt(startX.current);
      const { bars: all, selected: current, onSelect } = latest.current;
      if (index === current || all[index].value == null) onSelect(null);
      else choose(index);
    },
  }), []);
  const present = bars.map((point) => point.value).filter((value) => value != null);
  const top = ceiling ?? Math.max(...present, Number(goal) || 0, 1);
  const floor = height - 2;
  const y = (value) => floor - (Math.min(value, top) / top) * (floor - 6);
  const { pitch, center } = layout(width, bars.length);
  const bar = Math.max(compact ? 1.5 : 3, Math.min(compact ? 8 : 16, pitch * 0.62));
  const fillFor = (point, index) => {
    if (selected != null) return selected === index ? color : COLORS.track;
    return color;
  };
  const touch = compact ? { pointerEvents: "none" } : { onTouchStart: (event) => { startX.current = event.nativeEvent.locationX; }, ...responder.panHandlers };
  return <View>
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)} {...touch}>
      {width > 0 && <Svg width={width} height={height}>
        {goal ? <Line x1={0} x2={width} y1={y(goal)} y2={y(goal)} stroke={COLORS.textLight} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="3 4" /> : null}
        {bars.map((point, index) => {
          const x = center(index) - bar / 2;
          if (point.value == null) return <Circle key={point.key} cx={center(index)} cy={floor - 1.5} r={Math.min(1.5, bar / 2)} fill={COLORS.track} />;
          const barHeight = Math.max(3, floor - y(point.value));
          return <Rect key={point.key} x={x} y={floor - barHeight} width={bar} height={barHeight} rx={Math.min(bar, barHeight) / 2} fill={fillFor(point, index)} fillOpacity={selected == null && point.partial ? PARTIAL_OPACITY : 1} />;
        })}
        {!compact && typical != null && <Line x1={center(0) - bar / 2} x2={center(bars.length - 1) + bar / 2} y1={y(typical)} y2={y(typical)} stroke={COLORS.text} strokeWidth={1.5} strokeLinecap="round" />}
      </Svg>}
    </View>
    {width > 0 && !compact && <View style={styles.labels}>
      {bars.map((point, index) => point.label && <Text key={point.key} numberOfLines={1} maxFontSizeMultiplier={AXIS_TEXT} style={[styles.label, { left: center(index) - LABEL_WIDTH / 2 }, selected === index && styles.labelSelected]}>{point.label}</Text>)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  labels: { height: 24, marginTop: 2 },
  label: { ...TYPOGRAPHY.caption, position: "absolute", width: LABEL_WIDTH, textAlign: "center", color: COLORS.textLight },
  labelSelected: { color: COLORS.text },
});
