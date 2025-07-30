// mobile/lib/scale/weightDetector.js
// -------------------------------------------------------------
// Mirrors ModelTest.jsx usage of YOLO11 detect (digits) & seg (ROI)
// • Same preprocessing (resize 640x640, /255)
// • Same postproc (transpose -> decode loops -> NMS)
// • Careful tensor disposal
// • Keep NMS boxes as [y1,x1,y2,x2]; convert to [x1,y1,x2,y2] only for crops/UI
// • Returns the structure your hook expects
// -------------------------------------------------------------

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-react-native";
import { decodeJpeg } from "@tensorflow/tfjs-react-native";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { loadModel } from "@/lib/tfModels";
import { ROI_CONFIDENCE_THRESHOLD } from "./constants";

/* =========================== CONFIG =========================== */
const INPUT_SIZE = 640;

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
const ROI_CLASSES = ["display"];

const SCORE_THRESH = 0.1;
const IOU_THRESH = 0.5;
const MAX_DET = 7;

const ROI_CROP_MARGIN_FACTOR = 0.15;
const DEBUG = false;

/* ============================= API ============================ */
export async function detectWeightFromImage(uri) {
  await tf.ready();
  if (tf.getBackend() !== "rn-webgl") await tf.setBackend("rn-webgl");

  const [roiModel, digitModel] = await Promise.all([
    loadModel("roi"), // YOLO-seg head
    loadModel("digit"), // YOLO-detect head
  ]);

  // ----- Load original image -----
  const {
    tensor: origTensor,
    w: origW,
    h: origH,
  } = await loadImageTensorFromUri(uri);
  if (DEBUG) console.log("Input image:", origW, origH);

  // ----- ROI STAGE -----
  let bestROI = null;
  let croppedImageUri = null;
  let roiCropDims = null;

  const roiTensors = [];
  try {
    const pre = tf.tidy(() =>
      origTensor
        .resizeBilinear([INPUT_SIZE, INPUT_SIZE], true)
        .expandDims(0)
        .div(255)
    );
    roiTensors.push(pre);

    const outs = await roiModel.execute(pre);
    const arr = Array.isArray(outs) ? outs : [outs];
    if (arr.length < 2)
      throw new Error("ROI model must output [pred, proto] tensors");
    roiTensors.push(...arr);

    const pred = arr[0];
    const proto = arr[1];

    const pred2d = pred.transpose([0, 2, 1]).squeeze(); // [N,C]
    const protoSq = proto.squeeze(); // [M,H,W]
    roiTensors.push(pred2d, protoSq);

    const segDecoded = await decodeSegmentation(pred2d, protoSq, {
      numClasses: ROI_CLASSES.length,
      clsOffset: 4,
      maskOffset: 5,
      scoreThresh: SCORE_THRESH,
    });

    const kept = await applyNMS(
      segDecoded,
      { iouThresh: IOU_THRESH, scoreThresh: SCORE_THRESH, maxDet: MAX_DET },
      ROI_CLASSES
    );

    // Map from 640 to original & swap to [x1,y1,x2,y2] for cropping/UI
    const sx = origW / INPUT_SIZE;
    const sy = origH / INPUT_SIZE;

    const roiMapped = kept.map((d) => {
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

    bestROI = roiMapped.sort((a, b) => b.confidence - a.confidence)[0] || null;

    if (bestROI && bestROI.confidence < ROI_CONFIDENCE_THRESHOLD) {
      console.log(
        `Best ROI confidence (${bestROI.confidence}) is below threshold (${ROI_CONFIDENCE_THRESHOLD}), skipping digit stage.`
      );
      bestROI = null;
    }

    if (bestROI) {
      const [x1, y1, x2, y2] = bestROI.bbox;
      const w = x2 - x1;
      const h = y2 - y1;
      const mX = Math.round(w * ROI_CROP_MARGIN_FACTOR);
      const mY = Math.round(h * ROI_CROP_MARGIN_FACTOR);

      const cropLeft = Math.max(x1 - mX, 0);
      const cropTop = Math.max(y1 - mY, 0);
      const cropRight = Math.min(x2 + mX, origW - 1);
      const cropBottom = Math.min(y2 + mY, origH - 1);

      const cropWidth = cropRight - cropLeft;
      const cropHeight = cropBottom - cropTop;

      if (cropWidth > 1 && cropHeight > 1) {
        const saved = await ImageManipulator.manipulateAsync(
          uri,
          [
            {
              crop: {
                originX: cropLeft,
                originY: cropTop,
                width: cropWidth,
                height: cropHeight,
              },
            },
          ],
          { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
        );
        croppedImageUri = saved.uri;
        roiCropDims = { w: saved.width, h: saved.height };
      }
    }
  } catch (err) {
    console.error("ROI stage failed:", err);
  } finally {
    tf.dispose(roiTensors);
    tf.dispose(origTensor);
  }

  if (!bestROI || !croppedImageUri) {
    return {
      weight: NaN,
      ROIDetections: [],
      digitDetails: [],
      croppedImageUri: null,
      remoteDigitResult: null,
    };
  }

  // ----- DIGIT STAGE -----
  const digitRes = await detectDigitsOnCrop({
    croppedImageUri,
    digitModel,
    roiCropDims,
  });

  return {
    weight: digitRes.weight,
    ROIDetections: [bestROI],
    digitDetails: digitRes.digitDetails,
    croppedImageUri,
    remoteDigitResult: digitRes.remoteDigitResult,
  };
}

/* ==================== DIGIT STAGE ==================== */
async function detectDigitsOnCrop({
  croppedImageUri,
  digitModel,
  roiCropDims,
}) {
  const {
    tensor: cropTensor,
    w: cropW0,
    h: cropH0,
  } = await loadImageTensorFromUri(croppedImageUri);
  const cropW = roiCropDims?.w ?? cropW0;
  const cropH = roiCropDims?.h ?? cropH0;

  const tensors = [];
  let weight = NaN;
  let digitDetails = [];

  try {
    const pre = tf.tidy(() =>
      cropTensor
        .resizeBilinear([INPUT_SIZE, INPUT_SIZE], true)
        .expandDims(0)
        .div(255)
    );
    tensors.push(pre);

    const outs = await digitModel.execute(pre);
    const arr = Array.isArray(outs) ? outs : [outs];
    tensors.push(...arr);

    const pred = arr[0];
    const pred2d = pred.transpose([0, 2, 1]).squeeze(); // [N,C]
    tensors.push(pred2d);

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

    // Map back to crop & convert to [x1,y1,x2,y2]
    const sx = cropW / INPUT_SIZE;
    const sy = cropH / INPUT_SIZE;

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

    const weightStr = buildWeightString(digitDetails);
    const parsed = parseFloat(weightStr);
    weight = Number.isNaN(parsed) ? NaN : parsed;

    // per-digit crops removed
  } catch (err) {
    console.error("Digit stage failed:", err);
  } finally {
    tf.dispose(tensors);
    tf.dispose(cropTensor);
  }

  return {
    weight,
    digitDetails,
    remoteDigitResult: null,
  };
}

/* =================== IMAGE LOAD / PREPROCESS ================== */
async function loadImageTensorFromUri(uri) {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const raw = tf.util.encodeString(b64, "base64").buffer;
  const jpeg = new Uint8Array(raw);
  const tensor = decodeJpeg(jpeg); // [H,W,3] uint8
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

    // NMS expects [y1,x1,y2,x2]
    boxes.push([y1, x1, y2, x2]);
    scores.push(bestP);
    classes.push(bestC);
  }

  return { boxes, scores, classes };
}

/* ===================== SEGMENT DECODE ==================== */
async function decodeSegmentation(
  pred2d,
  proto2,
  { numClasses = 1, clsOffset = 4, maskOffset = 5, scoreThresh = 0.1 } = {}
) {
  const [N, C] = pred2d.shape;
  const [M] = proto2.shape; // proto: [M,H,W]; we don't build masks here

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

    boxes.push([y1, x1, y2, x2]); // NMS space
    scores.push(bestP);
    classes.push(bestC);

    const coeff = new Float32Array(M);
    for (let m = 0; m < M; m++) coeff[m] = data[o + maskOffset + m];
    coeffs.push(coeff);
  }

  return { boxes, scores, classes, coeffs, protoShape: proto2.shape };
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
    bbox: boxes[i].map((v) => Math.round(v)), // still [y1,x1,y2,x2]
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

  // height = y2 - y1 after reorder to [x1,y1,x2,y2]
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

  // left → right by x center
  kept.sort(
    (a, b) => (a.bbox[0] + a.bbox[2]) * 0.5 - (b.bbox[0] + b.bbox[2]) * 0.5
  );

  let seenDecimal = false;
  const cleaned = [];
  for (const d of kept) {
    if (d.label === "decimal place") {
      if (seenDecimal) continue;
      seenDecimal = true;
    }
    cleaned.push(d);
  }
  return cleaned;
}

function buildWeightString(dets) {
  return dets
    .map((d) => (d.label === "decimal place" ? "." : d.label))
    .join("");
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
