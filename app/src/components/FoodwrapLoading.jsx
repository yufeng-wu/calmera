import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { FOODWRAP_ARTWORK as art } from "@/components/FoodwrapWordmark";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { COLORS } from "@/constants/colors";

// Native-driver transforms animate the existing vector artwork, not its paths.
// The period has its own tightly cropped layer so its squash stays centered.
export default function FoodwrapLoading({ active = true, staticOnly = false, style, showCaption = true, label = "Getting your meals…" }) {
  const { width: screenWidth, fontScale: systemFontScale } = useWindowDimensions();
  const fontScale = systemFontScale;
  const breath = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const { reduceMotion, foreground } = useMotionPreference();
  const moving = active && foreground && !reduceMotion && !staticOnly;

  useEffect(() => {
    const timing = { useNativeDriver: true, isInteraction: false };
    if (!moving) {
      const settling = Animated.parallel([
        Animated.timing(lift, { ...timing, toValue: 0, duration: reduceMotion || staticOnly ? 0 : 180 }),
        Animated.timing(breath, { ...timing, toValue: 0, duration: reduceMotion || staticOnly ? 0 : 180 }),
      ]);
      settling.start();
      return () => settling.stop();
    }
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(breath, { ...timing, toValue: 1, duration: 1000, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(breath, { ...timing, toValue: 0, duration: 1000, easing: Easing.inOut(Easing.sin) }),
    ]));
    const bouncing = Animated.loop(Animated.sequence([
      Animated.timing(lift, { ...timing, toValue: 0, duration: 180 }),
      Animated.timing(lift, { ...timing, toValue: 1, duration: 310, easing: Easing.out(Easing.cubic) }),
      Animated.spring(lift, { ...timing, toValue: 0, damping: 8, stiffness: 170, mass: 0.5,
        restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 }),
      Animated.timing(lift, { ...timing, toValue: 0, duration: 650 }),
    ]));
    breathing.start();
    bouncing.start();
    return () => {
      breathing.stop();
      bouncing.stop();
    };
  }, [breath, lift, moving, reduceMotion, staticOnly]);

  const width = Math.min((26 * fontScale * art.width) / art.height, Math.max(1, screenWidth - 64));
  const unit = width / art.width;
  const height = art.height * unit;
  const dot = art.dotBounds;
  const wordMotion = {
    transform: [
      { translateY: breath.interpolate({ inputRange: [0, 1], outputRange: [0, -1.2 * fontScale] }) },
      { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] }) },
    ],
  };
  const dotMotion = { transform: [
    { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -9 * fontScale] }) },
    { scaleX: lift.interpolate({ inputRange: [-0.3, 0, 0.5, 1], outputRange: [1.18, 1, 0.93, 0.93], extrapolate: "clamp" }) },
    { scaleY: lift.interpolate({ inputRange: [-0.3, 0, 0.5, 1], outputRange: [0.8, 1, 1.07, 1.07], extrapolate: "clamp" }) },
  ] };

  return <View style={[styles.container, style]} accessible accessibilityRole="progressbar"
    accessibilityLabel={label} accessibilityState={{ busy: active }} accessibilityLiveRegion={active ? "polite" : "none"}>
    <View style={{ width, height }} pointerEvents="none" accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, wordMotion]}>
        <Svg width={width} height={height} viewBox={`0 0 ${art.width} ${art.height}`}>
          <G transform={art.transform}><Path d={art.body} fill={art.wordColor} /></G>
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: breath }]}>
          <Svg width={width} height={height} viewBox={`0 0 ${art.width} ${art.height}`}>
            <G transform={art.transform}><Path d={art.body} fill={art.dotColor} /></G>
          </Svg>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.dot, { left: dot.x * unit, top: dot.y * unit,
        width: dot.width * unit, height: dot.height * unit }, dotMotion]}>
        <Svg width={dot.width * unit} height={dot.height * unit}
          viewBox={`${dot.x} ${dot.y} ${dot.width} ${dot.height}`}>
          <G transform={art.transform}><Path d={art.dot} fill={art.dotColor} /></G>
        </Svg>
      </Animated.View>
    </View>
    {showCaption && <Text style={styles.caption} accessible={false}>{label}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 30 },
  dot: { position: "absolute" },
  caption: { color: COLORS.textLight, fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: "center" },
});
