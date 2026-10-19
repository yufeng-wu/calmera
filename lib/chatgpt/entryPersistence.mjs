import { foodEntryPayload } from "./protocol.mjs";

// Reuse the existing authenticated food-entry API. No model credentials or media
// are accepted here, and a failed/uncertain request is never retried automatically.
export async function saveEstimatedEntries(entries, { createdAt, getToken, url, fetchImpl = fetch }) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 20) throw new Error("no_food_detected");
  const payloads = entries.map(meal => foodEntryPayload(meal, createdAt));
  const token = await getToken();
  if (!token) throw new Error("calmera_sign_in_required");
  const savedEntries = [];
  for (const payload of payloads) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let dispatched = false;
    try {
      dispatched = true;
      const response = await fetchImpl(url, {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (response.status < 500) dispatched = false;
        throw new Error("meal_save_failed");
      }
      const row = await response.json();
      if (!row?.id) throw new Error("meal_save_uncertain");
      savedEntries.push({ ...row, foodName: row.foodName ?? row.food_name,
        mealType: row.mealType ?? row.meal_type, localTime: row.localTime ?? row.local_time });
    } catch {
      const error = new Error(dispatched ? "meal_save_uncertain" : "meal_save_failed");
      error.savedEntries = savedEntries;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  return savedEntries;
}
