import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Ellipse, G, Path } from "react-native-svg";
import { MOST_PRINTS, pawTrail, pawVisitor } from "@/lib/pawTrail.mjs";

// One soft shade, a little see-through, reads as a print pressed into the hill on the gold day hill and the
// lavender night one alike, so the prints never need recolouring as the sky turns.
const SHADE = "#7A4E62";
const STRENGTH = 0.3;
// Each print is drawn once, pointing up, in a small square of its own centred on its place.
const BOX = 24;
// A dog's print is a little bigger than a cat's.
const PAW_SCALE = { dog: 1.45, cat: 1.35 };
// A paw lands pad first, a touch large and a little behind its place, pressing in and sliding forward as it
// settles; the toes splay out from it a moment later.
const LAND = { duration: 320, settle: 0.55, from: 1.35, press: 0.94, shift: 2.5 };
const TOES = { after: 70, duration: 240, from: 0.4, splay: 1.15 };
// Prints come in one after another, oldest first, like the visitor trotting up to her.
const BETWEEN = 60;
// When the visitor passes, the prints it crosses brighten and lift for a moment, in turn, up the trail.
const WAVE = { up: 140, down: 220, between: 45, scale: 1.1, glow: 1.35 };
// A day's trail traces in a beat after the scene is up, so it never lands in the middle of a page change.
const AFTER_SHOW = 250;
// After coming back to the page (from logging a meal, say), a beat for the page to settle first.
const AFTER_RETURN = 350;
// The first food lands with the orange: its print follows once she has settled on the hill.
const AFTER_LANDING = 1300;

// The main pad: a dome on top for the toes to sit over, three soft lobes below. A cat's is rounder than a dog's.
const PADS = {
  dog: "M0 -2.6 C2.2 -2.6 4.9 -1.2 4.9 1.4 C4.9 3.4 3.7 4.9 2.1 4.9 C1.3 4.9 0.7 4.4 0 4.4 C-0.7 4.4 -1.3 4.9 -2.1 4.9 C-3.7 4.9 -4.9 3.4 -4.9 1.4 C-4.9 -1.2 -2.2 -2.6 0 -2.6 Z",
  cat: "M0 -2.3 C2.3 -2.3 4.1 -0.7 4.1 1.3 C4.1 3 3.1 4.3 1.8 4.3 C1.1 4.3 0.6 3.8 0 3.8 C-0.6 3.8 -1.1 4.3 -1.8 4.3 C-3.1 4.3 -4.1 3 -4.1 1.3 C-4.1 -0.7 -2.3 -2.3 0 -2.3 Z",
};
// Four toes in an arc over the pad, the outer two lower and turned out. A dog's are taller ovals set wide; a cat's
// are nearly round and closer together. Each is [x, y, rx, ry, tilt].
const TOE_SETS = {
  dog: [[-1.9, -5.5, 1.5, 1.95, -6], [1.9, -5.5, 1.5, 1.95, 6], [-4.8, -3.1, 1.35, 1.75, -30], [4.8, -3.1, 1.35, 1.75, 30]],
  cat: [[-1.6, -4.9, 1.4, 1.55, -4], [1.6, -4.9, 1.4, 1.55, 4], [-4, -2.7, 1.3, 1.4, -26], [4, -2.7, 1.3, 1.4, 26]],
};
const VIEW_BOX = `${-BOX / 2} ${-BOX / 2} ${BOX} ${BOX}`;

