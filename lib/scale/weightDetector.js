// mobile/lib/scale/weightDetector.js
// -------------------------------------------------------------
// One-step model weight detection: directly detect digits with a single
// YOLO-style model (no ROI segmentation stage).
// -------------------------------------------------------------

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
import { decodeJpeg } from "@tensorflow/tfjs-react-native";
import { loadModel } from "@/lib/tfModels";

/* =========================== CONFIG =========================== */
const INPUT_SIZE = 640;

const DIGIT_CLASSES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const SCORE_THRESH = 0.2;
const IOU_THRESH = 0.5;
const MAX_DET = 7;

/* ============================= API ============================ */
export async function detectWeightFromImage(base64Str, scaleType) {
  await tf.ready();
  if (tf.getBackend() !== "rn-webgl") {
    await tf.setBackend("rn-webgl");
  }

  // --- Load single step model ---
  const model = await loadModel("oneStep");

  // --- Decode image ---
  const {
    tensor: origTensor,
    w: origW,
    h: origH,
  } = await loadImageTensorFromBase64(base64Str);

  const tensors = [];
  let weight = NaN;
  let digitDetails = [];

  try {
    // Pre-process
    const pre = tf.tidy(() =>
      origTensor
        .resizeBilinear([INPUT_SIZE, INPUT_SIZE], true)
        .expandDims(0)
        .div(255)
    );
    tensors.push(pre);

    // Forward pass
    const outs = await model.execute(pre);
    const arr = Array.isArray(outs) ? outs : [outs];
    tensors.push(...arr);

    // Assume first tensor is YOLO detect head [1,C,N]
    const pred = arr[0];
    const pred2d = pred.transpose([0, 2, 1]).squeeze(); // [N,C]
    tensors.push(pred2d);

    // Decode + NMS
    const decoded = await decodeDetections(pred2d, {
      numClasses: DIGIT_CLASSES.length,
      clsOffset: 4,
      scoreThresh: SCORE_THRESH,
    });

    const kept = await applyNMS(
      decoded,
      { iouThresh: IOU_THRESH, scoreThresh: SCORE_THRESH, maxDet: MAX_DET },
      DIGIT_CLASSES
    );

    // Map boxes back to original image
    const sx = origW / INPUT_SIZE;
    const sy = origH / INPUT_SIZE;

    digitDetails = kept.map((d) => {
      const [y1, x1, y2, x2] = d.bbox;
      return {
        ...d,
        bbox: [
          Math.round(x1 * sx),
          Math.round(y1 * sy),
          Math.round(x2 * sx),
          Math.round(y2 * sy),
        ],
      };
    });

    digitDetails = cleanDigits(digitDetails);

    const weightStrRaw = buildWeightString(digitDetails);
    const finalWeightStr = normalizeWeightString(weightStrRaw, scaleType);
    const parsed = parseFloat(finalWeightStr);
    weight = Number.isNaN(parsed) ? NaN : parsed;
  } catch (err) {
    console.error("One-step inference failed:", err);
  } finally {
    tf.dispose(tensors);
    tf.dispose(origTensor);
  }

  return {
    weight,
    digitDetails,
  };
}

/* =================== IMAGE LOAD / PREPROCESS ================== */
async function loadImageTensorFromBase64(base64Str) {
  if (!base64Str) {
    throw new Error("Base64 image data is required");
  }
  let b64 = base64Str.includes("base64,")
    ? base64Str.substring(base64Str.indexOf("base64,") + 7)
    : base64Str;
  b64 = b64.replace(/\s/g, "");
  const raw = tf.util.encodeString(b64, "base64").buffer;
  let tensor;
  try {
    const jpeg = new Uint8Array(raw);
    tensor = decodeJpeg(jpeg); // [H,W,3] uint8
  } catch (err) {
    console.error("decodeJpeg failed", err);
    throw err;
  }
  const [h, w] = tensor.shape;
  return { tensor, w, h };
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

/* ==================== NMS ==================== */
async function applyNMS(
  { boxes, scores, classes },
  { iouThresh = 0.45, scoreThresh = 0.1, maxDet = 100 } = {},
  labels
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
    bbox: boxes[i].map((v) => Math.round(v)), // [y1,x1,y2,x2]
    confidence: Number(scoreArr[i].toFixed(3)),
    classId: classes[i],
    label: labels?.[classes[i]] ?? String(classes[i]),
  }));

  tf.dispose([bT, sT, keepT]);
  return dets;
}

/* ===================== DIGIT CLEANUP ===================== */
const MAX_DIGITS_RENDERED = 50;
const OVERLAP_IOU_MERGE = 0.3;
const HEIGHT_OUTLIER_FRACTION = 0.5;

function cleanDigits(dets) {
  if (!dets.length) return dets;

  const heights = dets.map((d) => d.bbox[3] - d.bbox[1]);
  const medH = median(heights);
  const minH = medH * HEIGHT_OUTLIER_FRACTION;
  dets = dets.filter((d) => d.bbox[3] - d.bbox[1] >= minH);

  dets.sort((a, b) => b.confidence - a.confidence);

  const kept = [];
  for (const d of dets) {
    if (kept.some((k) => iouXY(d.bbox, k.bbox) > OVERLAP_IOU_MERGE)) continue;
    kept.push(d);
    if (kept.length >= MAX_DIGITS_RENDERED) break;
  }

  kept.sort(
    (a, b) => (a.bbox[0] + a.bbox[2]) * 0.5 - (b.bbox[0] + b.bbox[2]) * 0.5
  );

  // Model does not provide explicit decimal-place detections; return sorted digits as-is.
  return kept;
}

function buildWeightString(dets) {
  return dets.map((d) => d.label).join("");
}

// Helper to adjust weight string based on user scale type when decimal point is missing
function normalizeWeightString(weightStr, scaleType) {
  if (!weightStr) return weightStr;

  switch (scaleType) {
    case "1-decimal": {
      if (weightStr.length === 1) return weightStr;
      return `${weightStr.slice(0, -1)}.${weightStr.slice(-1)}`;
    }
    case "2-decimal": {
      if (weightStr.length <= 2) return weightStr;
      return `${weightStr.slice(0, -2)}.${weightStr.slice(-2)}`;
    }
    default:
      // "integer"
      return weightStr;
  }
}

/* ===================== UTILITIES ===================== */
function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// IOU for [x1,y1,x2,y2]
function iouXY(A, B) {
  const [ax1, ay1, ax2, ay2] = A;
  const [bx1, by1, bx2, by2] = B;
  const x1 = Math.max(ax1, bx1),
    y1 = Math.max(ay1, by1);
  const x2 = Math.min(ax2, bx2),
    y2 = Math.min(ay2, by2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (ax2 - ax1) * (ay2 - ay1);
  const areaB = (bx2 - bx1) * (by2 - by1);
  return areaA + areaB - inter > 0 ? inter / (areaA + areaB - inter) : 0;
}
