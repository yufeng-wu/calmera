import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, Image } from "react-native";
import * as FileSystem from "expo-file-system";
import { Asset } from "expo-asset";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
import { decodeJpeg } from "@tensorflow/tfjs-react-native";
import { loadModel } from "@/lib/tfModels";

export default function ModelTest() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Initializing…");
  // State to hold the final JSON results object
  const [results, setResults] = useState(null);

  useEffect(() => {
    (async () => {
      const tensorsToDispose = [];
      try {
        await tf.ready();
        await tf.setBackend("rn-webgl");
        setMessage("Loading ROI model…");
        const roiModel = await loadModel("roi");

        setMessage("Loading test image…");
        const asset = Asset.fromModule(
          require("../assets/models-test/IMG_3685.jpg")
        );
        await asset.downloadAsync();
        const fileUri = asset.localUri || asset.uri;

        const imgB64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const rawImageData = tf.util.encodeString(imgB64, "base64").buffer;

        // The model expects a 640x640 input
        const modelInputSize = 640;
        const imageTensor = tf.tidy(() =>
          decodeJpeg(new Uint8Array(rawImageData))
            .resizeBilinear([modelInputSize, modelInputSize])
            .expandDims(0)
            .div(255)
        );
        tensorsToDispose.push(imageTensor);

        setMessage("Running inference…");
        const startTime = Date.now();
        const rawOut = roiModel.execute(imageTensor);
        const inferenceTimeSec = (Date.now() - startTime) / 1000.0;

        Array.isArray(rawOut)
          ? tensorsToDispose.push(...rawOut)
          : tensorsToDispose.push(rawOut);

        const detectionTensor = Array.isArray(rawOut) ? rawOut[0] : rawOut;
        const processedDetections = [];
        const numClasses = 1;
        const MASK_COEFFICIENTS = 32;

        const transposed = detectionTensor.transpose([0, 2, 1]);
        const squeezed = transposed.squeeze();
        tensorsToDispose.push(transposed, squeezed);

        const [boxes, scores] = tf.tidy(() => {
          const [boxSlice, classAndMaskSlice] = tf.split(
            squeezed,
            [4, numClasses + MASK_COEFFICIENTS],
            1
          );
          const [scoreSlice] = tf.split(
            classAndMaskSlice,
            [numClasses, MASK_COEFFICIENTS],
            1
          );
          return [boxSlice, scoreSlice];
        });
        tensorsToDispose.push(boxes, scores);

        const convertedBoxes = tf.tidy(() => {
          const [cx, cy, w, h] = tf.split(boxes, 4, 1);
          const y1 = cy.sub(h.div(2));
          const x1 = cx.sub(w.div(2));
          const y2 = cy.add(h.div(2));
          const x2 = cx.add(w.div(2));
          return tf.concat([y1, x1, y2, x2], 1);
        });
        tensorsToDispose.push(convertedBoxes);

        const scoreThreshold = 0.5;
        const iouThreshold = 0.5;
        const maxOutputSize = 100;

        const finalScores = scores.squeeze();
        tensorsToDispose.push(finalScores);

        const nmsResult = await tf.image.nonMaxSuppressionWithScoreAsync(
          convertedBoxes,
          finalScores,
          maxOutputSize,
          iouThreshold,
          scoreThreshold
        );

        const selectedIndices = nmsResult.selectedIndices;
        const selectedScores = nmsResult.selectedScores;
        tensorsToDispose.push(selectedIndices, selectedScores);

        const numDetections = selectedIndices.size;
        if (numDetections > 0) {
          const selectedBoxes = tf.gather(boxes, selectedIndices);
          tensorsToDispose.push(selectedBoxes);

          const boxData = await selectedBoxes.array();
          const scoreData = await selectedScores.array();

          for (let i = 0; i < numDetections; i++) {
            const [cx, cy, w, h] = boxData[i];
            const confidence = scoreData[i];

            // Convert [cx, cy, w, h] to [xmin, ymin, xmax, ymax]
            const xmin = Math.round(cx - w / 2);
            const ymin = Math.round(cy - h / 2);
            const xmax = Math.round(cx + w / 2);
            const ymax = Math.round(cy + h / 2);

            processedDetections.push({
              label: "display",
              confidence: parseFloat(confidence.toFixed(3)),
              bbox: [xmin, ymin, xmax, ymax],
            });
          }
        }

        // Assemble the final results object in the desired format
        setResults({
          detections: processedDetections,
          inference_time_sec: parseFloat(inferenceTimeSec.toFixed(4)),
        });

        setMessage("Done");
        setReady(true);
      } catch (err) {
        console.error("An error occurred:", err);
        setMessage(err.message);
      } finally {
        tf.dispose(tensorsToDispose);
        console.log(`All ${tensorsToDispose.length} tensors disposed.`);
      }
    })();
  }, []);

  if (!ready || !results) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>{message}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontWeight: "bold" }}>Inference Results</Text>
      <Text selectable style={{ fontFamily: "monospace", marginTop: 8 }}>
        {JSON.stringify(results, null, 2)}
      </Text>

      <Text style={{ fontWeight: "bold", marginTop: 24 }}>Original Image</Text>
      <Image
        source={require("../assets/models-test/IMG_3685.jpg")}
        style={{ width: 320, height: 320, marginTop: 8 }}
        resizeMode="contain"
      />
    </ScrollView>
  );
}
