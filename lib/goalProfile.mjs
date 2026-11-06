// Bound credentials, fetch, and GET JSON parsing as one operation. Writes are
// never retried and successful PUTs do not require a response body.
async function goalProfileRequest({ getToken, url, signal, timeoutMs = 20000, fetchImpl = fetch,
  isActive = () => true, method = "GET", body }) {
  let dispatched = false, rejectedBeforeWrite = false, timedOut = false, cancelled = false;
  const failedCode = method === "GET" ? "goals_load_failed" : "goals_save_failed";
  const failure = code => Object.assign(new Error(code), {
    code, dispatched, mayHaveSaved: method === "PUT" && dispatched && !rejectedBeforeWrite, timedOut, cancelled,
  });
  if (typeof getToken !== "function" || typeof fetchImpl !== "function" || typeof isActive !== "function"
    || typeof url !== "string" || !url.trim() || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw failure(failedCode);
  if (!isActive() || signal?.aborted) { cancelled = true; throw failure("goals_request_cancelled"); }
  const controller = new AbortController();
  const expiresAt = Date.now() + timeoutMs;
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = timeout => {
    if (controller.signal.aborted) return;
    timedOut = timeout;
    cancelled = !timeout;
    controller.abort();
    rejectAbort(failure(timeout ? "goals_request_timeout" : "goals_request_cancelled"));
  };
  const externalAbort = () => abort(false);
  signal?.addEventListener("abort", externalAbort, { once: true });
  if (signal?.aborted) externalAbort();
  const timer = setTimeout(() => abort(true), timeoutMs);
  const check = () => {
    if (!isActive()) {
      cancelled = true;
      controller.abort();
      throw failure("goals_request_cancelled");
    }
    if (!controller.signal.aborted && Date.now() >= expiresAt) abort(true);
    if (controller.signal.aborted) throw failure(timedOut ? "goals_request_timeout" : "goals_request_cancelled");
  };
  const request = (async () => {
    check();
    let requestBody;
    try { requestBody = body ? JSON.stringify(body) : undefined; }
    catch { throw failure(failedCode); }
    let token;
    try { token = await getToken(); }
    catch { check(); throw failure(failedCode); }
    check();
    if (!token) throw failure("goals_sign_in_required");
    let response;
    try {
      dispatched = true;
      response = await fetchImpl(url, {
        method, ...(body ? { body: requestBody } : {}),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
    } catch { check(); throw failure(failedCode); }
    check();
    if (!response?.ok) {
      // update-user validates400 before writing;401/403 reject at the auth gate.
      // Its404 occurs AFTER the goals UPSERT, so404/5xx/unknown remain uncertain.
      rejectedBeforeWrite = method === "PUT" && [400, 401, 403].includes(response?.status);
      throw failure(failedCode);
    }
    if (method !== "GET") return undefined;
    let data;
    try { data = await response.json(); }
    catch { check(); throw failure(failedCode); }
    check();
    return data;
  })();
  try { return await Promise.race([request, aborted]); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", externalAbort);
  }
}

export function fetchGoalProfile(options) { return goalProfileRequest({ ...options, method: "GET" }); }
export function saveGoalProfile(options) { return goalProfileRequest({ ...options, method: "PUT" }); }

export function goalSaveErrorMessage(error) {
  const knownNonWrite = error?.mayHaveSaved === false || error?.dispatched === false
    || error?.message === "goals_sign_in_required";
  if (error?.mayHaveSaved === true || !knownNonWrite) {
    return "Your goals may have saved. Check Today before trying again.";
  }
  if (error?.timedOut || error?.message === "goals_request_timeout") {
    return "Saving took too long. Try again.";
  }
  return "Try again in a moment.";
}
