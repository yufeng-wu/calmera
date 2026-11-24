import test from "node:test";
import assert from "node:assert/strict";
import { processRecordedMeal } from "./voiceCapture.mjs";
import { voiceFeedbackDiagnostics as trace } from "./voiceFeedbackDiagnostics.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(overrides = {}) {
  const events = [];
  const recording = { getStatusAsync: async () => ({ durationMillis: 7000 }),
    stopAndUnloadAsync: async () => { events.push("unloaded"); }, getURI: () => "file:///synthetic-meal.aiff" };
  return { events, options: { recording, onStage: stage => events.push(stage),
    transcribe: async () => "fictional banana", estimate: async () => [{ foodName: "Banana" }],
    save: async entries => entries.map(entry => ({ ...entry, id: 1 })), ...overrides } };
}

test("Processing starts synchronously on release and survives pending finalization, ASR, inference and save", async () => {
  const status = deferred(), speech = deferred(), estimate = deferred(), save = deferred();
  const { events, options } = fixture({ transcribe: () => speech.promise, estimate: () => estimate.promise, save: () => save.promise });
  options.recording.getStatusAsync = () => status.promise;
  const request = processRecordedMeal(options);
  assert.deepEqual(events, ["processing"]);
  status.resolve({ durationMillis: 7000 });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ["processing", "unloaded", "transcribing"]);
  speech.resolve("fictional banana");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.at(-1), "estimating");
  estimate.resolve([{ foodName: "Banana" }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.at(-1), "saving");
  save.resolve([{ id: 1 }]);
  assert.deepEqual(await request, [{ id: 1 }]);
  assert.equal(events.at(-1), "completed");
});

test("Short clips return an explicit error instead of silently dropping back to Voice", async () => {
  let transmitted = false;
  const { events, options } = fixture({ transcribe: async () => { transmitted = true; } });
  options.recording.getStatusAsync = async () => ({ durationMillis: 200 });
  await assert.rejects(processRecordedMeal(options), /voice_clip_too_short/);
  assert.deepEqual(events, ["processing", "unloaded"]);
  assert.equal(transmitted, false);
});

test("Reads native duration before unloading because unloading resets the iOS clock", async () => {
  const { options } = fixture();
  let duration = 7000;
  options.recording.getStatusAsync = async () => ({ durationMillis: duration });
  options.recording.stopAndUnloadAsync = async () => { duration = 0; };
  assert.equal((await processRecordedMeal(options)).length, 1);
});

test("Account disposal during recognition prevents inference and saving", async () => {
  let active = true, estimated = false;
  const { events, options } = fixture({ isActive: () => active,
    transcribe: async () => { active = false; return "fictional banana"; },
    estimate: async () => { estimated = true; return []; } });
  assert.equal(await processRecordedMeal(options), null);
  assert.equal(estimated, false);
  assert.equal(events.at(-1), "cancelled");
});

test("Recorder cleanup happens even if reading its status fails", async () => {
  const { events, options } = fixture();
  options.recording.getStatusAsync = async () => { throw new Error("recorder_unavailable"); };
  await assert.rejects(processRecordedMeal(options), /recorder_unavailable/);
  assert.equal(events.filter(event => event === "unloaded").length, 1);
});

test("Voice diagnostics accept only bounded state/timing metadata, never arbitrary payloads", () => {
  trace.mark("starting");
  trace.mark("not_an_allowed_code", { transcript: "private", token: "private" });
  for (let i = 0; i < 30; i++) trace.mark("duration", i);
  assert.equal(trace.getSnapshot().length, 20);
  assert.deepEqual(Object.keys(trace.getSnapshot()[0]).sort(), ["code", "durationMs", "elapsedMs"]);
  assert.equal(JSON.stringify(trace.getSnapshot()).includes("private"), false);
});


test("A valid recorded file can recover from the simulator reporting zero native duration", async () => {
  const { events, options } = fixture({ inspectClip: async uri => {
    assert.equal(uri, "file:///synthetic-meal.aiff");
    return { durationMs: 3900, byteCount: 10000 };
  } });
  options.recording.getStatusAsync = async () => ({ durationMillis: 0 });
  assert.equal((await processRecordedMeal(options)).length, 1);
  assert.equal(events.at(-1), "completed");
});

test("A truly empty recorded file cannot be accepted using a nonzero timer", async () => {
  const { options } = fixture({ inspectClip: async () => ({ durationMs: 0, byteCount: 100 }) });
  await assert.rejects(processRecordedMeal(options), /voice_clip_too_short/);
});
