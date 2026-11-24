import test from "node:test";
import assert from "node:assert/strict";
import { ensureVoicePermission, formatElapsed, joinTranscript, levelFromVolume, modelLabel, stageCopy, stageIndex, voiceHint, voiceStep, VOICE_HINTS, VOICE_STEPS } from "../src/lib/voice/voiceLog.mjs";

const engine = (current, asked) => {
  const calls = [];
  return { calls, getPermissionsAsync: async () => { calls.push("get"); return current; },
    requestPermissionsAsync: async () => { calls.push("request"); return asked; } };
};

test("Granted access opens the sheet without asking again", async () => {
  const speech = engine({ granted: true, canAskAgain: true });
  assert.equal(await ensureVoicePermission(speech), "granted");
  assert.deepEqual(speech.calls, ["get"]);
});

test("Undetermined access asks iOS for the microphone and speech recognition", async () => {
  const speech = engine({ granted: false, canAskAgain: true, status: "undetermined" }, { granted: true });
  assert.equal(await ensureVoicePermission(speech), "granted");
  assert.deepEqual(speech.calls, ["get", "request"]);
});

test("Access turned off in Settings is reported as blocked, without a prompt", async () => {
  const speech = engine({ granted: false, canAskAgain: false, status: "denied" });
  assert.equal(await ensureVoicePermission(speech), "blocked");
  assert.deepEqual(speech.calls, ["get"]);
});

test("Declining the prompt reports denied, or blocked when iOS won't ask again", async () => {
  assert.equal(await ensureVoicePermission(engine({ granted: false, canAskAgain: true }, { granted: false, canAskAgain: true })), "denied");
  assert.equal(await ensureVoicePermission(engine({ granted: false, canAskAgain: true }, { granted: false, canAskAgain: false })), "blocked");
  assert.equal(await ensureVoicePermission(null), "unavailable");
});

test("Volume maps to a 0–1 level with silence at zero", () => {
  assert.equal(levelFromVolume(-2), 0);
  assert.equal(levelFromVolume(-1), 0);
  assert.equal(levelFromVolume(10), 1);
  assert.equal(levelFromVolume(Number.NaN), 0);
  assert.equal(levelFromVolume(42), 1);
  assert.ok(levelFromVolume(3) > 0.5 && levelFromVolume(3) < 1);
  assert.ok(levelFromVolume(2) < levelFromVolume(5));
});

test("Words after a pause follow the words before it", () => {
  assert.equal(joinTranscript("", "two eggs"), "two eggs");
  assert.equal(joinTranscript("two eggs ", " and toast"), "two eggs and toast");
  assert.equal(joinTranscript("two eggs", ""), "two eggs");
  assert.equal(joinTranscript(undefined, undefined), "");
});

test("Elapsed time reads as minutes and seconds", () => {
  assert.equal(formatElapsed(0), "0:00");
  assert.equal(formatElapsed(7400), "0:07");
  assert.equal(formatElapsed(60000), "1:00");
  assert.equal(formatElapsed(-5), "0:00");
});

test("Stages name the model and keep their order", () => {
  assert.equal(stageCopy("sending", "Luna").title, "Sending to Luna");
  assert.equal(stageCopy("received", "Luna").detail, "Luna is picking out each food you said");
  assert.equal(stageCopy("analyzing", "Luna").title, "Estimating calories");
  assert.equal(stageCopy("unknown").title, "Sending to ChatGPT");
  assert.ok(stageIndex("received") < stageIndex("analyzing"));
  assert.equal(stageIndex("nonsense"), 0);
});

test("Model labels come from the catalog, falling back to ChatGPT", () => {
  const models = [{ slug: "luna-2", display_name: "Luna" }, { slug: "sol", display_name: " " }];
  assert.equal(modelLabel(models, "luna-2"), "Luna");
  assert.equal(modelLabel(models, "sol"), "ChatGPT");
  assert.equal(modelLabel(null, "luna-2"), "ChatGPT");
});

test("Hints cycle through the examples", () => {
  assert.equal(voiceHint(0), VOICE_HINTS[0]);
  assert.equal(voiceHint(VOICE_HINTS.length + 1), VOICE_HINTS[1]);
  assert.equal(voiceHint(-3), VOICE_HINTS[3]);
});

test("Each stage lights the matching step, and only the finish lights Ready", () => {
  assert.deepEqual(VOICE_STEPS, ["Send", "Estimate", "Review", "Ready"]);
  assert.deepEqual(["sending", "received", "analyzing", "receiving"].map(stage => voiceStep(stage)), [0, 1, 2, 2]);
  assert.equal(voiceStep("completed"), VOICE_STEPS.length);
  assert.equal(voiceStep("analyzing", true), VOICE_STEPS.length);
  assert.equal(voiceStep("nonsense"), 0);
});
