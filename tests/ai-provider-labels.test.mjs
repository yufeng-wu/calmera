import test from "node:test";
import assert from "node:assert/strict";
import { modelChipLabel, providerName } from "../lib/mealLogPresentation.mjs";

test("the estimate names the provider that is actually connected", () => {
  assert.equal(providerName("chatgpt"), "ChatGPT");
  assert.equal(providerName("openai-key"), "OpenAI");
  assert.equal(providerName("claude-key"), "Anthropic");
  assert.equal(providerName(undefined), "ChatGPT", "a ChatGPT check result carries no type");
});

test("the voice chip never says ChatGPT for a key, and never repeats the name", () => {
  assert.equal(modelChipLabel("chatgpt", "GPT-6.1 Sol"), "ChatGPT · GPT-6.1 Sol");
  assert.equal(modelChipLabel("openai-key", "GPT-6 Luna"), "OpenAI · GPT-6 Luna");
  assert.equal(modelChipLabel("openai-key", "OpenAI o3"), "OpenAI o3");
  // Model names now leave out the maker, so the chip says whose it is.
  assert.equal(modelChipLabel("claude-key", "Haiku 5.5"), "Anthropic · Haiku 5.5");
  assert.equal(modelChipLabel("chatgpt", "Sol 6.2"), "ChatGPT · Sol 6.2");
  assert.equal(modelChipLabel("claude-key", null), "Anthropic");
});
