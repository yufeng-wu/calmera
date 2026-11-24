import test from "node:test";
import assert from "node:assert/strict";
import { createPhoneStore } from "../src/lib/store/phone.mjs";
import { createMemoryStorage } from "../src/lib/store/memoryStorage.mjs";

const meal = { foodName: "Synthetic banana", quantity: "1 banana", mealType: "Snack", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 };
const createdAt = "2026-10-18T12:00:00-04:00";

test("an estimate saves only the meal's own fields, never media, tokens or transcripts", async () => {
  const storage = createMemoryStorage();
  const data = createPhoneStore({ storage });
  const [saved] = await data.createMeals([{ ...meal, access_token: "fake-openai", image: "fake-image", transcript: "fake-voice" }], { createdAt });
  assert.deepEqual(Object.keys(saved).sort(), ["calories", "carbs", "fat", "foodName", "id", "localTime", "mealType", "protein", "quantity"]);
  const everything = [...storage.data.values()].join("\n");
  for (const secret of ["fake-openai", "fake-image", "fake-voice"]) assert.doesNotMatch(everything, new RegExp(secret));
});

test("a multi-food result is checked whole before anything is saved", async () => {
  const storage = createMemoryStorage();
  const data = createPhoneStore({ storage });
  await assert.rejects(data.createMeals([meal, { ...meal, calories: -1 }], { createdAt }));
  assert.equal([...storage.data.keys()].some(key => key.startsWith("calmera.data.v1.day.")), false);
});
