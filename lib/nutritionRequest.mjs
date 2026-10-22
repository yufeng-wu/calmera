// One bounded nutrition read, including credentials and JSON parsing. No
// retries, resource selection, cache policy, or error response bodies live here.
export async function readNutrition({ getToken, url, signal, isActive = () => true,
  timeoutMs = 20000, fetchImpl = fetch }) {
  const failure = code => {
    const error = new Error(code);
    error.code = code;
    // Existing stores suppress cancelled work rather than publishing an error.
    if (code === "nutrition_request_cancelled") error.name = "AbortError";
    return error;
  };
  if (typeof getToken !== "function" || typeof fetchImpl !== "function" || typeof isActive !== "function"
    || typeof url !== "string" || !url.trim() || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw failure("nutrition_request_failed");
  }
  if (!isActive()) throw failure("nutrition_store_disposed");
  if (signal?.aborted) throw failure("nutrition_request_cancelled");
  const controller = new AbortController();
  const expiresAt = Date.now() + timeoutMs;
  let timedOut = false;
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = timeout => {
    if (controller.signal.aborted) return;
    timedOut = timeout;
    controller.abort();
    rejectAbort(failure(timeout ? "nutrition_request_timeout" : "nutrition_request_cancelled"));
  };
  const externalAbort = () => abort(false);
  signal?.addEventListener("abort", externalAbort, { once: true });
  if (signal?.aborted) externalAbort();
  const timer = setTimeout(() => abort(true), timeoutMs);
  const check = () => {
    if (!isActive()) throw failure("nutrition_store_disposed");
    if (!controller.signal.aborted && Date.now() >= expiresAt) abort(true);
    if (controller.signal.aborted) throw failure(timedOut ? "nutrition_request_timeout" : "nutrition_request_cancelled");
  };
  const request = (async () => {
    check();
    let token;
    try { token = await getToken(); }
    catch { check(); throw failure("nutrition_request_failed"); }
    check();
    if (!token) throw failure("calmera_sign_in_required");
    let response;
    try {
      response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    } catch { check(); throw failure("nutrition_request_failed"); }
    check();
    if (!response?.ok) {
      const status = response?.status;
      throw failure(Number.isInteger(status) && status >= 100 && status <= 599
        ? `nutrition_http_${status}` : "nutrition_request_failed");
    }
    let data;
    try { data = await response.json(); }
    catch { check(); throw failure("nutrition_request_failed"); }
    check();
    return data;
  })();
  try { return await Promise.race([request, aborted]); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", externalAbort);
  }
}
