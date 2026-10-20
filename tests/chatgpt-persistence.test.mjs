import test from "node:test";
import assert from "node:assert/strict";
import { saveEstimatedEntries } from "../lib/chatgpt/entryPersistence.mjs";
import { transcribeLocalClip } from "../lib/chatgpt/transcription.mjs";

const meal = { foodName: "Synthetic banana", quantity: "1 banana", mealType: "Snack", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 };
const options = { createdAt: "2026-10-18T12:00:00-04:00", getToken: async () => "synthetic-clerk-token", url: "https://calmera.invalid/food-entries" };

test("saves the original per-food database contract with only Clerk authorization", async () => {
  const calls = [];
  const result = await saveEstimatedEntries([{ ...meal, access_token: "fake-openai", image: "fake-image", transcript: "fake-voice" }], {
    ...options, fetchImpl: async (url, request) => {
      calls.push({ url, request });
      return { ok: true, json: async () => ({ id: 1, food_name: meal.foodName, meal_type: "Snack", local_time: "12:00:00" }) };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.headers.Authorization, "Bearer synthetic-clerk-token");
  assert.deepEqual(JSON.parse(calls[0].request.body), { ...meal, createdAt: options.createdAt });
  assert.equal(result[0].foodName, meal.foodName); assert.equal(result[0].mealType, "Snack");
});

test("validates an entire multi-food result before the first database write", async () => {
  let calls = 0;
  await assert.rejects(saveEstimatedEntries([meal, { ...meal, calories: -1 }], { ...options, fetchImpl: async () => { calls++; } }));
  assert.equal(calls, 0);
});

test("uncertain partial saves disclose saved entries and are never automatically retried", async () => {
  let calls = 0;
  await assert.rejects(saveEstimatedEntries([meal, meal], { ...options, fetchImpl: async () => {
    if (++calls === 1) return { ok: true, json: async () => ({ id: 1 }) };
    throw new Error("synthetic dropped connection");
  } }), error => error.message === "meal_save_uncertain" && error.savedEntries.length === 1);
  assert.equal(calls, 2);
});

test("missing auth, an empty meal list and server uncertainty never report success", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: false, status: 500 }; };
  await assert.rejects(saveEstimatedEntries([meal], { ...options, getToken: async () => null, fetchImpl }), /sign_in/);
  await assert.rejects(saveEstimatedEntries([], { ...options, fetchImpl }), /no_food/);
  assert.equal(calls, 0);
  await assert.rejects(saveEstimatedEntries([meal], { ...options, fetchImpl }), /uncertain/);
  assert.equal(calls, 1);
});

function recognizer({ allowed = true, supported = true, transcript = "A fictional banana" } = {}) {
  const listeners = new Map();
  let options;
  return {
    supportsOnDeviceRecognition: () => supported,
    requestPermissionsAsync: async () => ({ granted: allowed }),
    addListener: (event, callback) => { listeners.set(event, callback); return { remove: () => listeners.delete(event) }; },
    start: value => {
      options = value;
      queueMicrotask(() => {
        listeners.get("result")?.({ results: [{ transcript }] });
        listeners.get("end")?.();
      });
    },
    abort: () => {},
    get options() { return options; },
    get listenerCount() { return listeners.size; },
  };
}

test("voice uses only the newly recorded local clip, on-device recognition and no persisted ASR recording", async () => {
  const speech = recognizer();
  const result = await transcribeLocalClip(speech, "file:///synthetic/app-cache/new-clip.m4a", "zh-CN");
  assert.equal(result, "A fictional banana");
  assert.deepEqual(speech.options.audioSource, { uri: "file:///synthetic/app-cache/new-clip.m4a" });
  assert.equal(speech.options.requiresOnDeviceRecognition, true);
  assert.equal(speech.options.recordingOptions.persist, false);
  assert.equal(speech.options.lang, "zh-CN"); assert.equal(speech.listenerCount, 0);
});

test("voice permission denial, unsupported devices, remote clips and empty speech fail closed", async () => {
  for (const speech of [recognizer({ allowed: false }), recognizer({ supported: false }), recognizer({ transcript: "" })]) {
    await assert.rejects(transcribeLocalClip(speech, "file:///synthetic/new-clip.m4a", "en-US"));
  }
  const speech = recognizer();
  await assert.rejects(transcribeLocalClip(speech, "https://example.invalid/audio", "en-US"));
  assert.equal(speech.options, undefined);
});

test("aborting photo save while token lookup waits cannot write later", async () => {
  let resolve; const token = new Promise(r => { resolve = r; }); const controller = new AbortController(); let calls = 0;
  const pending = saveEstimatedEntries([meal], { ...options, signal: controller.signal, getToken: () => token,
    fetchImpl: async () => { calls++; } });
  controller.abort(); await assert.rejects(pending, /meal_save_failed/);
  resolve("late synthetic token"); await new Promise(r => setImmediate(r)); assert.equal(calls, 0);
});
