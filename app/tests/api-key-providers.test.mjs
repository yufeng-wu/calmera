import test from "node:test";
import assert from "node:assert/strict";
import { API_KEY_PROVIDERS, ANTHROPIC_VERSION } from "../src/lib/ai/models.mjs";
import { apiKeyErrorCode, checkKeyShape, createApiKeyCompletion, mealRequest, responseText, testApiKey } from "../src/lib/ai/providers.mjs";
import { createConnectionStore, connectionStorageKey } from "../src/lib/ai/connection.mjs";
import { apiKeyIssue, loggingIssue } from "../src/lib/ai/apiKeyPresentation.mjs";
import { createMealEstimator } from "../src/lib/ai/mealEstimator.mjs";
import { mealInstructions, quantityPrompt } from "../src/lib/chatgpt/prompts.mjs";

// Obviously fake keys: never a real one in tests.
const KEYS = { anthropic: "sk-ant-FAKE-test-key-0000-WXYZ", openai: "sk-proj-FAKE-test-key-0000-ABCD" };
const PHOTO = "data:image/jpeg;base64,/9j/AAAA";
const meal = { foodName: "Synthetic Banana", quantity: "1 medium", mealType: "Snack", calories: 105, protein: 1.3, carbs: 27, fat: 0.4,
  ingredients: { vegetables: [], fruits: ["Banana"] } };
const replies = {
  anthropic: text => ({ type: "message", stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text }] }),
  openai: text => ({ status: "completed", output: [{ type: "reasoning", summary: [] },
    { type: "message", content: [{ type: "output_text", text }] }] }),
};

// A fetch that records each call and answers from a queue.
function fakeFetch(...answers) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = answers.length > 1 ? answers.shift() : answers[0];
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next(url, init) : next;
  };
  return { fetch, calls };
}
const ok = body => Response.json(body);
const failure = (status, error) => Response.json({ type: "error", error }, { status });

