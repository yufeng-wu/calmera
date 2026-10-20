// One bounded DELETE; credential lookup is part of the same deadline. Never
// retry, send a body, or parse an error/deleted-record response payload here.
export async function deleteNutritionEntry({ getToken, url, signal, isActive = () => true,
  timeoutMs = 20000, fetchImpl = fetch }) {
  let dispatched = false, rejectedByServer = false, timedOut = false, cancelled = false;
  const failure = code => {
    const error = Object.assign(new Error(code), {
      code, dispatched, mayHaveDeleted: dispatched && !rejectedByServer, timedOut, cancelled,
    });
    if (code === "meal_delete_cancelled") error.name = "AbortError";
    return error;
  };
  if (typeof getToken !== "function" || typeof fetchImpl !== "function" || typeof isActive !== "function"
    || typeof url !== "string" || !url.trim() || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw failure("meal_delete_failed");
  }
  if (!isActive()) { cancelled = true; throw failure("nutrition_store_disposed"); }
  if (signal?.aborted) { cancelled = true; throw failure("meal_delete_cancelled"); }
  const controller = new AbortController();
  const expiresAt = Date.now() + timeoutMs;
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = timeout => {
    if (controller.signal.aborted) return;
    timedOut = timeout;
    cancelled = !timeout;
    controller.abort();
    rejectAbort(failure(timeout ? "meal_delete_timeout" : "meal_delete_cancelled"));
  };
  const externalAbort = () => abort(false);
  signal?.addEventListener("abort", externalAbort, { once: true });
  if (signal?.aborted) externalAbort();
  const timer = setTimeout(() => abort(true), timeoutMs);
  const check = () => {
    if (!isActive()) {
      cancelled = true;
      controller.abort();
      throw failure("nutrition_store_disposed");
    }
    if (!controller.signal.aborted && Date.now() >= expiresAt) abort(true);
    if (controller.signal.aborted) throw failure(timedOut ? "meal_delete_timeout" : "meal_delete_cancelled");
  };
  const request = (async () => {
    check();
    let token;
    try { token = await getToken(); }
    catch { check(); throw failure("meal_delete_failed"); }
    check();
    if (!token) throw failure("calmera_sign_in_required");
    let response;
    try {
      dispatched = true;
      response = await fetchImpl(url, { method: "DELETE", signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` } });
    } catch { check(); throw failure("meal_delete_failed"); }
    check();
    if (!response?.ok) {
      const status = response?.status;
      rejectedByServer = Number.isInteger(status) && status >= 400 && status < 500;
      throw failure("meal_delete_failed");
    }
    return { deleted: true };
  })();
  try { return await Promise.race([request, aborted]); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", externalAbort);
  }
}

// Keep the same optimistic-remove/rollback contract as the hook. Late work can
// settle its old store, but only the still-current owner may receive an error or
// refresh callback. The callback runs after removal bookkeeping is released.
export async function removeStoredNutritionEntry({ store, ownerKey, dateKey, id,
  getToken, url, signal, timeoutMs = 20000, fetchImpl = fetch, isActive = () => true, onSettled }) {
  const current = () => store.belongsTo(ownerKey) && isActive();
  if (!current()) return false;
  const removal = store.removeOptimistically(dateKey, id);
  if (!removal) return false;
  let succeeded = false;
  try {
    await deleteNutritionEntry({ getToken, url, signal, timeoutMs, fetchImpl, isActive: current });
    if (!current()) return false;
    succeeded = true;
    return true;
  } catch (error) {
    if (!current()) return false;
    throw error;
  } finally {
    store.finishRemoval(removal, succeeded);
    if (current()) onSettled?.();
  }
}
