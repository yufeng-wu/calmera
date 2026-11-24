// Shared by the real recorder and dependency-injected synthetic regression tests.
// State changes contain no audio, transcript, meal, account or credential data.
export async function processRecordedMeal({ recording, isActive = () => true,
  transcribe, estimate, save, inspectClip, onStage = () => {}, onDuration = () => {}, onFileDuration = () => {} }) {
  onStage("processing");
  let finalized = false;
  try {
    // Read duration before unloading: expo-av iOS resets its clock when stopped.
    const { durationMillis = 0 } = await recording.getStatusAsync();
    onDuration(durationMillis);
    await recording.stopAndUnloadAsync();
    finalized = true;
    if (!isActive()) { onStage("cancelled"); return null; }
    const uri = recording.getURI();
    if (!uri?.startsWith("file://")) throw new Error("invalid_voice_clip");
    // Some simulator recordings report zero from expo-av despite a valid file.
    // Use actual media metadata, never the finger-hold/wall-clock duration.
    const clip = inspectClip ? await inspectClip(uri) : null;
    const measuredDuration = clip?.durationMs ?? durationMillis;
    if (clip) onFileDuration(measuredDuration);
    if (!Number.isFinite(measuredDuration) || measuredDuration < 1000) throw new Error("voice_clip_too_short");
    onStage("transcribing");
    const transcript = await transcribe(uri);
    if (!isActive()) { onStage("cancelled"); return null; }
    onStage("estimating");
    const entries = await estimate(transcript);
    if (!entries.length) throw new Error("no_food_detected");
    if (!isActive()) { onStage("cancelled"); return null; }
    onStage("saving");
    const saved = await save(entries);
    onStage("completed");
    return saved;
  } finally {
    if (!finalized) await recording.stopAndUnloadAsync().catch(() => {});
  }
}
