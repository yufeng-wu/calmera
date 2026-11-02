import { StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

// The bough the orange hangs from on an empty day. Drawn in coordinates centered on the
// orange (x = 0 is the screen's middle), so it holds together at any phone width. Both ends
// leave through the sides of the screen, never the top, so nothing is cut off flat.
const BOUGH = "M-250 4 C-150 12 -80 45.5 2 47.5 C90 49.5 150 22 250 6 L250 10 C150 26 90 56.5 2 54.5 C-80 52.5 -150 19 -250 11 Z";
const LEAVES = [[-128, 20, 40, 1, "#7FB069"], [-100, 30, -135, .75, "#A9CF8E"], [-46, 46, -40, .8, "#A9CF8E"], [-24, 50, 80, .8, "#7FB069"],
  [62, 46, 55, .9, "#6FA35B"], [128, 30, -30, .75, "#A9CF8E"], [150, 22, 60, .9, "#6FA35B"], [-66, 41, 150, .6, "#6FA35B"]];
const TWIGS = ["M-78 41 C-84 46 -88 52 -90 60", "M134 32 C136 38 137 43 138 49", "M98 43 C98 50 98 59 98 68"];
const BLOSSOMS = [[-90, 64, 1], [34, 44, .85], [140, 54, .9], [98, 74, .8]];
const PETAL_ANGLES = [-90, -18, 54, 126, 198];
export const GROVE_HEIGHT = 340;

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

export default function GroveScene({ night = false, style }) {
  const { width } = useWindowDimensions();
  return <Svg pointerEvents="none" width={width} height={GROVE_HEIGHT} viewBox={`${-width / 2} 0 ${width} ${GROVE_HEIGHT}`} style={[StyleSheet.absoluteFill, style]}>
    {night && <Defs><LinearGradient id="groveNight" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#ECE7F5" stopOpacity={0} /><Stop offset="0.1" stopColor="#ECE7F5" stopOpacity={0.9} /><Stop offset="1" stopColor="#ECE7F5" stopOpacity={0} />
    </LinearGradient></Defs>}
    {night && <>
      <Rect x={-width / 2} y={0} width={width} height={GROVE_HEIGHT * 0.6} fill="url(#groveNight)" />
      <Path transform="translate(136 112)" d="M6 -15 A16 16 0 1 0 15 6 A13 13 0 0 1 6 -15 Z" fill="#F7EFD6" />
      <Circle cx={-130} cy={30} r={2} fill="#D9CFE6" /><Circle cx={50} cy={24} r={1.8} fill="#D9CFE6" /><Circle cx={160} cy={98} r={1.8} fill="#D9CFE6" />
    </>}
    {TWIGS.map((d) => <Path key={d} d={d} stroke="#8E6240" strokeWidth={2.4} strokeLinecap="round" />)}
    <Path d={BOUGH} fill="#8E6240" />
    {LEAVES.map(([x, y, turn, scale, color]) => <Leaf key={`${x}-${y}`} x={x} y={y} turn={turn} scale={scale} color={color} />)}
    {BLOSSOMS.map(([x, y, scale]) => <Blossom key={`${x}-${y}`} x={x} y={y} scale={scale} />)}
  </Svg>;
}
