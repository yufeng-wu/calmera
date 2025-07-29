// ModelTest.jsx (refactored + deduped)
// -------------------------------------------------------------
// • Tests TWO TFJS models in Expo/React-Native:
//    1) Digit detector (YOLO11 detect head, detect task)
//    2) ROI segmenter  (YOLO11-seg head, segment task)
// • Shared utils: load image → tensor, decode → NMS, (optional) mask build
// • Focus: readability & simplicity. No duplicate helpers.
// -------------------------------------------------------------

import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, Image } from "react-native";
import * as FileSystem from "expo-file-system";
import { Asset } from "expo-asset";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
import { decodeJpeg } from "@tensorflow/tfjs-react-native";
import { loadModel } from "@/lib/tfModels"; // your loader: loadModel(key) -> tf.GraphModel

/* =========================== CONFIG =========================== */
const DIGIT_CLASSES = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "decimal place",
];
const ROI_CLASSES = ["display"]; // from ROI YAML

// Thresholds (tweak once, use everywhere)
const SCORE_THRESH = 0.05;
const IOU_THRESH = 0.45;
const MAX_DET = 10;

/* ========================= COMPONENT ========================= */
export default function ModelTest() {
  const [status, setStatus] = useState("Initializing…");
  const [results, setResults] = useState(null);

  useEffect(() => {
    (async () => {
      await tf.ready();
      await tf.setBackend("rn-webgl");
      console.log("TF backend:", tf.getBackend());

      setStatus("Loading models…");
      const digitModel = await loadModel("digit"); // detect
      const roiModel = await loadModel("roi"); // segment
      console.log("Models loaded:", {
        digit: !!digitModel,
        roi: !!roiModel,
      });

      const tests = [
        {
          src: require("../assets/models-test/IMG_3685.jpg"),
          name: "IMG_3685.jpg",
          kind: "roi",
        },
      ];

      const out = [];
      for (const t of tests) {
        setStatus(`Running ${t.kind} inference on ${t.name}…`);
        const model = t.kind === "digit" ? digitModel : roiModel;
        const res = await runYolo(t.src, t.name, model, t.kind);
        console.log("Result for", t.name, res);
        out.push(res);
      }

      console.log("FINAL out (slimmed):", out);
      setResults(out);
      setStatus("Done");
    })().catch((e) => {
      console.error(e);
      setStatus(e.message);
    });
  }, []);

  if (!results) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>{status}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontWeight: "bold" }}>Inference Results</Text>
      {/* Avoid Hermes crash by trimming huge mask arrays */}
      <Text style={{ fontFamily: "monospace", marginTop: 8 }} selectable>
        {JSON.stringify(
          results,
          (k, v) => (k === "mask" ? (v ? `[mask ${v.w}x${v.h}]` : null) : v),
          2
        )}
      </Text>

      {results.map((r) => (
        <View key={r.filename} style={{ marginTop: 24 }}>
          <Text style={{ fontWeight: "bold" }}>{r.filename}</Text>
          <Image
            source={r.imgSource}
            style={{ width: 320, height: 320, marginTop: 8 }}
            resizeMode="contain"
          />
        </View>
      ))}
    </ScrollView>
  );
}

