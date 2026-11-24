import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import SkyLayer from "./SkyLayer";

// The bough the orange hangs from on an empty day. Drawn in coordinates centered on the
// orange (x = 0 is the screen's middle), so it holds together at any phone width. Both ends
// leave through the sides of the screen, never the top, so nothing is cut off flat.
const BOUGH = "M-250 4 C-150 12 -80 45.5 2 47.5 C90 49.5 150 22 250 6 L250 10 C150 26 90 56.5 2 54.5 C-80 52.5 -150 19 -250 11 Z";
const LEAVES = [[-128, 20, 40, 1, "#7FB069"], [-100, 30, -135, .75, "#A9CF8E"], [-46, 46, -40, .8, "#A9CF8E"], [-24, 50, 80, .8, "#7FB069"],
  [62, 46, 55, .9, "#6FA35B"], [128, 30, -30, .75, "#A9CF8E"], [150, 22, 60, .9, "#6FA35B"], [-66, 41, 150, .6, "#6FA35B"]];
const TWIGS = ["M-78 41 C-84 46 -88 52 -90 60", "M134 32 C136 38 137 43 138 49", "M98 43 C98 50 98 59 98 68"];
const BLOSSOMS = [[-90, 64, 1], [34, 44, .85], [140, 54, .9], [98, 74, .8]];
const PETAL_ANGLES = [-90, -18, 54, 126, 198];
// As shares of half the screen, so they keep to the sky at any phone width.
const STARS = [[-.65, 96, 1.9], [.26, 88, 1.8], [-.84, 44, 1.6], [.78, 92, 1.7], [-.4, 104, 1.5], [.52, 20, 1.6], [-.92, 88, 1.7], [-.22, 16, 1.5]];
export const GROVE_HEIGHT = 340;
// The sky's drawing reaches down only as far as its stars, moon and halo ever do (the arc's low point plus the halo).
const SKY_HEIGHT = 156;

const Leaf = ({ x, y, turn, scale, color }) => <G transform={`translate(${x} ${y}) rotate(${turn}) scale(${scale})`}>
  <Path d="M0 0 Q13 -12 26 0 Q13 12 0 0 Z" fill={color} />
  <Path d="M4 0 L21 0" stroke="#FFFFFF" strokeOpacity={0.38} strokeWidth={1.4} strokeLinecap="round" />
</G>;

const Blossom = ({ x, y, scale }) => <G transform={`translate(${x} ${y}) scale(${scale})`}>
  {PETAL_ANGLES.map((deg) => {
    const a = deg * Math.PI / 180;
    return <Circle key={deg} cx={(4.3 * Math.cos(a)).toFixed(2)} cy={(4.3 * Math.sin(a)).toFixed(2)} r={3.5} fill="#FFF7F1" stroke="#F3C9B6" strokeWidth={0.9} />;
  })}
  <Circle r={2.4} fill="#F6C453" />
</G>;

export default function GroveScene({ clock, style }) {
  const { width } = useWindowDimensions();
  const half = width / 2;
  // With no hill to set behind, the moon dissolves at the low ends of a short arc, under the bough
  // beside the orange and clear of the greeting.
  const arc = useMemo(() => ({ x: half * 0.72, spread: half * 0.13, low: 120, rise: 40, fade: 0.2 }), [half]);
  const stars = STARS.map(([x, y, r]) => [x * half, y, r]);
  // The moon and stars change with the clock, so they get a drawing of their own behind the bough's: changing
  // anything inside a drawing redraws all of it. Both are drawn one unit to a point, from the same corner.
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, style, { width, height: GROVE_HEIGHT, flex: 0 }]}>
    <Svg pointerEvents="none" width={width} height={SKY_HEIGHT} viewBox={`${-half} 0 ${width} ${SKY_HEIGHT}`} style={styles.layer}>
      <SkyLayer id="groveSky" clock={clock} arc={arc} stars={stars} sun={false} />
    </Svg>
    <Svg pointerEvents="none" width={width} height={GROVE_HEIGHT} viewBox={`${-half} 0 ${width} ${GROVE_HEIGHT}`} style={styles.layer}>
      {TWIGS.map((d) => <Path key={d} d={d} stroke="#8E6240" strokeWidth={2.4} strokeLinecap="round" />)}
      <Path d={BOUGH} fill="#8E6240" />
      {LEAVES.map(([x, y, turn, scale, color]) => <Leaf key={`${x}-${y}`} x={x} y={y} turn={turn} scale={scale} color={color} />)}
      {BLOSSOMS.map(([x, y, scale]) => <Blossom key={`${x}-${y}`} x={x} y={y} scale={scale} />)}
    </Svg>
  </View>;
}

const styles = StyleSheet.create({ layer: { position: "absolute", left: 0, top: 0 } });
