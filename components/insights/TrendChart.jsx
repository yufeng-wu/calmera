import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

const FULL_HEIGHT = 112;
const LABEL_WIDTH = 48;
// Axis labels sit under fixed bars, so they can only grow so far.
const AXIS_TEXT = 1.3;

// A week lines up with the seven dots in Days logged above it. Longer periods space
// bars evenly across the width.
const DAY_DOT = 28;
function spacing(width, count, compact) {
  const inset = count <= 7 && !compact ? DAY_DOT / 2 : width / count / 2;
  return { inset, gap: (width - inset * 2) / Math.max(1, count - 1) };
}

// Bars for one nutrient, with a dashed line at the goal. Days without a log are a small
// dot, so gaps read as gaps rather than zeros. Touch a bar, or drag across, to read it.
// A compact chart only shows the shape: no labels, and touches go to the card around it.
export default function TrendChart({ points, goal, selected, onSelect, accessibilityLabel, compact, height: HEIGHT = FULL_HEIGHT }) {
  const FLOOR = HEIGHT - 2;
  const [width, setWidth] = useState(0);
  const latest = useRef({ points, width, selected, onSelect });
  latest.current = { points, width, selected, onSelect };
  const indexAt = (x) => {
    const { points: all, width: full } = latest.current;
    const { inset, gap } = spacing(full, all.length);
    return Math.min(all.length - 1, Math.max(0, Math.round((x - inset) / gap)));
  };
  const choose = (index) => {
    const { points: all, selected: current, onSelect } = latest.current;
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
      const { points: all, selected: current, onSelect } = latest.current;
      if (index === current || all[index].value == null) onSelect(null);
      else choose(index);
    },
  }), []);
  const present = points.map((point) => point.value).filter((value) => value != null);
  const top = Math.max(...present, Number(goal) || 0, 1);
  const y = (value) => FLOOR - (value / top) * (FLOOR - 6);
  const { inset, gap } = spacing(width, points.length, compact);
  const center = (index) => inset + index * gap;
  const bar = Math.max(3, Math.min(compact ? 10 : 16, width / points.length * 0.62));
  const touch = compact ? { pointerEvents: "none" } : { onTouchStart: (event) => { startX.current = event.nativeEvent.locationX; }, ...responder.panHandlers };
  return <View>
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ height: HEIGHT }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)} {...touch}>
      {width > 0 && <Svg width={width} height={HEIGHT}>
        {goal ? <Line x1={0} x2={width} y1={y(goal)} y2={y(goal)} stroke={COLORS.textLight} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="3 4" /> : null}
        {points.map((point, index) => {
          const x = center(index) - bar / 2;
          if (point.value == null) return <Circle key={point.key} cx={center(index)} cy={FLOOR - 1.5} r={1.5} fill={COLORS.track} />;
          const height = Math.max(3, FLOOR - y(point.value));
          return <Rect key={point.key} x={x} y={FLOOR - height} width={bar} height={height} rx={Math.min(bar, height) / 2}
            fill={selected != null ? (selected === index ? COLORS.primary : COLORS.track) : point.partial ? COLORS.soft : COLORS.primary} />;
        })}
      </Svg>}
    </View>
    {width > 0 && !compact && <View style={styles.labels}>
      {points.map((point, index) => point.label && <Text key={point.key} numberOfLines={1} maxFontSizeMultiplier={AXIS_TEXT} style={[styles.label, { left: center(index) - LABEL_WIDTH / 2 }, selected === index && styles.labelSelected]}>{point.label}</Text>)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  labels: { height: 24, marginTop: 2 },
  label: { ...TYPOGRAPHY.caption, position: "absolute", width: LABEL_WIDTH, textAlign: "center", color: COLORS.textLight },
  labelSelected: { color: COLORS.text },
});