for (const provider of ["anthropic", "openai"]) {
  test(`${provider}: a voice or typed meal is one request to the official API with the shared prompt`, async () => {
    const { fetch, calls } = fakeFetch(ok(replies[provider](JSON.stringify([meal]))));
    const estimator = createMealEstimator(createApiKeyCompletion({ fetch, provider, key: KEYS[provider] }));
    const stages = [];
    const result = await estimator.estimate({ text: "a banana for a snack", onProgress: stage => stages.push(stage) });
    assert.deepEqual(result, [meal]);
    assert.equal(calls.length, 1);
    const [{ url, init, body }] = calls;
    assert.equal(new URL(url).host, API_KEY_PROVIDERS[provider].host);
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.equal(body.model, API_KEY_PROVIDERS[provider].model);
    assert.deepEqual(stages, ["sending", "analyzing", "completed"]);
    if (provider === "anthropic") {
      assert.equal(init.headers["x-api-key"], KEYS.anthropic);
      assert.equal(init.headers["anthropic-version"], ANTHROPIC_VERSION);
      assert.equal(init.headers.Authorization, undefined);
      assert.equal(body.system, mealInstructions("a banana for a snack", false));
      assert.deepEqual(body.messages, [{ role: "user", content: [{ type: "text", text: "a banana for a snack" }] }]);
      assert.equal(body.output_config.effort, "low");
      for (const removed of ["temperature", "top_p", "top_k"]) assert.equal(removed in body, false);
    } else {
      assert.equal(init.headers.Authorization, `Bearer ${KEYS.openai}`);
      assert.equal(init.headers["x-api-key"], undefined);
      assert.equal(body.instructions, mealInstructions("a banana for a snack", false));
      assert.deepEqual(body.input, [{ role: "user", content: [{ type: "input_text", text: "a banana for a snack" }] }]);
      assert.equal(body.store, false);
      assert.equal(body.reasoning.effort, "low");
    }
  });

  test(`${provider}: a photo goes as base64 image data (before the words, for Claude)`, async () => {
    const { fetch, calls } = fakeFetch(ok(replies[provider](JSON.stringify([meal]))));
    const estimator = createMealEstimator(createApiKeyCompletion({ fetch, provider, key: KEYS[provider] }));
    await estimator.estimate({ text: "", image: PHOTO });
    const { body } = calls[0];
    if (provider === "anthropic") {
      assert.deepEqual(body.messages[0].content, [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "/9j/AAAA" } }]);
      assert.equal(body.system, mealInstructions("", true));
    } else {
      assert.deepEqual(body.input[0].content, [{ type: "input_image", image_url: PHOTO }]);
    }
    const request = mealRequest(provider, { key: KEYS[provider], instructions: "x", text: "my lunch", image: "data:image/png;base64,iVBO" });
    const content = provider === "anthropic" ? JSON.parse(request.init.body).messages[0].content : JSON.parse(request.init.body).input[0].content;
    assert.deepEqual(content.map(part => part.type), provider === "anthropic" ? ["image", "text"] : ["input_text", "input_image"]);
    assert.throws(() => mealRequest(provider, { key: KEYS[provider], instructions: "x", image: "data:image/gif;base64,R0lG" }), /invalid_meal_image/);
  });

  test(`${provider}: re-estimating one food uses the quantity prompt and its parser`, async () => {
    const { fetch, calls } = fakeFetch(ok(replies[provider]('{"calories": 210, "protein": 2.6, "carbs": 54, "fat": 0.8}')));
    const estimator = createMealEstimator(createApiKeyCompletion({ fetch, provider, key: KEYS[provider] }));
    const result = await estimator.estimateQuantity({ foodName: "Banana", quantity: "2" });
    assert.deepEqual(result, { calories: 210, protein: 2.6, carbs: 54, fat: 0.8, normalizedQuantity: "2 counts" });
    const sent = provider === "anthropic" ? calls[0].body.system : calls[0].body.instructions;
    assert.equal(sent, quantityPrompt("Banana", "2 counts"));
  });

  test(`${provider}: bad answers never become meals`, async () => {
    const run = async body => createMealEstimator(createApiKeyCompletion({ fetch: fakeFetch(ok(body)).fetch, provider, key: KEYS[provider] }))
      .estimate({ text: "toast" });
    await assert.rejects(run(replies[provider]("not json")), SyntaxError);
    await assert.rejects(run(replies[provider]('[{"foodName": "Toast"}]')), /invalid_estimate/);
    await assert.rejects(run(replies[provider]("  ")), /inference_not_completed/);
    assert.deepEqual(await run(replies[provider]("[]")), []);
  });
}

test("cut-off and refused answers are errors, not partial meals", () => {
  assert.throws(() => responseText("anthropic", { stop_reason: "max_tokens", content: [{ type: "text", text: "[{" }] }), /inference_not_completed/);
  assert.throws(() => responseText("anthropic", { stop_reason: "refusal", content: [] }), /inference_failed/);
  assert.throws(() => responseText("openai", { status: "incomplete", output: [] }), /inference_not_completed/);
  assert.throws(() => responseText("openai", { status: "failed", output: [] }), /inference_failed/);
  assert.equal(responseText("openai", replies.openai("[]")), "[]");
});

