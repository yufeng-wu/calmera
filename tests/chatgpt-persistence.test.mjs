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


test("inactive persistence cannot start credentials or any meal write", async () => {
  await assert.rejects(saveEstimatedEntries([meal], { ...options, isActive: () => false,
    getToken: () => assert.fail("inactive persistence cannot read token"), fetchImpl: () => assert.fail("no write"),
  }), error => error.message === "meal_save_failed" && error.cancelled && !error.mayHaveSaved && error.savedEntries.length === 0);
});

test("an owner handoff before focus cleanup blocks a late newer-owner token", async () => {
  let resolveToken; let owner = "old"; let calls = 0;
  const token = new Promise(resolve => { resolveToken = resolve; });
  const pending = saveEstimatedEntries([meal, meal], { ...options, isActive: () => owner === "old", getToken: () => token,
    fetchImpl: () => { calls++; } });
  owner = "new"; resolveToken("new-owner synthetic-token");
  await assert.rejects(pending, error => error.cancelled && !error.mayHaveSaved && error.savedEntries.length === 0);
  assert.equal(calls, 0);
});

test("confirmed row parsed during owner departure is retained, but no second entry is dispatched", async () => {
  let active = true; let calls = 0;
  await assert.rejects(saveEstimatedEntries([meal, meal], { ...options, isActive: () => active,
    fetchImpl: async () => { calls++; return { ok: true, json: async () => { active = false; return { id: 1, food_name: meal.foodName }; } }; },
  }), error => error.message === "meal_save_uncertain" && error.cancelled && error.mayHaveSaved
    && error.savedEntries.length === 1 && error.savedEntries[0].foodName === meal.foodName);
  assert.equal(calls, 1);
});

test("owner departure during a later write preserves earlier entries and prevents parsing or another POST", async () => {
  let resolveReply, markStarted; let active = true; let calls = 0; let lateReads = 0;
  const reply = new Promise(resolve => { resolveReply = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const pending = saveEstimatedEntries([meal, meal, meal], { ...options, isActive: () => active, fetchImpl: async () => {
    calls++;
    if (calls === 1) return { ok: true, json: async () => ({ id: 1 }) };
    markStarted(); return reply;
  } });
  await started; active = false;
  resolveReply({ ok: true, json: async () => { lateReads++; return { id: 2 }; } });
  await assert.rejects(pending, error => error.cancelled && error.mayHaveSaved && error.savedEntries.length === 1 && error.savedEntries[0].id === 1);
  assert.equal(calls, 2); assert.equal(lateReads, 0);
});

test("late multipart JSON after external cancellation cannot mutate savedEntries or start more writes", async () => {
  let resolveJson, markStarted; let calls = 0;
  const json = new Promise(resolve => { resolveJson = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const controller = new AbortController();
  const pending = saveEstimatedEntries([meal, meal, meal], { ...options, signal: controller.signal, fetchImpl: async () => {
    calls++;
    return calls === 1 ? { ok: true, json: async () => ({ id: 1 }) }
      : { ok: true, json: () => { markStarted(); return json; } };
  } });
  await started; controller.abort(); let failure;
  await assert.rejects(pending, error => { failure = error; return error.cancelled && error.mayHaveSaved && error.savedEntries.length === 1; });
  resolveJson({ id: 2 }); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(failure.savedEntries.map(entry => entry.id), [1]); assert.equal(calls, 2);
});

test("active multipart persistence reuses one token and preserves sequential per-food saves", async () => {
  let tokenCalls = 0; const calls = [];
  const result = await saveEstimatedEntries([meal, { ...meal, foodName: "Synthetic toast" }], { ...options,
    getToken: async () => { tokenCalls++; return "synthetic-token"; }, isActive: () => true, fetchImpl: async (_, request) => {
      calls.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ id: calls.length }) };
    },
  });
  assert.equal(tokenCalls, 1); assert.deepEqual(result.map(entry => entry.id), [1, 2]);
  assert.deepEqual(calls.map(entry => entry.foodName), [meal.foodName, "Synthetic toast"]);
});
