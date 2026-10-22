import { readNutrition } from "./nutritionRequest.mjs";

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
