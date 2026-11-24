import Animated, { useAnimatedProps, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { bodyAt, skyAt, starAt } from "@/lib/skyClock.mjs";

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// A flat disc inside a dimmer band of its own colour.
const SUN = { day: "#FFD27A", dusk: "#FFB657", glowDay: "#FFE2A8", glowDusk: "#FFC06B" };
const MOON = { fill: "#F5DA8E", halo: "#FFF8E2" };
const STAR = "#FFFBE8";
const STAR_POINT = 3;
export const WASH = { dusk: "#FFD3A6", night: "#C9BEE3" };
// The dusk wash is a little lighter than its gradient, so it never outweighs the night it turns into.
export const DUSK_WASH_STRENGTH = 0.875;

// A drawing skips a shape only when its `opacity` is 0, never when its fill is clear, so every shape that fades
// is switched off with it. Only ever 0 or 1: anything in between would paint the shape through a layer of its own.
export const drawnWhen = (fillOpacity) => {
  "worklet";
  return fillOpacity > 0.001 ? 1 : 0;
};

const sunProps = (clock, arc, strength) => {
  "worklet";
  const sky = skyAt(clock.value);
  const body = bodyAt(sky.sun, arc);
  const fillOpacity = strength(sky, body.opacity);
  return { cx: body.x, cy: body.y, fillOpacity, opacity: drawnWhen(fillOpacity) };
};

const Star = ({ clock, index, x, y, r, squeeze }) => {
  const props = useAnimatedProps(() => {
    const fillOpacity = starAt(clock.value, index);
    return { fillOpacity, opacity: drawnWhen(fillOpacity) };
  });
  // A little four-point sparkle: on a pale sky, its shape and warm white are what make it read as bright.
  const s = r * STAR_POINT;
  const w = s * squeeze;
  return <AnimatedPath animatedProps={props} fill={STAR} d={`M${x} ${y - s} Q${x} ${y} ${x + w} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - w} ${y} Q${x} ${y} ${x} ${y - s} Z`} />;
};

// The tint of the sky, as two views of their own that fade over the scene: each holds a still drawing of its
// gradient, so the sky changing never redraws anything. `style` places them over the scene, `viewBox` is the
// drawing's units within them, `rect` is what the tint fills and `fade` is its strength down that rectangle.
export function SkyWash({ id, clock, rect, fade, viewBox, style }) {
  const duskWash = useAnimatedStyle(() => {
    const sky = skyAt(clock.value);
    return { opacity: DUSK_WASH_STRENGTH * sky.warm * (1 - sky.night) };
  });
  const nightWash = useAnimatedStyle(() => ({ opacity: skyAt(clock.value).night }));
  const stops = (color) => fade.map(([offset, opacity]) => <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />);
  const layer = (tone, wash) => <Animated.View pointerEvents="none" style={[style, wash]}>
    <Svg pointerEvents="none" width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="none">
      <Defs>
        {/* Stops must be direct children of the gradient: wrapped in a fragment they are dropped, and it paints black. */}
        <LinearGradient id={`${id}-${tone}`} x1="0" y1="0" x2="0" y2="1">{stops(WASH[tone])}</LinearGradient>
      </Defs>
      <Rect {...rect} fill={`url(#${id}-${tone})`} />
    </Svg>
  </Animated.View>;
  return <>
    {layer("dusk", duskWash)}
    {layer("night", nightWash)}
  </>;
}

// The sun, drawn only over the hill.
function Sun({ clock, arc, squeeze }) {
  const sunBody = useAnimatedProps(() => sunProps(clock, arc, (_, opacity) => opacity));
  const sunDusk = useAnimatedProps(() => sunProps(clock, arc, (sky, opacity) => opacity * sky.warm));
  const glowDay = useAnimatedProps(() => sunProps(clock, arc, (sky, opacity) => 0.28 * opacity * (1 - sky.warm)));
  const glowDusk = useAnimatedProps(() => sunProps(clock, arc, (sky, opacity) => 0.34 * opacity * sky.warm));
  return <>
    <AnimatedEllipse animatedProps={glowDay} rx={30 * squeeze} ry={30} fill={SUN.glowDay} />
    <AnimatedEllipse animatedProps={glowDusk} rx={30 * squeeze} ry={30} fill={SUN.glowDusk} />
    <AnimatedEllipse animatedProps={sunBody} rx={18 * squeeze} ry={18} fill={SUN.day} />
    <AnimatedEllipse animatedProps={sunDusk} rx={18 * squeeze} ry={18} fill={SUN.dusk} />
  </>;
}

// What moves through the sky, for either scene: the stars, the sun and the moon. These are the only parts of a
// scene that change, so they go in a drawing of their own, placed behind the scene's still drawings so a hill can
// hide them as they set. `arc` places the sun and moon. The sun only belongs over the hill: on the bough `sun` is
// off, and only the moon and stars come out. A drawing stretched wider than it is tall passes `squeeze`, the share
// of a unit across that a unit down covers, so the sun, moon and stars stay round however wide the screen is.
export default function SkyLayer({ id, clock, arc, stars, sun = true, squeeze = 1 }) {
  const halo = useAnimatedProps(() => {
    const sky = skyAt(clock.value);
    const body = bodyAt(sky.moon, arc);
    const fillOpacity = body.opacity * sky.night;
    return { cx: body.x, cy: body.y, fillOpacity, opacity: drawnWhen(fillOpacity) };
  });
  const moon = useAnimatedProps(() => {
    const sky = skyAt(clock.value);
    const { x, y, opacity } = bodyAt(sky.moon, arc);
    const fillOpacity = opacity * sky.night;
    const across = (dx) => (x + dx * squeeze).toFixed(2);
    return {
      d: `M${across(6)} ${(y - 15).toFixed(2)} A${(16 * squeeze).toFixed(2)} 16 0 1 0 ${across(15)} ${(y + 6).toFixed(2)} A${(13 * squeeze).toFixed(2)} 13 0 0 1 ${across(6)} ${(y - 15).toFixed(2)} Z`,
      fillOpacity,
      opacity: drawnWhen(fillOpacity),
    };
  });
  return <>
    <Defs>
      <RadialGradient id={`${id}-halo`}><Stop offset="0.45" stopColor={MOON.halo} stopOpacity={0.32} /><Stop offset="1" stopColor={MOON.halo} stopOpacity={0} /></RadialGradient>
    </Defs>
    {stars.map(([x, y, r], index) => <Star key={`${x}-${y}`} clock={clock} index={index} x={x} y={y} r={r} squeeze={squeeze} />)}
    {sun && <Sun clock={clock} arc={arc} squeeze={squeeze} />}
    <AnimatedEllipse animatedProps={halo} rx={30 * squeeze} ry={30} fill={`url(#${id}-halo)`} />
    <AnimatedPath animatedProps={moon} fill={MOON.fill} />
  </>;
}
