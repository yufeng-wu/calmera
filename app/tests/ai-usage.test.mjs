import test from "node:test";
import assert from "node:assert/strict";
import { PRICES, PRICES_CHECKED, priceFor, requestCost } from "../src/lib/ai/prices.mjs";
import { USAGE_DAYS, createUsageLog, formatCost, formatTokens, summarizeUsage, usageDays, usageKey, usageRow, usageValue } from "../src/lib/ai/usage.mjs";
import { createApiKeyCompletion, testApiKey, usageOf } from "../src/lib/ai/providers.mjs";
import { createConnectionController } from "../src/lib/ai/connectionController.mjs";
import { previewConnectionServices, sampleUsage } from "../src/lib/ai/previewConnection.mjs";

const KEYS = { anthropic: "sk-ant-FAKE-test-key-0000-WXYZ", openai: "sk-proj-FAKE-test-key-0000-ABCD" };
const answer = (status, body) => ({ ok: status < 400, status, json: async () => body });
const NOW = new Date(2026, 10, 21, 15, 0);   // 21 Nov 2026, local time
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

test("prices: one table, checked on a date, dated snapshots priced like their model", () => {
  assert.equal(PRICES_CHECKED, "2026-11-21");
  assert.deepEqual(priceFor("anthropic", "claude-haiku-4-5-20251001"), PRICES.anthropic.models["claude-haiku-4-5"]);
  assert.deepEqual(priceFor("openai", "gpt-6-luna-2026-06-01"), PRICES.openai.models["gpt-6-luna"]);
  assert.equal(priceFor("openai", "gpt-5.4-mini"), null, "no listed price: tokens only");
  assert.equal(priceFor("chatgpt", "gpt-6.2-sol"), null, "the plan pays");
  assert.deepEqual([PRICES.anthropic.perSearch, PRICES.openai.perSearch], [0.01, 0.01]);
});

test("what one request cost, from its tokens and searches", () => {
  // Haiku 5.5: 2,000 input tokens ($0.10/M) + 500 output ($0.50/M) + one search ($0.01).
  close(requestCost({ provider: "anthropic", model: "claude-haiku-5-5", input: 2000, output: 500, searches: 1 }), 0.0002 + 0.00025 + 0.01);
  // Cache reads and writes are priced as such; input counts them.
  close(requestCost({ provider: "anthropic", model: "claude-opus-5-5", input: 3000, cached: 1000, cacheWrite: 1000, output: 100 }),
    (1000 * 4 + 1000 * 0.2 + 1000 * 5 + 100 * 20) / 1e6);
  // Haiku 5.5 costs more for a prompt over 100,000 tokens.
  close(requestCost({ provider: "anthropic", model: "claude-haiku-5-5", input: 200000, output: 0 }), 200000 * 0.5 / 1e6);
  close(requestCost({ provider: "openai", model: "gpt-6.2-sol", input: 2000, cached: 500, output: 400 }), (1500 * 2 + 500 * 0.1 + 400 * 10) / 1e6);
  assert.equal(requestCost({ provider: "openai", model: "gpt-5.4-mini", input: 10, output: 10 }), null);
  assert.equal(requestCost({ provider: "anthropic", model: "claude-haiku-5-5", input: null, output: null }), null, "no counts, no price");
});

test("a record keeps numbers and a model id, nothing else", () => {
  const row = usageRow({ provider: "anthropic", model: "claude-haiku-5-5", input: 2000.4, output: 500, searches: 1,
    text: "a bibimbap from Life Alive", key: KEYS.anthropic }, NOW);
  assert.deepEqual(row, { at: NOW.getTime(), day: "2026-11-21", provider: "anthropic", model: "claude-haiku-5-5",
    input: 2000, output: 500, cached: 0, cacheWrite: 0, searches: 1 });
  assert.equal(usageRow({ provider: "gemini", model: "x" }, NOW), null);
  assert.equal(usageRow({ provider: "openai", model: "../../etc" }, NOW), null);
  assert.deepEqual(usageRow({ provider: "chatgpt", model: "gpt-6.2-sol", input: null, output: undefined }, NOW).input, null, "unknown stays unknown");
});

test("the log keeps 7 days on this iPhone and survives a broken store", async () => {
  const values = new Map();
  let now = NOW;
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } };
  const log = createUsageLog({ storage, owner: "local", now: () => now });
  assert.equal(usageKey("local"), "calmera.usage.v1.local", "a calmera key, so Erase all data removes it");
  await Promise.all([1, 2, 3].map(() => log.record({ provider: "openai", model: "gpt-6-luna", input: 100, output: 10 })));
  assert.equal((await log.rows()).length, 3, "writes go one at a time");
  now = new Date(2026, 10, 28, 9, 0);   // a week later: those are 8 days old
  await log.record({ provider: "anthropic", model: "claude-haiku-5-5", input: 100, output: 10 });
  assert.deepEqual((await log.rows()).map(row => row.day), ["2026-11-28"]);
  assert.deepEqual(JSON.parse(values.get("calmera.usage.v1.local")).map(row => row.day), ["2026-11-28"], "older rows are pruned, not just hidden");
  values.set("calmera.usage.v1.local", "{broken");
  assert.deepEqual(await log.rows(), []);
  const failing = createUsageLog({ storage: { getItem: async () => null, setItem: async () => { throw new Error("full"); } }, owner: "local" });
  await failing.record({ provider: "openai", model: "gpt-6-luna", input: 1, output: 1 });   // doesn't throw
  assert.throws(() => createUsageLog({ storage, owner: "../x" }), /calmera_sign_in_required/);
});

