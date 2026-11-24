import { memo, useMemo, useState } from "react";
import { PixelRatio, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { interpolateColor, useAnimatedProps, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { skyAt, skyFade } from "@/lib/today/skyClock.mjs";
import SkyLayer, { drawnWhen, SkyWash } from "./SkyLayer";

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
// The band is drawn 400 units wide; the visible 190 points above the tab bar map to 200 units.
export const HILL_BAND = 190;
const UNITS_PER_POINT = 200 / HILL_BAND;
// Sky drawn above the band, so the tint fades out softly and the sun's glow is never sliced flat at the band's top.
const SKY = 150;
export const SKY_POINTS = SKY / UNITS_PER_POINT;
const TONES = {
  day: { front: ["#FFD7A8", "#FFEBD3"], back: "#FFEFDD" },
  warm: { front: ["#FFC998", "#FFE3C4"], back: "#FFE6CC" },
  night: { front: ["#C1B3D6", "#EEE8F2"], back: "#DBD2E9" },
  // Halfway between gold and lavender the two mix to grey, so the turn of the light passes through rose.
  dusk: { front: ["#F3C0BE", "#FBE2DA"], back: "#F7DAD6" },
};
// The sun and moon rise from behind the hill to the orange's right, never behind her head, where the sun
// would read as a second fruit. The arc stays left of the floating Add button, whose frosted glass would
// smear the glow, and starts and ends low enough that the hill fully hides them. The orange's seat is in points
// and this drawing scales with the screen, so on a narrow phone the arc starts further along to stay clear of her.
const ARC_RIGHT = 266;
const ARC_LEFT = 158;
const ORANGE_RIGHT_EDGE = 134;
// The sun reaches this far with its glow.
const SUN_REACH = 31;
const arcFor = (width) => {
  const left = Math.max(ARC_LEFT, (ORANGE_RIGHT_EDGE + SUN_REACH) * 400 / width);
  return { x: (left + ARC_RIGHT) / 2, spread: (ARC_RIGHT - left) / 2, low: 125, rise: 125 };
};
const STARS = [[28, 22, 1.8], [300, -28, 2], [96, -40, 1.6], [352, 20, 1.8], [150, -68, 1.5], [62, -72, 1.9], [262, 8, 1.5], [336, -66, 1.6]];

const WASH_FADE = skyFade(0.8);
const WASH_RECT = { x: 0, y: -SKY, width: 400, height: SKY + 130 };
// The lowest the sun's glow reaches (the arc's low point plus the glow), already well inside the hill.
const BODIES_BOTTOM = 160;
// Above the front hill's crest (about 63) and the back hill's peak (72).
const HILL_TOP = 50;

// The scene is a stack of drawings, one per part that changes on its own, each over just the units it covers:
// changing anything inside a drawing redraws all of it. They share the scene's stretch exactly. `frame` is the
// whole scene's height in points (as laid out); each drawing's edges fall on whole pixels down from its top, so
// laying them out never rounds one by a different amount than the scene, and every unit lands where it did.
const sceneFrame = (frame, units, top, bottom) => {
  const scale = frame / (units + SKY);
  const pixel = PixelRatio.get();
  const from = Math.max(0, Math.floor((top + SKY) * scale * pixel) / pixel);
  const to = bottom >= units ? frame : Math.min(frame, Math.ceil((bottom + SKY) * scale * pixel) / pixel);
  return { style: [styles.layer, { top: from, height: to - from }], viewBox: `0 ${from / scale - SKY} 400 ${(to - from) / scale}` };
};
// A still drawing, faded as a whole by `fade` when the tint it shows comes and goes.
const Layer = ({ frame, fade, children }) => {
  const drawing = <Svg pointerEvents="none" width="100%" height="100%" viewBox={frame.viewBox} preserveAspectRatio="none">{children}</Svg>;
  return fade ? <Animated.View pointerEvents="none" style={[frame.style, fade]}>{drawing}</Animated.View> : <View pointerEvents="none" style={frame.style}>{drawing}</View>;
};
const Gradient = ({ id, colors }) => <Defs>
  <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors[0]} /><Stop offset="1" stopColor={colors[1]} /></LinearGradient>
</Defs>;

// The front hill's ridge, as drawn below: one cubic from the left edge to the crest's far side.
const RIDGE = [[0, 118], [50, 58], [150, 52], [215, 76]];
const bezier = (p0, p1, p2, p3, t) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;

// Height of the front hill's surface, in points below the band's top, at `x` points from the left
// of a band `width` points wide. Used to seat the orange on the grass whatever the phone's width.
export const hillTopAt = (x, width) => {
  const target = Math.min(RIDGE[3][0], Math.max(0, x * 400 / width));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (bezier(RIDGE[0][0], RIDGE[1][0], RIDGE[2][0], RIDGE[3][0], mid) < target) lo = mid; else hi = mid;
  }
  return bezier(RIDGE[0][1], RIDGE[1][1], RIDGE[2][1], RIDGE[3][1], (lo + hi) / 2) / UNITS_PER_POINT;
};

