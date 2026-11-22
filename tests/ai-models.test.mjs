import test from "node:test";
import assert from "node:assert/strict";
import { AUTOMATIC, FALLBACK_MODELS, anthropicModels, chatgptModels, keyModels, modelName, openaiModels, selectedName, shortName } from "../lib/ai/modelCatalog.mjs";
import { createAIPreferences, normalizePreferences, preferencesKey } from "../lib/ai/preferences.mjs";
import { createApiKeyCompletion, listModels, mealRequest, modelsRequest, testOutcome } from "../lib/ai/providers.mjs";
import { apiKeyIssue, loggingIssue } from "../lib/ai/apiKeyPresentation.mjs";
import { loggingProblem } from "../lib/ai/loggingProblem.mjs";
import { problemFor } from "../lib/ai/connectionPresentation.mjs";
import { createConnectionController } from "../lib/ai/connectionController.mjs";
import { previewConnectionServices } from "../lib/ai/previewConnection.mjs";

// Obviously fake keys: never a real one in tests.
const KEYS = { anthropic: "sk-ant-FAKE-test-key-0000-WXYZ", openai: "sk-proj-FAKE-test-key-0000-ABCD" };
const answer = (status, body) => ({ ok: status < 400, status, json: async () => body });
const claudeModel = (id, display_name, created_at, capabilities) => ({ type: "model", id, display_name, created_at, capabilities });
const caps = ({ images = true, effort = true, search = true } = {}) => ({ image_input: { supported: images },
  effort: { supported: effort, low: { supported: effort } }, server_tools: { web_search: { supported: search } } });

test("names read the way the providers write them", () => {
  assert.deepEqual(["gpt-6-luna", "gpt-6.2-sol", "gpt-6.1-terra", "gpt-5.4-mini", "gpt-5.5-pro", "gpt-4.1-mini-2025-04-14", "chatgpt-4o-latest", "o4-mini"]
    .map(id => modelName("openai", id)),
  ["Luna 6", "Sol 6.2", "Terra 6.1", "GPT-5.4 mini", "GPT-5.5 pro", "GPT-4.1 mini (2025-04-14)", "ChatGPT-4o latest", "o4-mini"]);
  assert.deepEqual(["claude-haiku-5-5", "claude-opus-4-8", "claude-haiku-4-5-20251001", "claude-fable-5"].map(id => modelName("anthropic", id)),
    ["Haiku 5.5", "Opus 4.8", "Haiku 4.5", "Fable 5"]);
  assert.equal(modelName("anthropic", ""), "");
  // Names the providers send are shortened the same way: the page already says whose model it is.
  assert.deepEqual(["Claude Fable 5.2", "Claude Haiku 4.5", "Claude 3.5 Sonnet", "GPT-6.2 Sol", "GPT-6 Luna", "GPT-5.4 mini", " Automatic ", null].map(shortName),
    ["Fable 5.2", "Haiku 4.5", "Sonnet 3.5", "Sol 6.2", "Luna 6", "GPT-5.4 mini", "Automatic", ""]);
});

test("Anthropic's list keeps every model that reads photos, newest first, with what each can do", () => {
  const listed = anthropicModels([
    claudeModel("claude-haiku-4-5-20251001", "Claude Haiku 4.5", "2025-10-01T00:00:00Z", caps({ effort: false, search: true })),
    claudeModel("claude-opus-5-5", "Claude Opus 5.5", "2026-10-01T00:00:00Z", caps()),
    claudeModel("claude-text-only", "Text Only", "2026-11-01T00:00:00Z", caps({ images: false })),
    claudeModel("claude-haiku-5-5", "Claude Haiku 5.5", "2026-09-01T00:00:00Z", caps()),
    claudeModel("bad id!", "Nope", "2026-11-02T00:00:00Z", caps()),
    { id: "claude-sonnet-5-5", created_at: "2026-08-01T00:00:00Z" },
  ]);
  assert.deepEqual(listed.map(model => model.id), ["claude-opus-5-5", "claude-haiku-5-5", "claude-sonnet-5-5", "claude-haiku-4-5-20251001"]);
  assert.deepEqual(listed.find(model => model.id === "claude-haiku-4-5-20251001"), { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5",
    created: Date.parse("2025-10-01T00:00:00Z"), effort: false, search: true });
  assert.equal(listed.find(model => model.id === "claude-sonnet-5-5").effort, undefined, "no capabilities reported: nothing assumed");
  assert.deepEqual(anthropicModels(null), []);
});

