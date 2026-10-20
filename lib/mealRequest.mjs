// Bound the whole write, including credential lookup/response parsing. Never
// retry writes; a lost POST response is explicitly uncertain, not a safe retry.
export async function mealRequest({ getToken, url, body, method = "POST", signal,
  timeoutMs = 20000, fetchImpl = fetch, readResult, isActive = () => true }) {
  const controller = new AbortController();
  let dispatched = false, rejectedByServer = false, timedOut = false, ownerCancelled = false;
  let acknowledged = false, acknowledgedResult;
  const decorate = cause => {
    const error = new Error(cause?.message || "meal_save_failed");
    error.dispatched = dispatched;
    error.mayHaveSaved = dispatched && !rejectedByServer;
    error.uncertain = method === "POST" && error.mayHaveSaved;
    error.cancelled = (controller.signal.aborted || ownerCancelled) && !timedOut;
    error.timedOut = timedOut;
    // Only results acknowledged before cancellation/deadline reach bookkeeping.
    // Later readResult completions cannot mutate an already-returned error.
    if (acknowledged) error.acknowledgedResult = acknowledgedResult;
    return error;
  };
  if (signal?.aborted || !isActive()) {
    ownerCancelled = true;
    controller.abort();
    throw decorate(new Error("meal_request_cancelled"));
  }
  const expiresAt = Date.now() + timeoutMs;
  let rejectAbort;
  const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = timeout => {
    if (controller.signal.aborted) return;
    timedOut = timeout;
    controller.abort();
    rejectAbort(new Error(timeout ? "meal_request_timeout" : "meal_request_cancelled"));
  };
  const externalAbort = () => abort(false);
  signal?.addEventListener("abort", externalAbort, { once: true });
  if (signal?.aborted) externalAbort();
  const timer = setTimeout(() => abort(true), timeoutMs);
  const check = () => {
    if (!isActive()) {
      ownerCancelled = true;
      controller.abort();
      throw new Error("meal_request_cancelled");
    }
    if (!controller.signal.aborted && Date.now() >= expiresAt) abort(true);
    if (controller.signal.aborted) throw new Error(timedOut ? "meal_request_timeout" : "meal_request_cancelled");
  };
  const request = (async () => {
    check();
    const token = await getToken();
    check();
    if (!token) throw new Error("calmera_sign_in_required");
    const requestBody = JSON.stringify(body);
    check();
    dispatched = true;
    const response = await fetchImpl(url, {
      method, signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: requestBody,
    });
    check();
    if (!response.ok) {
      rejectedByServer = Number(response.status) >= 400 && Number(response.status) < 500;
      check();
      let details;
      try { details = await response.json?.(); } catch { details = null; }
      check();
      throw new Error((Array.isArray(details?.details) ? details.details.join("\n") : null)
        || details?.error || details?.message || "Could not save your meal. Please try again.");
    }
    check();
    if (!readResult) return response;
    const result = await readResult(response);
    if (!controller.signal.aborted && Date.now() < expiresAt) {
      acknowledged = true;
      acknowledgedResult = result;
    }
    check();
    return result;
  })();
  try { return await Promise.race([request, cancelled]); }
  catch (cause) {
    let failure = cause;
    try { check(); } catch (inactive) { failure = inactive; }
    throw decorate(failure);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", externalAbort);
  }
}
