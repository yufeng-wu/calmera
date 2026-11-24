import test from "node:test";
import assert from "node:assert/strict";
import { safeDiagnosticCode } from "../src/lib/chatgpt/diagnostics.mjs";

test("test diagnostics expose only bounded codes, never private error text or attributes", () => {
  const privateText = "synthetic-private-token-and-food-input";
  assert.equal(safeDiagnosticCode({message:privateText, token:privateText}), "unclassified_failure");
  assert.equal(safeDiagnosticCode({message:privateText, code:privateText}), "unclassified_failure");
  assert.equal(safeDiagnosticCode({message:"keychain -25308: User interaction is not allowed."}), "device_keychain_locked");
  assert.equal(safeDiagnosticCode(new Error("openai_http_400")), "openai_http_400");
  assert.equal(safeDiagnosticCode(new Error("inference_not_completed")), "inference_not_completed");
  assert.equal(safeDiagnosticCode(new SyntaxError(privateText)), "invalid_estimate_json");
});