test("OpenAI's list says nothing about what a model can do, so other kinds are left out by name", () => {
  const ids = ["gpt-6-luna", "gpt-6.2-sol", "text-embedding-3-large", "whisper-1", "tts-1", "dall-e-3", "gpt-image-2", "omni-moderation-latest",
    "gpt-4o-realtime-preview", "gpt-4o-mini-transcribe", "gpt-4o-search-preview", "babbage-002", "gpt-3.5-turbo", "gpt-4", "gpt-4-0613",
    "gpt-oss-120b", "codex-mini-latest", "o3-deep-research", "gpt-5.4-mini", "o4-mini", "chatgpt-4o-latest", "gpt-4-turbo"];
  const listed = openaiModels(ids.map((id, index) => ({ id, object: "model", created: index, owned_by: "openai" })));
  assert.deepEqual(listed.map(model => model.id), ["gpt-4-turbo", "chatgpt-4o-latest", "o4-mini", "gpt-5.4-mini", "gpt-6.2-sol", "gpt-6-luna"]);
});

test("a key's list: the recommended model first, then newest first, with plain words", () => {
  const listed = anthropicModels([
    claudeModel("claude-opus-5-5", "Claude Opus 5.5", "2026-10-01T00:00:00Z", caps()),
    claudeModel("claude-opus-4-8", "Claude Opus 4.8", "2026-03-01T00:00:00Z", caps()),
    claudeModel("claude-haiku-5-5", "Claude Haiku 5.5", "2026-09-01T00:00:00Z", caps()),
  ]);
  const catalog = keyModels("anthropic", listed, null);
  assert.deepEqual(catalog.models.map(model => [model.id, model.detail]), [
    ["claude-haiku-5-5", "Fastest and cheapest · Recommended"],
    ["claude-opus-5-5", "Most careful. Slower and pricier"],
    ["claude-opus-4-8", "Earlier version"],
  ]);
  assert.deepEqual([catalog.recommended, catalog.selected, catalog.fromFallback], ["claude-haiku-5-5", "claude-haiku-5-5", false]);
  assert.equal(selectedName(catalog), "Haiku 5.5");
  // A saved choice is shown even when the list can't be fetched, and stays chosen.
  const offline = keyModels("openai", null, { id: "gpt-6.2-astra", name: "GPT-6.2 Astra" });
  assert.deepEqual([offline.fromFallback, offline.selected, offline.models[0].id], [true, "gpt-6.2-astra", "gpt-6-luna"]);
  assert.deepEqual(offline.models.map(model => model.id), FALLBACK_MODELS.openai.map(model => model.id));
  const kept = keyModels("anthropic", listed, { id: "claude-custom-1", name: "Custom" });
  assert.equal(kept.models.at(-1).id, "claude-custom-1");
  // The recommended model is listed even if the account's list leaves it out.
  assert.equal(keyModels("anthropic", [listed[0]], null).models[0].id, "claude-haiku-5-5");
});