/* ====================== CORE INFERENCE ======================= */
async function runYolo(srcModule, filename, model, kind) {
  const tensors = [];
  console.log("runYolo start", { filename, kind });
  try {
    console.log("loading & preprocessing image…");
    // 1) Load & preprocess image
    const { imgTensor, imgSource } = await loadImageAsTensor(srcModule);
    tensors.push(imgTensor);

    // 2) Forward pass
    const outs = await model.executeAsync(imgTensor);
    console.log("outs length:", Array.isArray(outs) ? outs.length : 1);
    const arr = Array.isArray(outs) ? outs : [outs];
    console.log(
      "out shapes:",
      arr.map((t) => t.shape)
    );

    if (kind === "digit") {
      // detect head: [1, 15, 8400]
      let pred2d = arr[0].transpose([0, 2, 1]).squeeze(); // [8400,15]
      tensors.push(pred2d);

      const decoded = await decodeDetections(pred2d, {
        numClasses: DIGIT_CLASSES.length,
        clsOffset: 4,
        scoreThresh: SCORE_THRESH,
      });
      console.log("digit decoded count:", decoded.boxes.length);

      const detectionsRaw = await applyNMS(
        decoded,
        {
          iouThresh: IOU_THRESH,
          scoreThresh: SCORE_THRESH,
          maxDet: MAX_DET,
        },
        DIGIT_CLASSES,
        ROI_CLASSES
      );
      console.log(
        "digit after NMS:",
        detectionsRaw.length,
        detectionsRaw.slice(0, 3)
      );

      // strip internals before returning
      const detections = detectionsRaw.map(
        ({ _origIdx, classId, ...rest }) => rest
      );
      return { filename, type: kind, detections, imgSource };
    }

    // kind === 'roi' (YOLO-seg)
    // Typical shapes: pred [1, 37, 8400], proto [1, 32, 160, 160]
    const pred = arr[0];
    const proto = arr[1];
    tensors.push(pred, proto);

    let pred2d = pred.transpose([0, 2, 1]).squeeze(); // [8400,37]
    tensors.push(pred2d);

    const segDecoded = await decodeSegmentation(pred2d, proto.squeeze(), {
      numClasses: ROI_CLASSES.length,
      clsOffset: 4, // 4 box values
      maskOffset: 5, // coeffs start after cls probs (1 class here)
      scoreThresh: SCORE_THRESH,
    });
    console.log("roi decoded count:", segDecoded.boxes.length);

    const segKeptRaw = await applyNMS(
      segDecoded,
      {
        iouThresh: IOU_THRESH,
        scoreThresh: SCORE_THRESH,
        maxDet: MAX_DET,
      },
      ROI_CLASSES,
      DIGIT_CLASSES
    );
    console.log("roi after NMS:", segKeptRaw.length, segKeptRaw.slice(0, 3));

    // Build masks for kept detections
    let masks = [];
    try {
      masks = await buildMasks(segKeptRaw, segDecoded, proto.squeeze());
      console.log("roi masks built:", masks.length);
    } catch (err) {
      console.warn("mask build failed", err);
    }

    const roiResults = segKeptRaw.map((d, i) => {
      const { _origIdx, classId, ...rest } = d;
      // keep only mask dims to avoid huge JSON
      return {
        ...rest,
        mask: masks[i] ? { w: masks[i].w, h: masks[i].h } : null,
      };
    });

    return { filename, type: kind, detections: roiResults, imgSource };
  } finally {
    tf.dispose(tensors);
    console.log("runYolo done", filename);
  }
}

/* =================== IMAGE LOAD / PREPROCESS ================== */
async function loadImageAsTensor(srcModule) {
  const asset = Asset.fromModule(srcModule);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;

  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const raw = tf.util.encodeString(b64, "base64").buffer;

  const imgTensor = tf.tidy(() =>
    decodeJpeg(new Uint8Array(raw))
      .resizeBilinear([640, 640])
      .expandDims(0)
      .div(255)
  );

  return { imgTensor, imgSource: srcModule };
}

/* =================== DETECT DECODE (no masks) ================= */
async function decodeDetections(
  pred2d,
  { numClasses = 1, clsOffset = 4, scoreThresh = 0.1 } = {}
) {
  const [N, C] = pred2d.shape;
  const data = await pred2d.data();

  const boxes = [];
  const scores = [];
  const classes = [];

  for (let i = 0; i < N; i++) {
    const o = i * C;
    const cx = data[o + 0],
      cy = data[o + 1],
      w = data[o + 2],
      h = data[o + 3];

    // best class prob
    let bestP = 0,
      bestC = -1;
    for (let c = 0; c < numClasses; c++) {
      const p = data[o + clsOffset + c];
      if (p > bestP) {
        bestP = p;
        bestC = c;
      }
    }
    if (bestP < scoreThresh) continue;

    const x1 = cx - w / 2,
      y1 = cy - h / 2,
      x2 = cx + w / 2,
      y2 = cy + h / 2;
    boxes.push([y1, x1, y2, x2]);
    scores.push(bestP);
    classes.push(bestC);
  }

  return { boxes, scores, classes };
}

