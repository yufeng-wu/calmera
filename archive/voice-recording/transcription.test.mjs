// From tests/chatgpt-persistence.test.mjs: the hold-to-record clip transcription tests.
import test from "node:test";
import assert from "node:assert/strict";
import { transcribeLocalClip } from "./transcription.mjs";

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