test("ChatGPT's list has the same shape, with Automatic recommended", () => {
  const catalog = chatgptModels({ choices: [{ slug: "gpt-6.2-sol", display_name: "GPT-6.2 Sol" }, { slug: "gpt-6-luna" }], preferred: "gpt-6-luna" });
  assert.deepEqual(catalog.models.map(model => [model.id, model.name]), [[AUTOMATIC, "Automatic"], ["gpt-6.2-sol", "Sol 6.2"], ["gpt-6-luna", "Luna 6"]]);
  assert.deepEqual([catalog.provider, catalog.recommended, catalog.selected], ["chatgpt", AUTOMATIC, "gpt-6-luna"]);
  assert.equal(chatgptModels({ choices: [{ slug: "gpt-6-luna" }], preferred: "retired" }).selected, AUTOMATIC);
  assert.equal(chatgptModels({ choices: [], preferred: "kept", issue: { kind: "temporary" } }).selected, "kept");
});

test("preferences: search is on unless turned off; a key's model is remembered without reconnecting", async () => {
  const values = new Map();
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } };
  const preferences = createAIPreferences({ storage, owner: "local" });
  assert.deepEqual(await preferences.read(), { search: true, models: { anthropic: null, openai: null } });
  await Promise.all([preferences.setModel("openai", { id: "gpt-6.2-sol", name: "GPT-6.2 Sol", detail: "dropped", effort: true }), preferences.setSearch(false)]);
  assert.deepEqual(await preferences.read(), { search: false, models: { anthropic: null, openai: { id: "gpt-6.2-sol", name: "GPT-6.2 Sol", effort: true } } });
  assert.deepEqual([...values.keys()], [preferencesKey("local")]);
  assert.equal(preferencesKey("local"), "calmera.ai.v1.local", "a calmera key, so Erase all data removes it");
  await preferences.setModel("openai", null);
  assert.equal(await preferences.model("openai"), null);
  values.set(preferencesKey("local"), "{broken");
  assert.deepEqual(await preferences.read(), normalizePreferences(null));
  assert.equal(normalizePreferences({ models: { openai: { id: "../../etc" } } }).models.openai, null);
  assert.throws(() => createAIPreferences({ storage, owner: "../x" }), /calmera_sign_in_required/);
});

test("requests name the chosen model, and a model that refuses a setting is asked once more without it", async () => {
  assert.equal(JSON.parse(mealRequest("openai", { key: KEYS.openai, instructions: "x", text: "apple" }).init.body).model, "gpt-6-luna");
  const chosen = JSON.parse(mealRequest("anthropic", { key: KEYS.anthropic, model: "claude-opus-5-5", instructions: "x", text: "apple", effort: false }).init.body);
  assert.deepEqual([chosen.model, chosen.output_config], ["claude-opus-5-5", undefined]);
  assert.equal(JSON.parse(mealRequest("openai", { key: KEYS.openai, model: "not a model!", instructions: "x", text: "apple" }).init.body).model, "gpt-6-luna");
  const bodies = [];
  let call = 0;
  const fetch = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return call++ === 0 ? answer(400, { error: { type: "invalid_request_error", message: "Unsupported parameter: 'reasoning.effort'" } })
      : answer(200, { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "[]" }] }] });
  };
  const complete = createApiKeyCompletion({ fetch, provider: "openai", key: KEYS.openai, model: "gpt-4.1" });
  assert.equal(await complete({ instructions: "x", text: "apple" }), "[]");
  assert.deepEqual(bodies.map(body => [body.model, Boolean(body.reasoning)]), [["gpt-4.1", true], ["gpt-4.1", false]]);
  // Once only, and never for anything but a plain 400.
  const refusing = createApiKeyCompletion({ fetch: async () => answer(400, { error: { message: "nope" } }), provider: "openai", key: KEYS.openai });
  await assert.rejects(refusing({ instructions: "x", text: "apple" }), error => error.message === "apikey_request_failed" && error.model === "gpt-6-luna");
  let tries = 0;
  const rejected = createApiKeyCompletion({ fetch: async () => { tries++; return answer(401, { error: { type: "authentication_error" } }); }, provider: "anthropic", key: KEYS.anthropic });
  await assert.rejects(rejected({ instructions: "x", text: "apple" }), /apikey_rejected/);
  assert.equal(tries, 1);
});

