import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
import { loadModel, isModelLoaded, isModelWarmed } from "@/lib/tfModels";

// Using a timeout is a more forceful way to defer execution until the next
// event loop cycle, ensuring the UI thread is completely free.
const VERY_LAZY_TIMEOUT = 1500; // 1.5 seconds

export default function ModelPreloader() {
  const { isLoaded, isSignedIn } = useAuth();
  const hasKickedOff = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || hasKickedOff.current) return;

    hasKickedOff.current = true;
    console.log(
      `[ModelPreloader] User is signed in. Scheduling ML setup in ${VERY_LAZY_TIMEOUT}ms.`
    );

    const timerId = setTimeout(() => {
      console.log("[ModelPreloader] Timeout expired. Starting ML setup now.");

      const prepareAllModels = async () => {
        // 1. Initialize TensorFlow Backend
        console.log("[ModelPreloader] STEP 1: Initializing TF.js backend...");
        try {
          await tf.ready();
          await tf.setBackend("rn-webgl");
          console.log("[ModelPreloader] SUCCESS: TF.js backend is ready.");
        } catch (err) {
          console.error(
            "[ModelPreloader] FATAL: TF.js backend failed to init.",
            err
          );
          return; // Critical failure, stop here.
        }

        // 2. Prepare ROI Model
        console.log("[ModelPreloader] STEP 2: Preparing ROI model...");
        try {
          if (!isModelLoaded("roi")) {
            await loadModel("roi", { skipWarmup: true });
            console.log("[ModelPreloader] SUCCESS: ROI model downloaded.");
          }
          if (!isModelWarmed("roi")) {
            await loadModel("roi", { skipWarmup: false });
            console.log("[ModelPreloader] SUCCESS: ROI model warmed up.");
          }
        } catch (err) {
          console.error(
            "[ModelPreloader] FAILED: Could not prepare ROI model.",
            err
          );
        }

        // 3. Prepare Digit Model
        console.log("[ModelPreloader] STEP 3: Preparing Digit model...");
        try {
          if (!isModelLoaded("digit")) {
            await loadModel("digit", { skipWarmup: true });
            console.log("[ModelPreloader] SUCCESS: Digit model downloaded.");
          }
          if (!isModelWarmed("digit")) {
            await loadModel("digit", { skipWarmup: false });
            console.log("[ModelPreloader] SUCCESS: Digit model warmed up.");
          }
        } catch (err) {
          console.error(
            "[ModelPreloader] FAILED: Could not prepare Digit model.",
            err
          );
        }

        console.log("[ModelPreloader] ML setup process complete.");
      };

      prepareAllModels();
    }, VERY_LAZY_TIMEOUT);

    // Cleanup the timeout if the component unmounts
    return () => clearTimeout(timerId);
  }, [isLoaded, isSignedIn]);

  return null;
}
