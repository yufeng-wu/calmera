// Bound the whole write, including credential lookup/response parsing. Never
// retry writes; a lost POST response is explicitly uncertain, not a safe retry.
export async function mealRequest({ getToken, url, body, method = "POST", signal,
  timeoutMs = 20000, fetchImpl = fetch, readResult }) {
  const controller = new AbortController();
  let dispatched = false;
  let rejectedByServer = false;
  let timedOut = false;
  let rejectAbort;
  const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = () => {
    controller.abort();
    rejectAbort(new Error(timedOut ? "meal_request_timeout" : "meal_request_cancelled"));
  };
  if (signal?.aborted) throw Object.assign(new Error("meal_request_cancelled"), { dispatched: false, uncertain: false, mayHaveSaved: false, cancelled: true, timedOut: false });
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
  const request = (async () => {
    const token = await getToken();
    if (controller.signal.aborted) throw new Error("meal_request_cancelled");
    if (!token) throw new Error("calmera_sign_in_required");
    const requestBody = JSON.stringify(body);
    dispatched = true;
    const response = await fetchImpl(url, {
      method, signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: requestBody,
    });
    if (controller.signal.aborted) throw new Error("meal_request_cancelled");
    if (!response.ok) {
      rejectedByServer = Number(response.status) >= 400 && Number(response.status) < 500;
      const details = await Promise.resolve(response.json?.()).catch(() => null);
      throw new Error((Array.isArray(details?.details) ? details.details.join("\n") : null)
        || details?.error || details?.message || "Could not save your meal. Please try again.");
    }
    return readResult ? readResult(response) : response;
  })();
  try { return await Promise.race([request, cancelled]); }
  catch (cause) {
    const error = new Error(cause?.message || "meal_save_failed");
    error.dispatched = dispatched;
    error.mayHaveSaved = dispatched && !rejectedByServer;
    error.uncertain = method === "POST" && error.mayHaveSaved;
    error.cancelled = controller.signal.aborted && !timedOut;
    error.timedOut = timedOut;
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
