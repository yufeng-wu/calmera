import { mealRequest } from "../mealRequest.mjs";
import { foodEntryPayload } from "./protocol.mjs";

// Reuse the existing authenticated food-entry API. No model credentials or media
// are accepted here, and a failed/uncertain request is never retried automatically.
export async function saveEstimatedEntries(entries, { createdAt, getToken, url, fetchImpl = fetch, signal, timeoutMs = 20000 }) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 20) throw new Error("no_food_detected");
  const payloads = entries.map(meal => foodEntryPayload(meal, createdAt));
  let tokenRequest;
  const tokenOnce = () => tokenRequest ||= getToken();
  const savedEntries = [];
  for (const payload of payloads) {
    try {
      const row = await mealRequest({ getToken: tokenOnce, url, body: payload, signal, timeoutMs, fetchImpl,
        readResult: async response => {
          const result = await response.json();
          if (!result?.id) throw new Error("meal_save_uncertain");
          return result;
        } });
      savedEntries.push({ ...row, foodName: row.foodName ?? row.food_name,
        mealType: row.mealType ?? row.meal_type, localTime: row.localTime ?? row.local_time });
    } catch (cause) {
      if (/sign_in/.test(cause.message) && !savedEntries.length) throw cause;
      const error = new Error(cause.uncertain || savedEntries.length ? "meal_save_uncertain" : "meal_save_failed");
      error.savedEntries = savedEntries;
      error.mayHaveSaved = Boolean(cause.uncertain || savedEntries.length);
      error.dispatched = cause.dispatched;
      error.reason = cause.message;
      error.cancelled = cause.cancelled;
      error.timedOut = cause.timedOut;
      throw error;
    }
  }
  return savedEntries;
}
