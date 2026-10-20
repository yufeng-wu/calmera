import { useEffect, useId, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { BASE_CANVAS_COLOR } from "@/constants/appearance.mjs";

const GRADIENTS = {
  dawn: ["#FFF7E9", "#FFF3EC", "#FFEFF4"],
  matcha: ["#FCFBF4", "#F0F4E8", "#EFF4E7"],
  mocha: ["#FCF8F4", "#F9F3ED", "#F6ECE4"],
};
const SPOTS = {
  glow: [
    { color: "#FFC38F", cx: 360, cy: 80, rx: 330, ry: 400, opacity: 0.62 },
    { color: "#FFE0A2", cx: 0, cy: 820, rx: 340, ry: 420, opacity: 0.54 },
    { color: "#FFBFCF", cx: 420, cy: 480, rx: 260, ry: 330, opacity: 0.22 },
  ],
  aura: [
    { color: "#D2BEFF", cx: 10, cy: 100, rx: 310, ry: 370, opacity: 0.6 },
    { color: "#FFCFAE", cx: 400, cy: 420, rx: 300, ry: 430, opacity: 0.42 },
    { color: "#B6E8D8", cx: 30, cy: 900, rx: 360, ry: 360, opacity: 0.56 },
  ],
};

// Background-only layers: no animated opacity ancestor around glass/content.
// Static vector gradients avoid per-frame SVG updates and extra blur passes.
export default function ThemeCanvas({ variant = "solid", topInset = 0, motionEnabled = true }) {
  const phase = useRef(new Animated.Value(0.5)).current;
  const gradientId = useId().replace(/:/g, "");
  const [active, setActive] = useState(AppState.currentState === "active");
  const [reduceMotion, setReduceMotion] = useState(true);
  const moving = variant === "glow" || variant === "aura";
  useEffect(() => {
    if (!motionEnabled) return;
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    const appState = AppState.addEventListener("change", value => setActive(value === "active"));
    return () => { mounted = false; motion.remove(); appState.remove(); };
  }, [motionEnabled]);
  useEffect(() => {
    phase.stopAnimation();
    if (!moving || !motionEnabled || reduceMotion || !active) { phase.setValue(0.5); return; }
    phase.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(phase, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(phase, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, motionEnabled, moving, phase, reduceMotion]);
  const spots = SPOTS[variant];
  const gradient = GRADIENTS[variant];
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={[styles.canvas, { top: -topInset }]}>
    {gradient && <LinearGradient colors={gradient}
      locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
    {spots && <Animated.View style={[styles.overscan, {
      opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }),
      transform: [
        { translateX: phase.interpolate({ inputRange: [0, 1], outputRange: [-12, 12] }) },
        { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [10, -10] }) },
        { scale: phase.interpolate({ inputRange: [0, 1], outputRange: [1.02, 1.06] }) },
      ],
    }]}>
      <Svg key={variant} width="100%" height="100%" viewBox="0 0 400 900" preserveAspectRatio="none">
        <Defs>{spots.map((spot, index) => <RadialGradient key={index} id={`calmera-canvas-${gradientId}-${variant}-${index}`}
          gradientUnits="userSpaceOnUse" cx={spot.cx} cy={spot.cy} rx={spot.rx} ry={spot.ry}>
          <Stop offset="0" stopColor={spot.color} stopOpacity={spot.opacity} />
          <Stop offset="0.55" stopColor={spot.color} stopOpacity={spot.opacity * 0.38} />
          <Stop offset="1" stopColor={spot.color} stopOpacity="0" />
        </RadialGradient>)}</Defs>
        {spots.map((spot, index) => <Rect key={index} x="0" y="0" width="400" height="900" fill={`url(#calmera-canvas-${gradientId}-${variant}-${index})`} />)}
      </Svg>
    </Animated.View>}

  </View>;
}
const styles = StyleSheet.create({
  canvas: { ...StyleSheet.absoluteFillObject, backgroundColor: BASE_CANVAS_COLOR, overflow: "hidden" },
  overscan: { position: "absolute", top: -28, bottom: -28, left: -28, right: -28 },
});
