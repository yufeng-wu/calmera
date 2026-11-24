import React, { useRef, useEffect, useMemo } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

// Animated SVG primitives
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

export default function ProgressRing({
  size = 36,
  strokeWidth = 6,
  value = 0,
  goal = 0,
  color = "#FF3B30",
}) {
  /* ------------------------------------------------------------------*
   * Geometry helpers
   * ------------------------------------------------------------------*/
  const radius = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);

  /* ------------------------------------------------------------------*
   * Progress animation
   * ------------------------------------------------------------------*/
  const rawProgress = goal > 0 ? value / goal : 0; // may exceed 1
  const progressAnim = useRef(new Animated.Value(rawProgress)).current;

  useEffect(() => {
    // reset then animate to new target
    progressAnim.stopAnimation(() => {
      Animated.timing(progressAnim, {
        toValue: rawProgress,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false, // SVG attributes not yet on native driver
      }).start();
    });
  }, [rawProgress, progressAnim]);

  // Ring arc (clamped to 0-1)
  const cappedProgress = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolateRight: "clamp",
  });
  const dashOffset = Animated.multiply(
    Animated.subtract(1, cappedProgress),
    circumference
  );

  // Cap rotation: one full revolution per unit of rawProgress
  const rotation = progressAnim.interpolate({
    inputRange: [0, 20], // supports 0-2000 %
    outputRange: [
      `rotate(0 ${size / 2} ${size / 2})`,
      `rotate(${360 * 20} ${size / 2} ${size / 2})`,
    ],
    extrapolate: "clamp",
  });

  /* ------------------------------------------------------------------*
   * Two-tone semicircle cap
   * ------------------------------------------------------------------*/
  const capInnerR = strokeWidth / 2; // inner = ring thickness
  const capOuterR = capInnerR + 1; // outer = 1 px larger for white border

  const makeCapPath = (r) => `
    M ${size / 2} ${size / 2 - radius - r}
    A ${r} ${r} 0 0 1 ${size / 2} ${size / 2 - radius + r}
  `;

  /* ------------------------------------------------------------------*
   * Track colour util
   * ------------------------------------------------------------------*/
  const withAlpha = (hex, alpha = 0.2) => {
    if (typeof hex !== "string" || !hex.startsWith("#")) return hex;
    const clean = hex.slice(1).padEnd(6, clean); // ensure full 6-digit
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${clean.slice(0, 6)}${a}`;
  };

  const trackColor = withAlpha(color, 0.1);

  /* ------------------------------------------------------------------*
   * Render
   * ------------------------------------------------------------------*/
  return (
    <Svg width={size} height={size}>
      {/* Grey track */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />

      {/* Progress arc */}
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        fill="none"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />

      {/* Two-tone moving cap */}
      <AnimatedG transform={rotation}>
        {/* Outer white layer */}
        <Path d={makeCapPath(capOuterR)} fill="#FFFFFF" />
        {/* Inner coloured layer */}
        <Path d={makeCapPath(capInnerR)} fill={color} />
      </AnimatedG>
    </Svg>
  );
}