/* ===================== SEGMENT DECODE (boxes + coeffs) ==================== */
async function decodeSegmentation(
  pred2d,
  proto2,
  {
    numClasses = 1,
    clsOffset = 4,
    maskOffset = 5, // where mask coefficients start
    scoreThresh = 0.1,
  } = {}
) {
  const [N, C] = pred2d.shape; // e.g. [8400, 37]
  const [M, H, W] = proto2.shape; // e.g. [32, 160, 160]

  const data = await pred2d.data();

  const boxes = [];
  const scores = [];
  const classes = [];
  const coeffs = [];

  for (let i = 0; i < N; i++) {
    const o = i * C;
    const cx = data[o + 0],
      cy = data[o + 1],
      w = data[o + 2],
      h = data[o + 3];

    // generic per-class max prob
    let bestP = 0,
      bestC = -1;
    for (let c = 0; c < numClasses; c++) {
      const p = data[o + clsOffset + c];
      if (p > bestP) {
        bestP = p;
        bestC = c;
      }
    }
    if (bestP < scoreThresh) continue;

    const x1 = cx - w / 2,
      y1 = cy - h / 2,
      x2 = cx + w / 2,
      y2 = cy + h / 2;
    boxes.push([y1, x1, y2, x2]);
    scores.push(bestP);
    classes.push(bestC);

    // mask coeffs
    const mDim = M; // coeff length equals proto channels
    const coeff = new Float32Array(mDim);
    for (let m = 0; m < mDim; m++) coeff[m] = data[o + maskOffset + m];
    coeffs.push(coeff);
  }

  return { boxes, scores, classes, coeffs, protoShape: [M, H, W] };
}

/* ==================== NMS (stores original idx) ==================== */
async function applyNMS(
  { boxes, scores, classes },
  { iouThresh = 0.45, scoreThresh = 0.1, maxDet = 100 } = {},
  primaryLabels = DIGIT_CLASSES,
  fallbackLabels = ROI_CLASSES
) {
  if (!boxes.length) return [];

  const bT = tf.tensor2d(boxes);
  const sT = tf.tensor1d(scores);
  const keepT = await tf.image.nonMaxSuppressionAsync(
    bT,
    sT,
    maxDet,
    iouThresh,
    scoreThresh
  );

  const [keepIdx, scoreArr] = await Promise.all([keepT.array(), sT.array()]);

  const dets = keepIdx.map((i) => ({
    _origIdx: i,
    bbox: boxes[i].map(Math.round),
    confidence: Number(scoreArr[i].toFixed(3)),
    classId: classes[i],
    label:
      primaryLabels[classes[i]] ??
      fallbackLabels[classes[i]] ??
      String(classes[i]),
  }));

  tf.dispose([bT, sT, keepT]);
  return dets;
}

/* ========================= BUILD MASKS ========================= */
async function buildMasks(detections, decoded, proto2) {
  // detections: after NMS, includes _origIdx
  // decoded: { coeffs, protoShape }
  // proto2: tf.Tensor [M,H,W]
  const masks = [];
  if (!detections.length) return masks;

  const [M, H, W] = decoded.protoShape;
  const protoFlat = proto2.reshape([M, H * W]); // [M, HW]

  for (const det of detections) {
    const coeff = decoded.coeffs[det._origIdx]; // Float32Array length M

    const coeffT = tf.tensor1d(coeff).reshape([1, M]); // [1, M]
    const maskHW = tf.matMul(coeffT, protoFlat).reshape([H, W]); // [H, W]
    const maskSig = maskHW.sigmoid();

    // Upscale to 640x640 to match our resized input
    const maskUp = tf.image
      .resizeBilinear(maskSig.expandDims(-1), [640, 640])
      .squeeze();

    const arr = await maskUp.data();
    masks.push({ w: 640, h: 640, data: Array.from(arr) });

    tf.dispose([coeffT, maskHW, maskSig, maskUp]);
  }

  tf.dispose(protoFlat);
  return masks;
}