const PawPad = memo(function PawPad({ kind }) {
  return <Svg width={BOX} height={BOX} viewBox={VIEW_BOX}><Path d={PADS[kind]} fill={SHADE} transform={`scale(${PAW_SCALE[kind]})`} /></Svg>;
});
const PawToes = memo(function PawToes({ kind }) {
  return <Svg width={BOX} height={BOX} viewBox={VIEW_BOX}>
    <G fill={SHADE} transform={`scale(${PAW_SCALE[kind]})`}>
      {TOE_SETS[kind].map(([x, y, rx, ry, tilt]) => <Ellipse key={`${x},${y}`} cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${tilt} ${x} ${y})`} />)}
    </G>
  </Svg>;
});

const out = Easing.out(Easing.cubic);
const timing = (value, toValue, duration, delay = 0, easing = out) => Animated.timing(value, { toValue, duration, delay, easing, useNativeDriver: true });

// The day's paw trail on the hill: a dog or cat, picked by the date, leaves one print per food, climbing to the
// orange, newest at her feet. Still drawings between events: each print is two small drawings (pad and toes), drawn
// once, and moved only by transforms and opacity on the native driver. Motion happens only when something happens,
// and is over in about a second: the trail traces in when a day's scene shows; when a food is logged the visitor
// passes up the trail (each print brightening in turn) and a new print lands at her feet; a tap on the trail sends
// the visitor up it again. Nothing runs between. `seat` is the bottom-centre of the seated orange, in the band's
// points; `poke` counts taps on the trail.
export default memo(function PawTrail({ count, seat, seed, active, arriving, poke = 0 }) {
  const kind = pawVisitor(seed);
  const prints = useMemo(() => pawTrail({ count, seat, width: seat.width, seed, kind }), [count, seat, seed, kind]);
  const reducedMotion = useReducedMotion();
  // How many foods the trail has shown prints for, and whether this day's trail has traced in yet.
  const shown = useRef(reducedMotion ? count : 0);
  const traced = useRef(reducedMotion);
  const landing = useRef(arriving && !reducedMotion);
  // Each food's print keeps its own animated values for the day, by its place in the day (`slot`), so a new food's
  // print is born hidden and an older one keeps showing as it moves down the trail. A value set outside an
  // animation can reach the screen late, so nothing here is set after birth: every change is an animation.
  const values = useRef(new Map()).current;
  const valueFor = (slot) => {
    let value = values.get(slot);
    if (value) return value;
    const visible = reducedMotion || slot < shown.current;
    const land = new Animated.Value(visible ? 1 : 0);
    const toes = new Animated.Value(visible ? 1 : 0);
    const wave = new Animated.Value(0);
    value = {
      land, toes, wave,
      opacity: Animated.multiply(land.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), wave.interpolate({ inputRange: [0, 1], outputRange: [1, WAVE.glow] })),
      waveScale: wave.interpolate({ inputRange: [0, 1], outputRange: [1, WAVE.scale] }),
      landScale: land.interpolate({ inputRange: [0, LAND.settle, 1], outputRange: [LAND.from, LAND.press, 1] }),
      landShift: land.interpolate({ inputRange: [0, LAND.settle, 1], outputRange: [LAND.shift, 0, 0] }),
      toeOpacity: toes.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
      toeScale: toes.interpolate({ inputRange: [0, 0.7, 1], outputRange: [TOES.from, TOES.splay, 1] }),
    };
    values.set(slot, value);
    return value;
  };
  const slotOf = (k) => count - 1 - k;
  // Print k steps in: pad, then toes.
  const stepIn = (k, delay) => {
    const { land, toes } = valueFor(slotOf(k));
    return Animated.parallel([timing(land, 1, LAND.duration, delay), timing(toes, 1, TOES.duration, delay + TOES.after)]);
  };
  // Prints from `oldest` up to `newest` come in one after another, oldest first.
  const trot = (oldest, newest, delay) => Animated.parallel(Array.from({ length: oldest - newest + 1 }, (_, i) => stepIn(oldest - i, delay + i * BETWEEN)));
  // The visitor passes up the trail: the prints from `oldest` to `newest` brighten in turn.
  const pass = (oldest, newest, delay) => Animated.parallel(Array.from({ length: Math.max(0, oldest - newest + 1) }, (_, i) => {
    const { wave } = valueFor(slotOf(oldest - i));
    return Animated.sequence([timing(wave, 1, WAVE.up, delay + i * WAVE.between), timing(wave, 0, WAVE.down, 0, Easing.inOut(Easing.quad))]);
  }));

  useEffect(() => {
    const drawn = Math.min(MOST_PRINTS, count);
    // Values for prints no longer drawn are let go; a food's place is never reused within a day.
    for (const slot of [...values.keys()]) if (slot >= count || slot < count - MOST_PRINTS) values.delete(slot);
    if (reducedMotion) {
      shown.current = count;
      traced.current = true;
      values.forEach(({ land, toes }) => Animated.parallel([timing(land, 1, 1), timing(toes, 1, 1)]).start());
      return;
    }
    const fresh = Math.min(drawn, count - shown.current);
    // New prints wait, hidden, until the page is showing.
    if (!active) return;
    if (!traced.current) {
      // The day's trail traces in, oldest print first, up to her. The first food's print follows her landing.
      traced.current = true;
      trot(drawn - 1, 0, landing.current ? AFTER_LANDING : AFTER_SHOW).start();
    } else if (fresh > 0) {
      // The visitor comes up the trail it left before, and leaves a new print (or a few, one after another) at her feet.
      const older = drawn - fresh;
      (older > 0
        ? Animated.parallel([pass(drawn - 1, fresh, AFTER_RETURN), trot(fresh - 1, 0, AFTER_RETURN + older * WAVE.between)])
        : trot(fresh - 1, 0, AFTER_RETURN)).start();
    }
    // A food that went leaves the others to move up a step, still.
    landing.current = false;
    shown.current = count;
  }, [count, active, reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (poke && active && !reducedMotion && traced.current) pass(Math.min(MOST_PRINTS, count) - 1, 0, 0).start();
  }, [poke]); // eslint-disable-line react-hooks/exhaustive-deps
  // Leaving the day stops whatever is still moving; the values go with the trail.
  useEffect(() => () => values.forEach(({ land, toes, wave }) => { land.stopAnimation(); toes.stopAnimation(); wave.stopAnimation(); }), [values]);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {prints.map((print, k) => {
      const value = valueFor(slotOf(k));
      return <Animated.View key={slotOf(k)} style={[styles.print, {
        left: print.x - BOX / 2,
        top: print.y - BOX / 2,
        opacity: Animated.multiply(value.opacity, STRENGTH * print.strength),
        transform: [{ rotate: `${print.turn}deg` }, { scale: value.waveScale }],
      }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: value.landShift }, { scale: value.landScale }] }]}><PawPad kind={kind} /></Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: value.toeOpacity, transform: [{ scale: value.toeScale }] }]}><PawToes kind={kind} /></Animated.View>
      </Animated.View>;
    })}
  </View>;
});

const styles = StyleSheet.create({ print: { position: "absolute", width: BOX, height: BOX } });