// Room around the orange's shadow at its widest (24 units across, scaled up 1.25 on impact, and tilted).
const SHADOW_BOX = { width: 80, height: 40 };

// The hill under the meal list, recoloured through the day. `clock` is a shared value of local minutes,
// so the sky follows the time. Stretched to the band's width and height, which reaches under the tab bar.
// Memoized: the page can resize every frame while a meal row opens, and none of that changes the hill.
export default memo(function HillScene({ clock, height, seat, ground }) {
  const arc = useMemo(() => arcFor(seat?.width || 400), [seat?.width]);
  const warmHill = useAnimatedStyle(() => ({ opacity: skyAt(clock.value).warm }));
  const nightHill = useAnimatedStyle(() => ({ opacity: skyAt(clock.value).night }));
  const duskHill = useAnimatedStyle(() => {
    const { night } = skyAt(clock.value);
    return { opacity: 4 * night * (1 - night) };
  });
  const shadow = useAnimatedProps(() => {
    const fillOpacity = Math.min(1, ground.value) * (1 - skyAt(clock.value).night);
    return { rx: 15 + ground.value * 9, fillOpacity, opacity: drawnWhen(fillOpacity) };
  });
  const nightShadow = useAnimatedProps(() => {
    const fillOpacity = Math.min(1, ground.value) * skyAt(clock.value).night;
    return { rx: 15 + ground.value * 9, fillOpacity, opacity: drawnWhen(fillOpacity) };
  });
  const below = useAnimatedStyle(() => {
    const sky = skyAt(clock.value);
    const lit = interpolateColor(sky.warm, [0, 1], [TONES.day.front[1], TONES.warm.front[1]]);
    const settled = interpolateColor(sky.night, [0, 1], [lit, TONES.night.front[1]]);
    return { backgroundColor: interpolateColor(4 * sky.night * (1 - sky.night), [0, 1], [settled, TONES.dusk.front[1]]) };
  });
  const units = Math.round(height * UNITS_PER_POINT);
  const { width } = useWindowDimensions();
  // The scene's height as laid out, once known, which is what its drawings are stretched to.
  const [laidOut, setLaidOut] = useState(null);
  const frame = laidOut?.height === height ? laidOut.frame : height + SKY_POINTS;
  const frames = useMemo(() => ({
    wash: sceneFrame(frame, units, WASH_RECT.y, WASH_RECT.y + WASH_RECT.height),
    bodies: sceneFrame(frame, units, -SKY, BODIES_BOTTOM),
    hill: sceneFrame(frame, units, HILL_TOP, units),
  }), [frame, units]);
  // The drawings stretch 400 units across the screen's width but keep their units' height, so a unit is wider than
  // it is tall; the sky's bodies are drawn that much narrower to come out round.
  const squeeze = (frame / (units + SKY)) / (width / 400);
  const shadowX = seat ? seat.x * 400 / seat.width : 0;
  const shadowY = seat ? seat.y * UNITS_PER_POINT - 1 : 0;
  const front = `M0 118 C50 58 150 52 215 76 C280 100 340 130 400 150 L400 ${units + 10} L0 ${units + 10} Z`;
  const back = `M0 150 C90 100 180 104 250 100 C320 96 370 84 400 72 L400 ${units + 10} L0 ${units + 10} Z`;
  const shadowTransform = seat ? `rotate(${seat.tilt} ${shadowX} ${shadowY})` : undefined;
  return <>
    {/* Ground below the drawing, so bouncing past the end of the page never shows where the hill stops. */}
    <Animated.View style={[styles.below, { top: height - 1 }, below]} />
    <View pointerEvents="none" style={[styles.sky, { width: "100%", height: height + SKY_POINTS }]}
      onLayout={({ nativeEvent }) => {
        const next = nativeEvent.layout.height;
        setLaidOut((was) => (was?.height === height && was.frame === next ? was : { height, frame: next }));
      }}>
      <SkyWash id="hillWash" clock={clock} fade={WASH_FADE} rect={WASH_RECT} viewBox={frames.wash.viewBox} style={frames.wash.style} />
      {/* The sun and moon set behind the hill below, which is opaque at any tint. */}
      <Layer frame={frames.bodies}><SkyLayer id="hillSky" clock={clock} arc={arc} stars={STARS} squeeze={squeeze} /></Layer>
      {/* Each hill is drawn once per tone and crossfaded, back hills then front hills in the order they were always
          drawn, so even the soft edge of the front ridge mixes the tones just as before. */}
      <Layer frame={frames.hill}><Path d={back} fill={TONES.day.back} /></Layer>
      <Layer frame={frames.hill} fade={warmHill}><Path d={back} fill={TONES.warm.back} /></Layer>
      <Layer frame={frames.hill} fade={nightHill}><Path d={back} fill={TONES.night.back} /></Layer>
      <Layer frame={frames.hill} fade={duskHill}><Path d={back} fill={TONES.dusk.back} /></Layer>
      {["day", "warm", "night", "dusk"].map((tone) => <Layer key={tone} frame={frames.hill} fade={{ warm: warmHill, night: nightHill, dusk: duskHill }[tone]}>
        <Gradient id={`hill-${tone}`} colors={TONES[tone].front} />
        <Path d={front} fill={`url(#hill-${tone})`} />
      </Layer>)}
    </View>
    {/* Her shadow animates through the drop, so it too has a small drawing of its own: changing it inside the hill's
        drawing would redraw the whole hill and sky every frame of the fall. Tilted along the ridge, so it lies on
        the hill and never on the sky. */}
    {seat && <Svg pointerEvents="none" width={SHADOW_BOX.width * seat.width / 400} height={SHADOW_BOX.height / UNITS_PER_POINT}
      viewBox={`${shadowX - SHADOW_BOX.width / 2} ${shadowY - SHADOW_BOX.height / 2} ${SHADOW_BOX.width} ${SHADOW_BOX.height}`} preserveAspectRatio="none"
      style={[styles.shadow, { left: (shadowX - SHADOW_BOX.width / 2) * seat.width / 400, top: (shadowY - SHADOW_BOX.height / 2) / UNITS_PER_POINT }]}>
      <Defs>
        <RadialGradient id="seatShadow"><Stop offset="0" stopColor="#A85F1F" stopOpacity={0.5} /><Stop offset="0.5" stopColor="#A85F1F" stopOpacity={0.24} /><Stop offset="1" stopColor="#A85F1F" stopOpacity={0} /></RadialGradient>
        <RadialGradient id="seatShadowNight"><Stop offset="0" stopColor="#6A5A8C" stopOpacity={0.5} /><Stop offset="0.5" stopColor="#6A5A8C" stopOpacity={0.24} /><Stop offset="1" stopColor="#6A5A8C" stopOpacity={0} /></RadialGradient>
      </Defs>
      <AnimatedEllipse animatedProps={shadow} cx={shadowX} cy={shadowY} ry={5} transform={shadowTransform} fill="url(#seatShadow)" />
      <AnimatedEllipse animatedProps={nightShadow} cx={shadowX} cy={shadowY} ry={5} transform={shadowTransform} fill="url(#seatShadowNight)" />
    </Svg>}
  </>;
});

const styles = StyleSheet.create({ sky: { position: "absolute", left: 0, right: 0, top: -SKY_POINTS }, layer: { position: "absolute", left: 0, right: 0 }, shadow: { position: "absolute" }, below: { position: "absolute", left: 0, right: 0, height: 1200 } });