test("a model that can't read photos says so, and the fix is the recommended model", async () => {
  const fetch = async () => answer(400, { error: { type: "invalid_request_error", message: "Invalid content type. image_url is only supported by certain models." } });
  const complete = createApiKeyCompletion({ fetch, provider: "openai", key: KEYS.openai, model: "gpt-5.4-mini", effort: false });
  const error = await complete({ instructions: "x", text: "", image: "data:image/jpeg;base64,/9j/AAAA" }).catch(caught => caught);
  assert.deepEqual([error.message, testOutcome(error), error.provider, error.model], ["apikey_image_unsupported", "no-images", "openai", "gpt-5.4-mini"]);
  assert.match(loggingIssue(error).message, /^GPT-5\.4 mini can’t read photos/);
  const problem = loggingProblem(error);
  assert.deepEqual([problem.title, problem.action, problem.actionLabel, problem.provider, problem.recommended],
    ["Can’t read photos", "model", "Use Recommended", "openai", "Luna 6"]);
  // The same fix from the voice sheet: it opens no page, so it stays a button.
  assert.equal(loggingProblem(error, { inSheet: true }).action, "model");
  const unavailable = loggingProblem(Object.assign(new Error("apikey_model_unavailable"), { provider: "anthropic", model: "claude-opus-4-1" }));
  assert.deepEqual([unavailable.action, unavailable.recommended], ["model", "Haiku 5.5"]);
  assert.match(unavailable.message, /can’t use Opus 4\.1/);
  assert.equal(problemFor("key", "no-images", "openai", "GPT-5.4 mini").fix, "model");
  assert.equal(problemFor("chatgpt", "not-allowed").fix, null, "ChatGPT's plan access isn't a model choice");
  assert.match(apiKeyIssue("not-allowed", "anthropic").message, /can’t use Haiku 5\.5/);
});

test("model lists are fetched with the key's own headers, from the provider only", async () => {
  assert.deepEqual(modelsRequest("anthropic", KEYS.anthropic), { url: "https://api.anthropic.com/v1/models?limit=1000",
    init: { method: "GET", headers: { "x-api-key": KEYS.anthropic, "anthropic-version": "2026-10-21", Accept: "application/json" } } });
  assert.equal(modelsRequest("openai", KEYS.openai).init.headers.Authorization, `Bearer ${KEYS.openai}`);
  const seen = [];
  const data = await listModels({ fetch: async (url, init) => { seen.push([url, init.redirect]); return answer(200, { object: "list", data: [{ id: "gpt-6-luna" }] }); },
    provider: "openai", key: KEYS.openai });
  assert.deepEqual([data, seen], [[{ id: "gpt-6-luna" }], [["https://api.openai.com/v1/models", "error"]]]);
  await assert.rejects(listModels({ fetch: async () => answer(401, {}), provider: "openai", key: KEYS.openai }), /apikey_rejected/);
});

test("the same model page for every connection, and the row shows the choice", async () => {
  for (const [state, recommended] of [["chatgpt", AUTOMATIC], ["claude-key", "claude-haiku-5-5"]]) {
    const services = previewConnectionServices(state);
    const catalog = await services.models();
    assert.deepEqual([catalog.recommended, catalog.selected, catalog.models[0].id], [recommended, recommended, recommended], state);
    await services.setModel(catalog, catalog.models[1]);
    assert.equal((await services.models()).selected, catalog.models[1].id, state);
    const controller = createConnectionController(services);
    await controller.open();
    assert.equal(controller.state.model, catalog.models[1].name, state);
    await services.setModel(catalog, catalog.models[0]);
    assert.equal((await services.models()).selected, recommended, `${state}: back to the recommended one`);
  }
  assert.equal(await previewConnectionServices("none").models(), null);
});
