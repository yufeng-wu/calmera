import { mealForLocalTime } from "../mealTimes.mjs";

// Capture recordedAt when the recorder starts, before transcription/network time.
export async function estimateVoiceMeal({ userId, transcript, recordedAt, isActive,
  loadMealTimes, getNutritionClient }) {
  const check = () => { if (!isActive()) throw new Error("voice_operation_cancelled"); };
  check();
  const times = await loadMealTimes(userId, { isActive });
  check();
  const defaultMealType = mealForLocalTime(recordedAt, times);
  const { client, model } = await getNutritionClient(userId);
  check();
  return client.estimate({ text: transcript, model, defaultMealType });
}
