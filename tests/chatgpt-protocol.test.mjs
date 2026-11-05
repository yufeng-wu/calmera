import test from "node:test";
import assert from "node:assert/strict";
import { authorizationURL, callbackResult, tokenRecord, mealInput, parseMeal,
  completedText, completedResponse, foodEntryPayload, parseMeals, parseNutrition } from "../lib/chatgpt/protocol.mjs";
import { transcriptPrompt, mealInstructions, quantityPrompt } from "../lib/chatgpt/prompts.mjs";

const redirectUri = "http://127.0.0.1:1455/auth/callback";
const pending = { redirectUri, state: "synthetic-state" };
const meal = { foodName: "Synthetic banana", quantity: "1 medium banana", mealType: "Snack",
  calories: 105, protein: 1.3, carbs: 27, fat: 0.4 };
const completed = { type: "response.completed", response: { status: "completed", output: [
  { type: "message", content: [{ type: "output_text", text: JSON.stringify(meal) }] },
] } };
const frame = event => `data: ${JSON.stringify(event)}\n\n`;
function stream(body, mime = "text/event-stream", width = 7) {
  const bytes = new TextEncoder().encode(body);
  let offset = 0;
  return { headers: new Headers(mime ? { "Content-Type": mime } : {}), body: new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      controller.enqueue(bytes.slice(offset, offset + width)); offset += width;
    },
  }) };
}

test("registration uses issued IDs, PKCE and only the official loopback route", () => {
  const params = { hostId: "urn:uuid:synthetic", redirectUri, state: "s", nonce: "n", challenge: "c" };
  const first = new URL(authorizationURL(params));
  assert.equal(first.origin, "https://auth.openai.com");
  assert.equal(first.searchParams.get("client_id"), "dynamic_agent_client");
  assert.equal(first.searchParams.get("agent_name_hint"), "calmera.");
  assert.equal(first.searchParams.get("code_challenge_method"), "S256");
  const returning = new URL(authorizationURL({ ...params, clientId: "oaiapp_test" }));
  assert.equal(returning.searchParams.has("agent_name_hint"), false);
  for (const uri of ["mobile://callback", "http://localhost:1455/auth/callback", "https://127.0.0.1:1455/auth/callback", `${redirectUri}?extra=true`]) {
    assert.throws(() => authorizationURL({ ...params, redirectUri: uri }));
  }
});

test("callback refuses wrong state, origin, duplicate fields and a different registration", () => {
  const callback = `${redirectUri}?state=synthetic-state&code=code&client_id=oaiapp_test`;
  assert.deepEqual(callbackResult(callback, pending), { code: "code", clientId: "oaiapp_test" });
  for (const value of [callback.replace("synthetic-state", "other"), callback.replace("1455", "1555"),
    `${callback}&state=synthetic-state`, callback.replace("oaiapp_test", "dynamic_agent_client"),
    `${redirectUri}?state=synthetic-state&error=access_denied`]) assert.throws(() => callbackResult(value, pending));
  assert.throws(() => callbackResult(callback, { ...pending, clientId: "oaiapp_different" }));
});

test("tokens require explicit plan consent and rotate together", () => {
  const identity = { iss: "https://auth.openai.com", sub: "synthetic" };
  const prior = tokenRecord({ access_token: "fake", refresh_token: "fake-refresh", scope: "chatgpt.tokens.use.direct", token_type: "Bearer", expires_in: 3600 }, { clientId: "oaiapp_test", identity, now: 0 });
  assert.throws(() => tokenRecord({ access_token: "fake", scope: "openid", token_type: "Bearer", expires_in: 3600 }, { clientId: "test", identity }));
  const next = tokenRecord({ access_token: "new-fake", refresh_token: "new-fake-refresh", token_type: "Bearer", expires_in: 3600 }, { clientId: prior.client_id, identity, prior, now: 10 });
  assert.equal(next.access_token, "new-fake"); assert.equal(next.refresh_token, "new-fake-refresh");
  assert.equal(next.expires_at, 3600010);
});

test("input only accepts text and bounded inline raster images, never audio or remote URLs", () => {
  assert.equal(mealInput("Invented banana", "data:image/png;base64,aGVsbG8=")[0].content.length, 2);
  for (const image of ["https://example.com/private.png", "data:audio/mp4;base64,aGVsbG8=", "data:image/svg+xml;base64,aGVsbG8="]) assert.throws(() => mealInput("", image));
  assert.throws(() => mealInput("", null));
  assert.throws(() => mealInput("x".repeat(8001)));
});

test("chunked SSE, CRLF, Unicode and missing content type require completed inference", async () => {
  const value = { ...meal, foodName: "虚构香蕉" };
  const event = { ...completed, response: { ...completed.response, output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }] } };
  const output = await completedText(stream(frame(event).replace(/\n/g, "\r\n"), null, 1));
  assert.deepEqual(parseMeal(output), value);
});

