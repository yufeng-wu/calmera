import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { STATUS } from "@/constants/statusBar";

// Map status -> title + subtitle builder & autoHide flag
const statusConfig = {
  [STATUS.INIT]: {
    buildLines: () => ["Initializing…", "please set your scale to 0g"],
    autoHide: false,
  },
  [STATUS.READY]: {
    buildLines: () => ["calmera is ready!", "please add food"],
    autoHide: false,
  },
  [STATUS.WEIGHT_CHANGED]: {
    buildLines: ({ deltaStr }) => [`${deltaStr} detected`, "Analyzing food…"],
    autoHide: false,
  },
  [STATUS.FOOD_LOGGED]: {
    buildLines: ({ foodLines }) => ["Food Logged", foodLines],
    autoHide: true,
  },
  [STATUS.WEIGHT_CHANGE_IGNORED]: {
    buildLines: ({ deltaStr }) => [`${deltaStr} ignored`, "Likely not a food"],
    autoHide: true,
  },
};

export default function StatusBar({ status, meta }) {
  // Dynamically measured width of the status bar
  const [barWidth, setBarWidth] = useState(0);

  // Animated translation for slide-in / slide-out.
  // We initialise it to 0 and will update it once barWidth is known.
  const translateAnim = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef(null);

  // Build up to 3 display lines
  const lines = useMemo(() => {
    if (!status || !statusConfig[status]) return [];
    return statusConfig[status].buildLines(meta || {});
  }, [status, meta]);

  useEffect(() => {
    // Nothing to animate if bar not visible yet
    if (!status || barWidth === 0) return;
    const cfg = statusConfig[status];

    // Clear any previous hide timers
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Immediately show the bar – first reset position off-screen to guarantee correct slide distance
    translateAnim.setValue(-barWidth);
    // Then animate it into view
    Animated.timing(translateAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-hide if needed
    if (cfg.autoHide) {
      hideTimeoutRef.current = setTimeout(() => {
        Animated.timing(translateAnim, {
          toValue: -barWidth,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 5000);
    }

    // Cleanup on unmount
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, barWidth]);

  if (!status) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: translateAnim }],
        },
      ]}
      onLayout={(e) => {
        const { width } = e.nativeEvent.layout;
        if (width !== barWidth) {
          setBarWidth(width);
        }
      }}
    >
      {lines.map((text, idx) => (
        <Text key={idx} style={idx === 0 ? styles.title : styles.subtitle}>
          {text}
        </Text>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    // 1/3 from bottom of parent – later fine-tuned via transform
    bottom: "33%",
    backgroundColor: "rgba(0,0,0,0.7)",
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  title: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  subtitle: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
  },
});
