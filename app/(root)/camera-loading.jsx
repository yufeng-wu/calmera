import LiveComingSoon from "@/components/LiveComingSoon";
import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Animated,
  StyleSheet,
  InteractionManager,
} from "react-native";
import { useRouter } from "expo-router";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
// import { loadModel, isModelLoaded, isModelWarmed } from "@/lib/tfModels";
import { loadModel, isModelLoaded } from "@/lib/tfModels";
import { COLORS } from "@/constants/colors";

export function LegacyCameraLoadingScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Preparing ML backend…");
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    let isMounted = true;

    // Heavy ML work should start only after navigation & initial rendering
    const warmUpTask = InteractionManager.runAfterInteractions(async () => {
      const steps = [
        {
          label: "Initialising TensorFlow runtime…",
          run: async () => {
            await tf.ready();
            if (tf.getBackend() !== "rn-webgl") {
              await tf.setBackend("rn-webgl");
            }
          },
        },
        {
          label: "Downloading AI models…",
          run: async () => {
            if (!isModelLoaded("oneStep")) {
              await loadModel("oneStep", { skipWarmup: true });
            }
          },
        },
        // {
        //   label: "Warming up model…",
        //   run: async () => {
        //     if (!isModelWarmed("oneStep")) {
        //       await loadModel("oneStep");
        //     }
        //   },
        // },
      ];

      for (let i = 0; i < steps.length; i++) {
        if (!isMounted) return; // early exit if user left the screen
        setStatus(steps[i].label);
        await steps[i].run();
        setProgress((i + 1) / steps.length);
      }

      // Small delay so users can see 100%
      setTimeout(() => {
        if (isMounted) {
          router.replace("/camera");
        }
      }, 300);
    });

    return () => {
      isMounted = false;
      warmUpTask.cancel && warmUpTask.cancel();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live AI @ Calmera</Text>
      <ActivityIndicator size="large" color={COLORS.primary || "#000"} />
      <Text style={styles.status}>{status}</Text>
      <View style={styles.progressBarBackground}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        ></Animated.View>
      </View>
      <Text style={styles.hintText}>
        Model setup speed depends on your device. An iPhone 14 Pro takes ~2
        seconds.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 24,
  },
  status: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
  },
  progressBarBackground: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: "#eee",
    overflow: "hidden",
    marginTop: 24,
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary || "#007AFF",
  },
  hintText: {
    marginTop: 12,
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});

export default function CameraLoadingScreen() {
  return <LiveComingSoon />;
}
