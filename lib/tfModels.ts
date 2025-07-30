// Utility to load tfjs graph models that are packaged under `assets/models/<name>`
// Works in React Native + Expo via the `bundleResourceIO` helper provided by
// @tensorflow/tfjs-react-native.  Metro needs static `require()` calls, so we
// enumerate the files explicitly instead of building the path dynamically.

import * as tf from "@tensorflow/tfjs";
import { bundleResourceIO } from "@tensorflow/tfjs-react-native";

// Pre-resolved bundles for each model inside assets/models/**
const bundles = {
  roi: {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    json: require("../assets/models/roi/model.json"),
    bins: [
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("../assets/models/roi/group1-shard1of3.bin"),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("../assets/models/roi/group1-shard2of3.bin"),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("../assets/models/roi/group1-shard3of3.bin"),
    ],
  },
  digit: {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    json: require("../assets/models/digit/model.json"),
    bins: [
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("../assets/models/digit/group1-shard1of3.bin"),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("../assets/models/digit/group1-shard2of3.bin"),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("../assets/models/digit/group1-shard3of3.bin"),
    ],
  },
} as const;

type ModelName = keyof typeof bundles;

interface LoadOptions {
  /** When true the model will be loaded and cached but we **skip** the heavy
   *  executeAsync(zeros) warm-up step.  Use this for background pre-loading at
   *  app start-up so the UI thread isn’t blocked. */
  skipWarmup?: boolean;
}

const _cache: Partial<Record<ModelName, tf.GraphModel>> = {};
const _pending: Partial<Record<ModelName, Promise<tf.GraphModel>>> = {};
// Track whether each model has completed its warm-up execution
const _warmed: Partial<Record<ModelName, boolean>> = {};

async function _loadOnce(name: ModelName, options: LoadOptions = {}) {
  await tf.ready(); // make sure backend is ready
  // If model is already in memory we may still need to warm it.
  if (_cache[name]) {
    const model = _cache[name]!;
    if (!options.skipWarmup && !_warmed[name]) {
      try {
        const inputShape = [...(model.inputs[0].shape ?? [1, 640, 640, 3])].map(
          (d) => d ?? 1
        ) as number[];
        console.log(
          `[tfModels] Warming cached ${name} with zeros ${inputShape}`
        );
        const zeros = tf.zeros(inputShape);
        const out = model.execute(zeros);
        Array.isArray(out) ? tf.dispose(out) : out?.dispose?.();
        zeros.dispose();
        console.log(`[tfModels] ${name} warm-up done`);
        _warmed[name] = true;
      } catch (err) {
        console.warn(`[tfModels] Warm-up of cached ${name} failed:`, err);
      }
    }
    return model;
  }
  if (_pending[name]) {
    const existingPromise = _pending[name] as Promise<tf.GraphModel>;
    // If caller wants warm-up and it hasn't happened yet, chain a warm-up once
    // the load finishes.
    if (!options.skipWarmup && !_warmed[name]) {
      return existingPromise.then(async (m) => {
        try {
          const inputShape = [...(m.inputs[0].shape ?? [1, 640, 640, 3])].map(
            (d) => d ?? 1
          ) as number[];
          console.log(
            `[tfModels] Warming ${name} (post-load) with zeros ${inputShape}`
          );
          const zeros = tf.zeros(inputShape);

          const out = m.execute(zeros);
          Array.isArray(out) ? tf.dispose(out) : out?.dispose?.();
          zeros.dispose();
          console.log(`[tfModels] ${name} warm-up done`);
          _warmed[name] = true;
        } catch (err) {
          console.warn(`[tfModels] Warm-up of ${name} failed:`, err);
        }
        return m;
      });
    }
    return existingPromise;
  }

  console.log(`[tfModels] Loading ${name} model…`);
  const bundle = bundles[name];
  const p = tf
    .loadGraphModel(
      bundleResourceIO(bundle.json, bundle.bins as unknown as number[])
    )
    .then(async (m) => {
      _cache[name] = m;
      console.log(`[tfModels] ${name} model loaded`);

      if (!options.skipWarmup) {
        // one-time warm-up so first real call is fast.  This operation can be
        // heavy (especially for ROI: 640×640).  We allow callers to skip it
        // when doing background pre-loading to avoid blocking the UI.
        try {
          const inputShape = [...(m.inputs[0].shape ?? [1, 640, 640, 3])].map(
            (d) => d ?? 1
          ) as number[];
          console.log(`[tfModels] Warming ${name} with zeros ${inputShape}`);
          const zeros = tf.zeros(inputShape);
          const out = m.execute(zeros);
          Array.isArray(out) ? tf.dispose(out) : out?.dispose?.();
          zeros.dispose();
          console.log(`[tfModels] ${name} warm-up done`);
        } catch (err) {
          console.warn(`[tfModels] Warm-up of ${name} failed:`, err);
        }
      }
      return m;
    });

  _pending[name] = p;
  return p;
}

export function loadModel(name: ModelName, options: LoadOptions = {}) {
  return _loadOnce(name, options);
}

export function isModelLoaded(name: ModelName) {
  return Boolean(_cache[name]);
}

export function isModelLoading(name: ModelName) {
  return Boolean(_pending[name]) && !isModelLoaded(name);
}

export function isModelWarmed(name: ModelName) {
  return Boolean(_warmed[name]);
}
