import test from "node:test";
import assert from "node:assert/strict";
import { transcribeLocalClip } from "../lib/chatgpt/transcription.mjs";
import { createPhoneStore } from "../lib/store/phone.mjs";
import { createMemoryStorage } from "../lib/store/memoryStorage.mjs";

const meal = { foodName: "Synthetic banana", quantity: "1 banana", mealType: "Snack", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 };
const createdAt = "2026-10-18T12:00:00-04:00";

test("an estimate saves only the meal's own fields, never media, tokens or transcripts", async () => {
  const storage = createMemoryStorage();
  const data = createPhoneStore({ storage });
  const [saved] = await data.createMeals([{ ...meal, access_token: "fake-openai", image: "fake-image", transcript: "fake-voice" }], { createdAt });
  assert.deepEqual(Object.keys(saved).sort(), ["calories", "carbs", "fat", "foodName", "id", "localTime", "mealType", "protein", "quantity"]);
  const everything = [...storage.data.values()].join("\n");
  for (const secret of ["fake-openai", "fake-image", "fake-voice"]) assert.doesNotMatch(everything, new RegExp(secret));
});

test("a multi-food result is checked whole before anything is saved", async () => {
  const storage = createMemoryStorage();
  const data = createPhoneStore({ storage });
  await assert.rejects(data.createMeals([meal, { ...meal, calories: -1 }], { createdAt }));
  assert.equal([...storage.data.keys()].some(key => key.startsWith("calmera.data.v1.day.")), false);
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
