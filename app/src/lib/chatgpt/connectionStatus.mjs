// Keep provider bodies and credentials out of UI errors and diagnostics.
export async function openAIResponseError(response) {
  const error = new Error(`openai_http_${response.status}`);
  error.status = response.status;
  try {
    const body = await response.json();
    const code = typeof body?.error === "string" ? body.error : body?.error?.code;
    if (typeof code === "string" && /^[a-z0-9_]{1,100}$/.test(code)) error.apiCode = code;
  } catch { /* Empty/non-JSON error bodies still retain their HTTP status. */ }
  return error;
}

export function connectionIssue(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  const code = error?.apiCode || message;
  const status = error?.status || Number(message.match(/^openai_http_(\d{3})$/)?.[1]);
  if (code === "subscription_sharing_usage_limit_exceeded") return {
    kind: "limited", title: "Usage limit reached", message: "Review your plan or calmera’s limit in ChatGPT settings.", action: "usage",
  };
  if (/^(invalid_grant|invalid_refresh_token|token_expired|refresh_token_expired|refresh_token_invalidated|refresh_token_reused|refresh_token_invalid|chatgpt_sign_in_required|chatgpt_refresh_required|invalid_chatgpt_identity|id_token_required|subscription_sharing_invalid_user)$/.test(code) || status === 401) return {
    kind: "sign-in", title: "ChatGPT session expired", message: "Sign in to ChatGPT again to estimate nutrition.", action: "sign-in",
  };
  if (code === "plan_permission_required") return {
    kind: "sign-in", title: "Couldn’t access your plan", message: "Sign in to ChatGPT and allow calmera to use your plan.", action: "sign-in",
  };
  if (code === "development_build_required") return {
    kind: "unavailable", title: "ChatGPT unavailable", message: "Update calmera to connect your ChatGPT plan.", action: null,
  };
  if (code === "no_eligible_models" || code === "subscription_sharing_user_not_eligible" || status === 403) return {
    kind: "restricted", title: "Plan access unavailable", message: "ChatGPT plan access isn’t available for this account or workspace.", action: null,
  };
  if (code === "invalid_client" || (status === 400 && !["subscription_sharing_usage_unavailable", "subscription_sharing_user_unavailable"].includes(code))) return {
    kind: "unavailable", title: "Connection needs attention", message: "ChatGPT couldn’t accept this connection.", action: null,
  };
  if (status === 429) return {
    kind: "temporary", title: "ChatGPT is busy", message: "ChatGPT is temporarily limiting requests.", action: "retry",
  };
  return { kind: "temporary", title: "Connection unavailable", message: "Couldn’t check your connection. Try again in a moment.", action: "retry" };
}

export const isAuthorizationCancelled = error => /authorization_cancelled|ERR_CANCELED|ERR_REQUEST_CANCELED/.test(`${error?.code || ""} ${error?.message || ""}`);

// Display metadata from an ID token already validated by the native verifier.
// This is not token verification and must never authorize a request. Require
// matching issuer, subject and audience before displaying a retained email.
export function savedChatGPTAccount(record) {
  if (!record?.client_id) return null;
  const account = { email: null, hasRegistration: true };
  try {
    const parts = record.id_token.split(".");
    if (parts.length !== 3 || record.id_token.length > 64000 || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || parts[1].length % 4 === 1) return account;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bits = 0, value = 0, escaped = "";
    for (const character of parts[1].replace(/-/g, "+").replace(/_/g, "/")) {
      value = (value << 6) | alphabet.indexOf(character); bits += 6;
      if (bits >= 8) {
        bits -= 8;
        escaped += `%${((value >>> bits) & 255).toString(16).padStart(2, "0")}`;
      }
    }
    const claims = JSON.parse(decodeURIComponent(escaped));
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== "https://auth.openai.com" || claims.iss !== record.identity?.iss
      || claims.sub !== record.identity?.sub || !audiences.includes(record.client_id)) return account;
    if (typeof claims.email === "string" && claims.email.length <= 320 && /^[^\s@\u0000-\u001f\u007f]+@[^\s@\u0000-\u001f\u007f]+$/.test(claims.email)) account.email = claims.email;
  } catch { /* Old records without display metadata remain usable. */ }
  return account;
}