test("provider errors map to a few plain codes", () => {
  const cases = [
    [{ status: 401, type: "authentication_error" }, "apikey_rejected"],
    [{ status: 401, code: "invalid_api_key" }, "apikey_rejected"],
    [{ status: 402, type: "billing_error" }, "apikey_no_credit"],
    [{ status: 400, type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." }, "apikey_no_credit"],
    [{ status: 429, code: "insufficient_quota" }, "apikey_no_credit"],
    [{ status: 429, type: "rate_limit_error", code: "enforced_spend_limit_reached" }, "apikey_no_credit"],
    [{ status: 429, type: "rate_limit_error" }, "apikey_rate_limited"],
    [{ status: 429, code: "rate_limit_exceeded" }, "apikey_rate_limited"],
    [{ status: 403, type: "permission_error" }, "apikey_not_allowed"],
    [{ status: 404, type: "not_found_error" }, "apikey_model_unavailable"],
    [{ status: 413, type: "request_too_large" }, "meal_image_too_large"],
    [{ status: 529, type: "overloaded_error" }, "apikey_provider_busy"],
    [{ status: 500 }, "apikey_provider_busy"],
    [{ status: 400, type: "invalid_request_error", message: "messages: bad" }, "apikey_request_failed"],
  ];
  for (const [details, code] of cases) assert.equal(apiKeyErrorCode(details), code, JSON.stringify(details));
});

test("an HTTP error carries its code and status, never the key or the provider's text", async () => {
  const secret = "the provider said something long";
  const { fetch } = fakeFetch(failure(401, { type: "authentication_error", message: `${secret} ${KEYS.anthropic}` }));
  const complete = createApiKeyCompletion({ fetch, provider: "anthropic", key: KEYS.anthropic });
  const error = await complete({ instructions: "x", text: "toast" }).catch(caught => caught);
  assert.equal(error.message, "apikey_rejected");
  assert.equal(error.status, 401);
  assert.equal(error.provider, "anthropic");
  assert.ok(!JSON.stringify({ ...error, message: error.message, stack: error.stack }).includes("FAKE"));
  assert.ok(!error.stack.includes(secret));
  assert.deepEqual(loggingIssue(error), apiKeyIssue("rejected", "anthropic"));
});

test("no network, a timeout and a cancel are told apart", async () => {
  const offline = createApiKeyCompletion({ fetch: fakeFetch(new TypeError(`Network request failed ${KEYS.openai}`)).fetch, provider: "openai", key: KEYS.openai });
  const error = await offline({ instructions: "x", text: "toast" }).catch(caught => caught);
  assert.equal(error.message, "apikey_network");
  assert.ok(!error.stack.includes("FAKE"));

  const hanging = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const slow = createApiKeyCompletion({ fetch: fakeFetch(hanging).fetch, provider: "openai", key: KEYS.openai, timeoutMs: 10 });
  await assert.rejects(slow({ instructions: "x", text: "toast" }), /apikey_timeout/);

  const controller = new AbortController();
  const cancelled = createApiKeyCompletion({ fetch: fakeFetch(hanging).fetch, provider: "anthropic", key: KEYS.anthropic });
  const pending = cancelled({ instructions: "x", text: "toast", signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /request_cancelled/);
  controller.abort();
  const { fetch, calls } = fakeFetch(ok({}));
  await assert.rejects(createApiKeyCompletion({ fetch, provider: "anthropic", key: KEYS.anthropic })({ instructions: "x", text: "a", signal: controller.signal }), /request_cancelled/);
  assert.equal(calls.length, 0);
});

test("testing a key is one tiny request with a plain answer", async () => {
  const run = (provider, answer) => {
    const fake = fakeFetch(answer);
    return testApiKey({ fetch: fake.fetch, provider, key: KEYS[provider] }).then(result => ({ result, calls: fake.calls }));
  };
  const works = await run("anthropic", ok(replies.anthropic("OK")));
  assert.equal(works.result, "works");
  assert.equal(works.calls.length, 1);
  assert.equal(works.calls[0].body.max_tokens, 32);
  assert.equal((await run("openai", ok({ status: "incomplete", output: [] }))).result, "works", "any successful reply proves the key");
  assert.equal((await run("openai", ok(replies.openai("OK")))).calls[0].body.max_output_tokens, 32);
  assert.equal((await run("anthropic", failure(401, { type: "authentication_error", message: "invalid x-api-key" }))).result, "rejected");
  assert.equal((await run("openai", failure(429, { code: "insufficient_quota", message: "quota" }))).result, "no-credit");
  assert.equal((await run("anthropic", failure(402, { type: "billing_error" }))).result, "no-credit");
  assert.equal((await run("openai", new TypeError("Network request failed"))).result, "offline");
  assert.equal((await run("anthropic", failure(529, { type: "overloaded_error" }))).result, "busy");

  const wrong = fakeFetch(ok({}));
  assert.equal(await testApiKey({ fetch: wrong.fetch, provider: "openai", key: KEYS.anthropic }), "wrong-provider");
  assert.equal(await testApiKey({ fetch: wrong.fetch, provider: "anthropic", key: "sk-ant- has spaces in it" }), "malformed");
  assert.equal(wrong.calls.length, 0, "a key that can't be right is never sent");
});

test("key shape checks catch the common paste mistakes", () => {
  assert.equal(checkKeyShape("anthropic", `  ${KEYS.anthropic}\n`), KEYS.anthropic);
  assert.equal(checkKeyShape("openai", KEYS.openai), KEYS.openai);
  assert.throws(() => checkKeyShape("anthropic", ""), /apikey_missing/);
  assert.throws(() => checkKeyShape("anthropic", "sk-ant-short"), /apikey_malformed/);
  assert.throws(() => checkKeyShape("openai", KEYS.anthropic), /apikey_wrong_provider/);
  assert.throws(() => checkKeyShape("anthropic", KEYS.openai), /apikey_wrong_provider/);
  assert.throws(() => checkKeyShape("gemini", KEYS.openai), /apikey_provider_unknown/);
});

// A Keychain in memory, and a ChatGPT sign-in that can be present and forgotten.
function connectionFixture({ signedIn = false, forgetFails = false } = {}) {
  const values = new Map();
  const writes = [];
  const chatgpt = { signedIn, forgets: 0 };
  const secureStore = {
    getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value, options) => { writes.push({ key, options }); values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); },
  };
  const store = createConnectionStore({ secureStore, owner: "local", options: { keychainAccessible: "this-device-only" }, chatgpt: {
    connected: async () => chatgpt.signedIn,
    forget: async () => { chatgpt.forgets++; if (forgetFails) throw new Error("keychain"); chatgpt.signedIn = false; },
  } });
  return { store, values, writes, chatgpt };
}

test("the AI connection is one record: a key is stored masked-on-read, and removable", async () => {
  const { store, values, writes } = connectionFixture();
  assert.equal(await store.read(), null);
  const saved = await store.saveKey("anthropic", ` ${KEYS.anthropic} `);
  assert.deepEqual(saved, { type: "claude-key", provider: "anthropic", masked: "sk-ant-••••WXYZ" });
  assert.deepEqual(writes, [{ key: connectionStorageKey("local"), options: { keychainAccessible: "this-device-only" } }]);
  assert.deepEqual([...values.keys()], ["calmera.connection.local"]);
  assert.deepEqual(await store.read(), saved);
  assert.ok(!JSON.stringify(await store.read()).includes("FAKE"));
  assert.deepEqual(await store.credential(), { type: "claude-key", provider: "anthropic", key: KEYS.anthropic });
  await assert.rejects(store.saveKey("openai", KEYS.anthropic), /apikey_wrong_provider/);
  assert.equal((await store.read()).type, "claude-key", "a failed save keeps the old connection");
  await store.saveKey("openai", KEYS.openai);
  assert.deepEqual(await store.read(), { type: "openai-key", provider: "openai", masked: "sk-proj-••••ABCD" });
  assert.equal(values.size, 1, "a new key replaces the old one in the same record");
  await store.disconnect();
  assert.equal(await store.read(), null);
  values.set(connectionStorageKey("local"), "{broken");
  assert.equal(await store.read(), null);
  values.set(connectionStorageKey("local"), JSON.stringify({ type: "gemini-key", key: KEYS.openai }));
  assert.equal(await store.read(), null);
  assert.throws(() => createConnectionStore({ secureStore: {}, owner: "../x", chatgpt: {} }), /calmera_sign_in_required/);
});

test("a ChatGPT sign-in saved before is the connection, and a key replaces it only once saved", async () => {
  const fixture = connectionFixture({ signedIn: true });
  assert.deepEqual(await fixture.store.read(), { type: "chatgpt" });
  // The one record now names it, so ChatGPT and a key are told apart the same way.
  assert.deepEqual(JSON.parse(fixture.values.get(connectionStorageKey("local"))), { type: "chatgpt" });
  await assert.rejects(fixture.store.saveKey("anthropic", "sk-ant-short"), /apikey_malformed/);
  assert.equal(fixture.chatgpt.signedIn, true, "a key that can't be saved leaves ChatGPT connected");
  await fixture.store.saveKey("anthropic", KEYS.anthropic);
  assert.equal(fixture.chatgpt.signedIn, false);
  assert.equal(fixture.chatgpt.forgets, 1);
  assert.equal((await fixture.store.read()).type, "claude-key");
});

test("signing in to ChatGPT replaces a key; disconnecting ChatGPT leaves nothing", async () => {
  const fixture = connectionFixture();
  await fixture.store.saveKey("openai", KEYS.openai);
  fixture.chatgpt.signedIn = true;           // the ChatGPT sign-in has just been saved...
  await fixture.store.chatgptConnected();    // ...so the record names it and the key goes
  assert.deepEqual(await fixture.store.read(), { type: "chatgpt" });
  assert.deepEqual([...fixture.values.values()].map(value => JSON.parse(value)), [{ type: "chatgpt" }]);
  assert.ok(![...fixture.values.values()].join("").includes("FAKE"), "the key is gone");
  await fixture.store.disconnect();
  assert.equal(fixture.chatgpt.signedIn, false);
  assert.equal(fixture.values.size, 0);
  assert.equal(await fixture.store.read(), null);
});

test("a record naming ChatGPT without a sign-in behind it is cleared, not trusted", async () => {
  const fixture = connectionFixture();
  fixture.values.set(connectionStorageKey("local"), JSON.stringify({ type: "chatgpt" }));
  assert.equal(await fixture.store.read(), null);
  assert.equal(fixture.values.size, 0);
  assert.equal(await fixture.store.credential(), null);
});

test("a switch that stopped half way is finished, so two credentials never stay", async () => {
  const fixture = connectionFixture({ forgetFails: true, signedIn: true });
  await assert.rejects(fixture.store.saveKey("anthropic", KEYS.anthropic), /keychain/);
  // The key is saved first, so a failure after it leaves the new connection, not the old one.
  assert.ok(fixture.values.has(connectionStorageKey("local")));
  // The next read deletes the old sign-in once it can.
  const healed = connectionFixture({ signedIn: true });
  healed.values.set(connectionStorageKey("local"), JSON.stringify({ type: "claude-key", key: KEYS.anthropic }));
  assert.equal((await healed.store.read()).type, "claude-key");
  assert.equal(healed.chatgpt.signedIn, false);
});

test("logging errors from a key read plainly; other errors are left to the usual alert", () => {
  const error = Object.assign(new Error("apikey_no_credit"), { provider: "openai" });
  assert.match(loggingIssue(error).message, /OpenAI account has no credit/);
  assert.equal(loggingIssue(error).action, "settings");
  assert.equal(loggingIssue(Object.assign(new Error("apikey_rate_limited"), { provider: "anthropic" })).action, "retry");
  assert.equal(loggingIssue(new Error("invalid_estimate")), null);
  assert.equal(loggingIssue(new Error("chatgpt_sign_in_required")), null);
  for (const outcome of ["rejected", "no-credit", "offline", "rate-limited", "not-allowed", "busy", "wrong-provider", "malformed", "failed"]) {
    const issue = apiKeyIssue(outcome, "anthropic");
    assert.ok(issue.title && issue.message && issue.action, outcome);
  }
  assert.equal(apiKeyIssue("works", "anthropic"), null);
});