test("the week, each company and each model, with costs where there's a price", () => {
  assert.deepEqual(usageDays(NOW).map(day => day.key), ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"]);
  assert.equal(USAGE_DAYS, 7);
  const summary = summarizeUsage([...sampleUsage(NOW), { ...usageRow({ provider: "anthropic", model: "claude-haiku-5-5", input: 1, output: 1 }, new Date(2026, 10, 1)) }], NOW);
  assert.deepEqual(summary.days.map(day => day.requests), [3, 2, 4, 2, 5, 4, 4], "a row from outside the week isn't counted");
  assert.deepEqual(summary.companies.map(company => company.name), ["Anthropic", "OpenAI", "ChatGPT"]);
  const [anthropic, openai, chatgpt] = summary.companies;
  assert.deepEqual(anthropic.models.map(model => [model.name, model.requests]), [["Haiku 5.5", 12], ["Sonnet 5.5", 1]]);
  assert.equal(chatgpt.cost, null);
  assert.deepEqual(chatgpt.models.map(model => [model.name, model.cost, model.input]), [["Sol 6.2", null, 4800]], "tokens when ChatGPT reports them");
  close(summary.total.cost, anthropic.cost + openai.cost);
  assert.deepEqual([summary.total.requests, summary.total.plan, summary.total.priced, summary.total.unpriced], [24, 6, 18, 0]);
  const unpriced = summarizeUsage([usageRow({ provider: "openai", model: "gpt-5.4-mini", input: 100, output: 10 }, NOW)], NOW);
  assert.deepEqual([unpriced.companies[0].unpriced, unpriced.companies[0].models[0].cost, unpriced.total.priced], [1, null, 0]);
});

test("numbers read plainly", () => {
  assert.deepEqual([0, 0.004, 0.0151, 2.5, 1234].map(formatCost), ["$0", "<$0.01", "$0.02", "$2.50", "$1,234"]);
  assert.deepEqual([0, 980, 1500, 81234, 1234567].map(formatTokens), ["0", "980", "1.5k", "81k", "1.2M"]);
  assert.equal(usageValue(summarizeUsage([], NOW)), "None yet");
  // The AI connection page shows no prices: the row counts requests, every connection together.
  assert.equal(usageValue(summarizeUsage(sampleUsage(NOW), NOW)), "24 requests");
  assert.equal(usageValue(summarizeUsage([usageRow({ provider: "chatgpt", model: "gpt-6.2-sol" }, NOW)], NOW)), "1 request");
});

test("every billed reply is reported, from each provider's own counts", async () => {
  assert.deepEqual(usageOf("anthropic", { model: "claude-haiku-5-5", usage: { input_tokens: 100, cache_read_input_tokens: 50, cache_creation_input_tokens: 25,
    output_tokens: 40, server_tool_use: { web_search_requests: 2 } } }, "claude-haiku-5-5"),
  { provider: "anthropic", model: "claude-haiku-5-5", input: 175, output: 40, cached: 50, cacheWrite: 25, searches: 2 });
  assert.deepEqual(usageOf("openai", { usage: { input_tokens: 300, output_tokens: 20, input_tokens_details: { cached_tokens: 100 } },
    output: [{ type: "web_search_call" }], tool_usage: { web_search: { num_requests: 1 } } }, "gpt-6-luna"),
  { provider: "openai", model: "gpt-6-luna", input: 300, output: 20, cached: 100, searches: 1 });
  assert.deepEqual(usageOf("openai", {}, "gpt-6-luna"), { provider: "openai", model: "gpt-6-luna", input: null, output: null, searches: 0 });
  // A paused search turn is two billed replies; a refused setting's 400 isn't billed.
  const heard = [];
  const replies = [{ stop_reason: "pause_turn", model: "claude-haiku-5-5", content: [], usage: { input_tokens: 10, output_tokens: 1, server_tool_use: { web_search_requests: 1 } } },
    { stop_reason: "end_turn", model: "claude-haiku-5-5", content: [{ type: "text", text: "[]" }], usage: { input_tokens: 20, output_tokens: 2 } }];
  const complete = createApiKeyCompletion({ fetch: async () => answer(200, replies.shift()), provider: "anthropic", key: KEYS.anthropic, search: true,
    onUsage: entry => heard.push(entry) });
  await complete({ instructions: "x", text: "tea" });
  assert.deepEqual(heard.map(entry => [entry.input, entry.searches]), [[10, 1], [20, 0]]);
  const quiet = createApiKeyCompletion({ fetch: async () => answer(200, { stop_reason: "end_turn", content: [{ type: "text", text: "[]" }] }), provider: "anthropic",
    key: KEYS.anthropic, onUsage: () => { throw new Error("storage"); } });
  assert.equal(await quiet({ instructions: "x", text: "tea" }), "[]", "recording never fails the estimate");
  const tests = [];
  assert.equal(await testApiKey({ fetch: async () => answer(200, { status: "completed", output: [], usage: { input_tokens: 12, output_tokens: 2 } }),
    provider: "openai", key: KEYS.openai, onUsage: entry => tests.push(entry) }), "works");
  assert.deepEqual(tests, [{ provider: "openai", model: "gpt-6-luna", input: 12, output: 2, cached: 0, searches: 0 }], "a key check is billed, so it's counted");
});

test("the connection page shows the week whatever is connected, even nothing", async () => {
  const controller = createConnectionController(previewConnectionServices("none", { usage: sampleUsage() }));
  await controller.open();
  assert.equal(controller.state.current, null);
  assert.equal(controller.state.usage.total.requests, 24);
});
