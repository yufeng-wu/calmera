import { mealRequest } from "../mealRequest.mjs";
import { foodEntryPayload } from "./protocol.mjs";

// Reuse the existing authenticated food-entry API. No model credentials or media
// are accepted here, and a failed/uncertain request is never retried automatically.
export async function saveEstimatedEntries(entries, { createdAt, getToken, url, fetchImpl = fetch, signal,
  timeoutMs = 20000, isActive = () => true }) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 20) throw new Error("no_food_detected");
  const payloads = entries.map(meal => foodEntryPayload(meal, createdAt));
  let tokenRequest;
  const tokenOnce = () => tokenRequest ||= getToken();
  const savedEntries = [];
  const record = row => savedEntries.push({ ...row, foodName: row.foodName ?? row.food_name,
    mealType: row.mealType ?? row.meal_type, localTime: row.localTime ?? row.local_time });
  const cancelled = dispatched => Object.assign(new Error("meal_request_cancelled"), {
    dispatched, mayHaveSaved: dispatched, uncertain: dispatched, cancelled: true, timedOut: false,
  });
  const current = () => !signal?.aborted && isActive();
  for (const payload of payloads) {
    try {
      if (!current()) throw cancelled(false);
      const row = await mealRequest({ getToken: tokenOnce, url, body: payload, signal, timeoutMs, fetchImpl, isActive,
        readResult: async response => {
          const result = await response.json();
          if (!result?.id) throw new Error("meal_save_uncertain");
          return result;
        } });
      // Keep confirmed old-owner write bookkeeping, but never publish a stale
      // success or begin another entry after the activity guard changes.
      record(row);
      if (!current()) throw cancelled(true);
    } catch (cause) {
      if (cause.acknowledgedResult?.id) record(cause.acknowledgedResult);
      if (/sign_in/.test(cause.message) && !savedEntries.length) throw cause;
      const mayHaveSaved = Boolean(cause.mayHaveSaved || cause.uncertain || savedEntries.length);
      const error = new Error(mayHaveSaved ? "meal_save_uncertain" : "meal_save_failed");
      error.savedEntries = [...savedEntries];
      error.mayHaveSaved = mayHaveSaved;
      error.dispatched = cause.dispatched;
      error.reason = cause.message;
      error.cancelled = cause.cancelled;
      error.timedOut = cause.timedOut;
      throw error;
    }
  }
  return savedEntries;
}