test("partial, failed, incomplete, wrong-MIME and malformed streams never yield a meal", async () => {
  for (const response of [stream(frame({ type: "response.output_text.delta", delta: JSON.stringify(meal) })),
    stream(frame(completed), "text/html"), stream("data: not-json\n\n"),
    stream(frame({ type: "response.incomplete" })),
    stream(frame(completed) + frame({ type: "response.output_text.delta", delta: "extra" })),
    stream(frame(completed) + frame({ type: "response.failed", response: { error: { code: "subscription_sharing_usage_limit_exceeded" } } }))]) {
    await assert.rejects(completedText(response));
  }
});

test("progress follows real stream events once per stage and never exposes provider content", async () => {
  const stages = [];
  const frames = [
    { type: "response.created", response: { id: "private-id" } },
    { type: "response.in_progress" },
    { type: "response.output_text.delta", delta: "private-partial-text" },
    { type: "response.output_text.delta", delta: "more-private-text" },
    { type: "response.in_progress" }, completed,
  ];
  assert.equal(await completedText(stream(frames.map(frame).join(""), undefined, 1), { onProgress: stage => stages.push(stage) }), JSON.stringify(meal));
  assert.deepEqual(stages, ["received", "analyzing", "receiving", "completed"]);
  const failedStages = [];
  await assert.rejects(completedText(stream(frame(frames[0]) + frame({ type: "response.failed" })), { onProgress: stage => failedStages.push(stage) }));
  assert.deepEqual(failedStages, ["received"]);
  assert.equal(await completedText(stream(frame(completed)), { onProgress() { throw new Error("UI callback failed"); } }), JSON.stringify(meal));
});

test("malformed model output cannot turn into a meal; clarification stays unsaved", () => {
  assert.deepEqual(parseMeal(JSON.stringify(meal)), meal);
  assert.deepEqual(parseMeal('{"needsClarification":"What was in the bowl?"}'), { needsClarification: "What was in the bowl?" });
  for (const patch of [{ calories: -1 }, { protein: "10" }, { carbs: null }, { foodName: "" }, { mealType: "Unknown" }, { quantity: "-1 bowl" }, { quantity: "- 1 bowl" }, { quantity: "0 g" }, { quantity: "?!" }, { fat: 10000 }, { foodName: "x".repeat(256) }]) assert.throws(() => parseMeal(JSON.stringify({ ...meal, ...patch })));
  assert.throws(() => foodEntryPayload({ needsClarification: "Which meal?" }, new Date().toISOString()));
});

test("an amount can be words alone, as people say it", () => {
  for (const quantity of ["a bowl", "one bowl", "half a plate", "一碗", "2"]) assert.equal(parseMeal(JSON.stringify({ ...meal, quantity })).quantity, quantity);
});

test("saving allowlists only the existing database fields, never tokens, transcripts or images", () => {
  const payload = foodEntryPayload({ ...meal, access_token: "fake", image: "synthetic", transcript: "synthetic", client_id: "fake" }, "2026-10-18T12:00:00-04:00");
  assert.deepEqual(Object.keys(payload), ["foodName", "quantity", "mealType", "calories", "protein", "carbs", "fat", "createdAt"]);
  assert.equal(payload.calories, 105);
});

test("vegetables and fruits survive to the save, and bad lists never lose the meal", () => {
  const ingredients = { vegetables: ["Spinach"], fruits: [] };
  assert.deepEqual(parseMeal(JSON.stringify({ ...meal, ingredients })), { ...meal, ingredients });
  assert.deepEqual(foodEntryPayload({ ...meal, ingredients }, "2026-10-18T12:00:00-04:00").ingredients, ingredients);
  assert.deepEqual(parseMeals(JSON.stringify([{ ...meal, ingredients }]))[0].ingredients, ingredients);
  for (const bad of ["Spinach", ["Spinach"], {}, { vegetables: "Spinach" }, null]) assert.deepEqual(parseMeal(JSON.stringify({ ...meal, ingredients: bad })), meal);
  assert.deepEqual(parseMeal(JSON.stringify({ ...meal, ingredients: { vegetables: [" Kale ", "kale", 3, ""], grains: ["Rice"] } })).ingredients, { vegetables: ["Kale"], fruits: [] });
  assert.ok(transcriptPrompt("Synthetic salad").includes('"ingredients": { "vegetables": ["Romaine Lettuce"], "fruits": [] }'));
});

test("the original multi-food array is preserved, including empty/no-food and fractional portions", () => {
  const second = { ...meal, foodName: "Invented toast", quantity: "0.5 slices", calories: 40 };
  assert.deepEqual(parseMeals(JSON.stringify([meal, second])), [meal, second]);
  assert.deepEqual(parseMeals("[]"), []);
  assert.throws(() => parseMeals(JSON.stringify(meal)));
  assert.throws(() => parseMeals(JSON.stringify([meal, { ...second, calories: -1 }])));
  assert.throws(() => parseMeals(JSON.stringify(Array(21).fill(meal))));
});

