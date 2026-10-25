import { View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

const MUTED = "#E6D6CA";

// Bars for daily totals, a line for levels such as weight or sleep. Days
// without data are a small dot, so gaps read as gaps rather than zeros.
export default function Sparkline({ values, type = "bar", goal = null, width = 132, height = 44, color = COLORS.primary }) {
  const present = values.filter((value) => value != null);
  if (!present.length) return <View style={{ width, height }} />;
  const max = Math.max(...present, goal || 0) || 1;
  const min = type === "line" ? Math.min(...present) : 0;
  const range = max - min || 1;
  const step = width / values.length;
  const y = (value) => height - 3 - ((value - min) / range) * (height - 8);
  const lastIndex = values.reduce((last, value, index) => value != null ? index : last, -1);
  if (type === "line") {
    const points = values.map((value, index) => value == null ? null : `${index * step + step / 2},${y(value)}`).filter(Boolean).join(" ");
    return <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={lastIndex * step + step / 2} cy={y(values[lastIndex])} r={3.5} fill={color} />
    </Svg>;
  }
  const bar = Math.max(2, Math.min(9, step * 0.55));
  return <Svg width={width} height={height}>
    {goal ? <Line x1={0} x2={width} y1={y(goal)} y2={y(goal)} stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" /> : null}
    {values.map((value, index) => {
      const x = index * step + (step - bar) / 2;
      if (value == null) return <Circle key={index} cx={x + bar / 2} cy={height - 3} r={1.6} fill={MUTED} />;
      const top = y(value);
      return <Rect key={index} x={x} y={top} width={bar} height={Math.max(2, height - 3 - top)} rx={bar / 2}
        fill={color} fillOpacity={index === lastIndex ? 1 : 0.38} />;
    })}
  </Svg>;
}
