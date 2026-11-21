import test from "node:test";
import assert from "node:assert/strict";
import { modelChipLabel, providerName } from "../lib/mealLogPresentation.mjs";

test("the estimate names the provider that is actually connected", () => {
  assert.equal(providerName("chatgpt"), "ChatGPT");
  assert.equal(providerName("openai-key"), "OpenAI");
  assert.equal(providerName("claude-key"), "Claude");
  assert.equal(providerName(undefined), "ChatGPT", "a ChatGPT check result carries no type");
});

test("the voice chip never says ChatGPT for a key, and never repeats the name", () => {
  assert.equal(modelChipLabel("chatgpt", "GPT-6.1 Sol"), "ChatGPT · GPT-6.1 Sol");
  assert.equal(modelChipLabel("openai-key", "GPT-6 Luna"), "OpenAI · GPT-6 Luna");
  assert.equal(modelChipLabel("claude-key", "Claude Haiku 5.5"), "Claude Haiku 5.5");
  assert.equal(modelChipLabel("claude-key", null), "Claude");
});
