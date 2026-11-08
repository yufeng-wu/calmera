import { parseLocalDate } from "./calendarMonths.mjs";
import { readNutrition } from "./nutritionRequest.mjs";

// The server sends the join day as a full timestamp ("2025-10-12T00:00:00.000Z"); only its
// date part is the day you joined.
export const joinedDate = (value) => parseLocalDate(value)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? null;

// Only a confirmed missing profile can lead to setup. An outage or rejected
// session must remain an error; neither can authorize account creation.
export async function checkAccountProfile({ url, ...options }) {
  try {
    await readNutrition({ ...options, url: `${url.replace(/\/+$/, "")}/get-user` });
    return "ready";
  } catch (error) {
    if (error.code === "nutrition_http_404") return "missing";
    throw error;
  }
}

// Nonsecret, per account: once this device has confirmed a profile, opening the
// app stops waiting on the network to confirm it again.
export function createAccountReadyMemory(storage) {
  const key = userId => `calmera.account-ready.v1.${userId}`;
  return {
    known: userId => storage.getItem(key(userId)).then(value => value === "1", () => false),
    set: (userId, ready) => (ready ? storage.setItem(key(userId), "1") : storage.removeItem(key(userId))).catch(() => {}),
  };
}
