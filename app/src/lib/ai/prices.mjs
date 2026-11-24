// List prices for estimating what AI requests cost, in US dollars. These are estimates for the
// usage page only: the provider's bill is the real number.
// Checked 2026-11-21 against:
//   Anthropic  https://platform.claude.com/docs/en/about-claude/pricing (model table, and web
//              search at $10 per 1,000 searches; search results count as input tokens)
//   OpenAI     https://developers.openai.com/api/docs/pricing (the four current GPT-6 models, for
//              prompts up to 272K tokens; web search at $10 per 1,000 calls, its content tokens
//              at the model's rates)
// Models not listed here (older OpenAI models had no price on that page) show tokens only.
// A ChatGPT sign-in is paid for by the plan, so it has no price here at all.
export const PRICES_CHECKED = "2026-11-21";

// $ per million tokens. cached: cache reads. cacheWrite: 5-minute cache writes (Anthropic).
// long: Claude Haiku 5.5's higher prices for prompts over 100,000 tokens.
const claude = (input, cached, cacheWrite, output, long) => Object.freeze({ input, cached, cacheWrite, output, ...(long ? { long } : {}) });
const gpt = (input, cached, output) => Object.freeze({ input, cached, output });

export const PRICES = Object.freeze({
  anthropic: Object.freeze({
    perSearch: 0.01,
    models: Object.freeze({
      "claude-fable-5-2": claude(8, 0.2, 10, 40),
      "claude-mythos-5-2": claude(8, 0.2, 10, 40),
      "claude-fable-5-1": claude(10, 0.25, 12.5, 50),
      "claude-mythos-5-1": claude(10, 0.25, 12.5, 50),
      "claude-fable-5": claude(10, 1, 12.5, 50),
      "claude-mythos-5": claude(10, 1, 12.5, 50),
      "claude-opus-5-5": claude(4, 0.2, 5, 20),
      "claude-opus-5": claude(5, 0.5, 6.25, 25),
      "claude-opus-4-8": claude(5, 0.5, 6.25, 25),
      "claude-opus-4-7": claude(5, 0.5, 6.25, 25),
      "claude-opus-4-6": claude(5, 0.5, 6.25, 25),
      "claude-opus-4-5": claude(5, 0.5, 6.25, 25),
      "claude-sonnet-5-5": claude(2, 0.1, 2.5, 10),
      "claude-sonnet-5": claude(2, 0.2, 2.5, 10),
      "claude-sonnet-4-6": claude(3, 0.3, 3.75, 15),
      "claude-sonnet-4-5": claude(3, 0.3, 3.75, 15),
      "claude-haiku-5-5": claude(0.1, 0.01, 0.125, 0.5, Object.freeze({ above: 100000, input: 0.5, cached: 0.05, cacheWrite: 0.625, output: 2.5 })),
      "claude-haiku-4-5": claude(1, 0.1, 1.25, 5),
    }),
  }),
  openai: Object.freeze({
    perSearch: 0.01,
    models: Object.freeze({
      "gpt-6.2-astra": gpt(8, 0.4, 40),
      "gpt-6.2-sol": gpt(2, 0.1, 10),
      "gpt-6.1-terra": gpt(1, 0.05, 5),
      "gpt-6-luna": gpt(0.1, 0.01, 0.5),
    }),
  }),
});

// A dated snapshot costs what its model does: "claude-haiku-4-5-20251001", "gpt-6-luna-2026-06-01".
export function priceFor(provider, model) {
  const table = PRICES[provider]?.models;
  if (!table || typeof model !== "string") return null;
  return table[model] || table[model.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "")] || null;
}

// What one request cost, from its token counts. input counts every input token, cached and
// cache-written ones included. Null when the model has no known price, or for ChatGPT.
export function requestCost({ provider, model, input, output, cached = 0, cacheWrite = 0, searches = 0 }) {
  const price = priceFor(provider, model);
  if (!price || !Number.isFinite(input) || !Number.isFinite(output)) return null;
  const rates = price.long && input > price.long.above ? price.long : price;
  const reads = cached || 0, writes = cacheWrite || 0;
  const plain = Math.max(0, input - reads - writes);
  const tokens = plain * rates.input + reads * rates.cached + writes * (rates.cacheWrite ?? rates.input) + output * rates.output;
  return tokens / 1e6 + (searches || 0) * PRICES[provider].perSearch;
}
