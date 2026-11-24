// Diagnostics are codes only: never return a provider body, token, input or URL.
export function safeDiagnosticCode(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  const nativeCode = typeof error?.code === "string" ? error.code : "";
  if (/keychain|securestore|secure_store/i.test(nativeCode + message)) {
    return /25308|interaction is not allowed|device is locked/i.test(message)
      ? "device_keychain_locked" : "device_keychain_unavailable";
  }
  const known = new Set([
    "invalid_estimate", "invalid_inference_stream", "invalid_inference_completion",
    "inference_failed", "inference_not_completed", "inference_too_large",
    "invalid_model_catalog", "invalid_model", "plan_usage_unavailable",
    "chatgpt_sign_in_required", "chatgpt_refresh_required", "invalid_token_response",
    "invalid_meal_text", "invalid_meal_image", "no_food_detected",
    "on_device_voice_unavailable", "voice_permission_required", "invalid_voice_clip", "voice_timeout",
    "meal_save_failed", "meal_save_uncertain",
  ]);
  if (known.has(message) || /^openai_http_[1-5][0-9]{2}$/.test(message)) return message;
  if (error?.name === "SyntaxError") return "invalid_estimate_json";
  if (error?.name === "AbortError") return "request_timeout";
  if (error?.name === "TypeError") return "transport_or_runtime_type_error";
  if (/^(ERR|E)_[A-Z_]{2,60}$/.test(nativeCode)) return nativeCode;
  return "unclassified_failure";
}