test("ported Gemini business rules remain and the single-photo adapter is explicitly separate", () => {
  const original = transcriptPrompt("Synthetic half a bagel, 200 calories");
  assert.ok(original.includes('"Synthetic half a bagel, 200 calories"'));
  assert.ok(original.includes("you MUST use their provided numbers"));
  assert.ok(original.includes('default to "Snack"'));
  assert.ok(original.includes("valid JSON array only"));
  assert.ok(original.includes("half a slice"));
  assert.equal(mealInstructions("Synthetic banana"), transcriptPrompt("Synthetic banana"));
  assert.ok(mealInstructions("Synthetic snack", true).includes("Single-photo input adapter"));
  assert.ok(quantityPrompt("Synthetic rice", "100 g").includes("100 g"));
});


test("processing tier comes from validated completion, not an earlier event or requested mode", async () => {
  const event = { ...completed, response: { ...completed.response, service_tier: "priority" } };
  const value = await completedResponse(stream(frame({ type: "response.created", response: { service_tier: "default" } }) + frame(event)));
  assert.equal(value.serviceTier, "priority");
  assert.equal(value.text, JSON.stringify(meal));
});

test("a server downgrade or omitted tier cannot be reported as Fast", async () => {
  for (const tier of ["default", undefined, "unrecognized-tier"]) {
    const event = { ...completed, response: { ...completed.response, service_tier: tier } };
    const value = await completedResponse(stream(frame(event)));
    assert.equal(value.serviceTier, tier === "default" ? "default" : null);
  }
});

test("Fast metadata never converts an incomplete or failed stream into success", async () => {
  const event = { ...completed, response: { ...completed.response, service_tier: "priority" } };
  await assert.rejects(completedResponse(stream(frame({ type: "response.created", response: { service_tier: "priority" } }))));
  await assert.rejects(completedResponse(stream(frame(event) + frame({ type: "response.failed" }))));
});

test("a re-estimate reads its four numbers from any answer shape that holds them", () => {
  const want = { calories: 154, protein: 5.4, carbs: 27.4, fat: 2.6 };
  const read = value => parseNutrition(typeof value === "string" ? value : JSON.stringify(value));
  assert.deepEqual(read(want), want);
  assert.deepEqual(read({ calories: "154 kcal", protein: "5.4 g", carbs: "27.4g", fat: "2.6 grams" }), want);
  assert.deepEqual(read({ "calories (kcal)": 154, "protein (g)": 5.4, "carbs (g)": 27.4, "fat (g)": 2.6 }), want);
  assert.deepEqual(read({ calories_kcal: 154, protein_g: 5.4, carbohydrates_g: 27.4, total_fat_g: 2.6, saturated_fat_g: 1 }), want);
  assert.deepEqual(read({ calories: 154, macronutrients: { protein: 5.4, carbs: 27.4, fat: 2.6 } }), want);
  assert.deepEqual(read({ food: "Oatmeal", nutrition: { calories: { value: 154, unit: "kcal" }, protein: 5.4, carbs: 27.4, fat: 2.6 } }), want);
  assert.deepEqual(read({ per_100g: { calories: 70, protein: 2, carbs: 12, fat: 1 }, total: want }), want);
  assert.deepEqual(read([want]), want);
  assert.deepEqual(read([{ calories: 100, protein: 4, carbs: 17.4, fat: 1.6 }, { calories: 54, protein: 1.4, carbs: 10, fat: 1 }]), want);
  assert.deepEqual(read({ calories: "140-168", protein: 5.4, carbs: 27.4, fat: 2.6 }), want);
  assert.deepEqual(read({ calories: "1,200", protein: 5, carbs: 27, fat: 3 }).calories, 1200);
  assert.deepEqual(read("Here is the estimate:\n```json\n" + JSON.stringify(want) + "\n```\nEnjoy!"), want);
  assert.deepEqual(read("```json\n" + JSON.stringify(want) + "\n```"), want);
  assert.equal(read({ calories: 0.1 + 0.2, protein: 0, carbs: 0, fat: 0 }).calories, 0.3);
});

test("a re-estimate without all four usable numbers still fails", () => {
  const bad = [{ calories: 154, protein: 5.4, carbs: 27.4 }, { calories: "-5", protein: 1, carbs: 1, fat: 1 },
    { calories: "about 150 or 200", protein: 1, carbs: 1, fat: 1 }, { energy_kj: 640, protein: 1, carbs: 1, fat: 1 },
    { calories: 30000, protein: 1, carbs: 1, fat: 1 }, { error: "Please say how much" }, [], [{ calories: 1, protein: 1, carbs: 1, fat: 1 }, {}]];
  for (const value of bad) assert.throws(() => parseNutrition(JSON.stringify(value)), /invalid_estimate/);
  assert.throws(() => parseNutrition("I can't tell how much that is."), SyntaxError);
});
