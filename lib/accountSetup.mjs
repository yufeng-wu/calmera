// Confirm the Calmera profile after Clerk verification. A GET preflight is
// mandatory before the single optional POST; uncertain writes only trigger reads.
// No account/profile payload or credential is returned or logged.
export async function completeAccountSetup({ getToken, url, email, localDate,
  timeoutMs = 20000, pollCount = 10, pollIntervalMs = 300, signal, fetchImpl = fetch }) {
  let creationAttempted = false;
  let verificationAttempts = 0;
  let abortReason = null;
  const failure = code => Object.assign(new Error(code), {
    code, timedOut: abortReason === "timeout", cancelled: abortReason === "cancelled",
    creationAttempted, mayHaveCreated: creationAttempted, verificationAttempts,
  });
  if (typeof getToken !== "function" || typeof fetchImpl !== "function" || typeof url !== "string" || !url.trim()
    || typeof email !== "string" || typeof localDate !== "string" || !Number.isFinite(timeoutMs) || timeoutMs <= 0
    || !Number.isInteger(pollCount) || pollCount < 1 || !Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw failure("account_setup_invalid_options");
  }
  if (signal?.aborted) {
    abortReason = "cancelled";
    throw failure("account_setup_cancelled");
  }
  const controller = new AbortController();
  const expiresAt = Date.now() + timeoutMs;
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = reason => {
    if (controller.signal.aborted) return;
    abortReason = reason;
    controller.abort();
    rejectAbort(failure(reason === "timeout" ? "account_setup_timeout" : "account_setup_cancelled"));
  };
  const externalAbort = () => abort("cancelled");
  signal?.addEventListener("abort", externalAbort, { once: true });
  if (signal?.aborted) externalAbort();
  const timer = setTimeout(() => abort("timeout"), timeoutMs);
  const check = () => {
    if (!controller.signal.aborted && Date.now() >= expiresAt) abort("timeout");
    if (controller.signal.aborted) throw failure(abortReason === "timeout" ? "account_setup_timeout" : "account_setup_cancelled");
  };
  const wait = () => new Promise((resolve, reject) => {
    const cleanup = () => controller.signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      clearTimeout(delay);
      cleanup();
      reject(failure(abortReason === "timeout" ? "account_setup_timeout" : "account_setup_cancelled"));
    };
    const delay = setTimeout(() => { cleanup(); resolve(); }, pollIntervalMs);
    controller.signal.addEventListener("abort", onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
  });
  const request = (async () => {
    check();
    let token;
    try { token = await getToken(); }
    catch { check(); throw failure("account_setup_check_failed"); }
    check();
    if (!token) throw failure("account_setup_sign_in_required");
    const base = url.replace(/\/+$/, "");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const getProfile = () => fetchImpl(`${base}/get-user`, { headers, signal: controller.signal });
    let preflight;
    try {
      preflight = await getProfile();
      check();
    } catch {
      check();
      throw failure("account_setup_check_failed");
    }
    if (preflight?.status === 200) return { existing: true, creationAttempted: false, verificationAttempts: 0 };
    if (preflight?.status !== 404) throw failure("account_setup_check_failed");
    check();
    creationAttempted = true;
    try {
      await fetchImpl(`${base}/create-user`, {
        method: "POST", headers, signal: controller.signal,
        body: JSON.stringify({ email: email.trim(), username: email.trim().split("@")[0], localDate }),
      });
      check();
    } catch {
      // A lost/rejected POST response is not proof that no user was created.
      // Only the following safe GETs may establish completion; never POST again.
      check();
    }
    for (let attempt = 0; attempt < pollCount; attempt++) {
      check();
      verificationAttempts++;
      let response;
      try {
        response = await getProfile();
        check();
      } catch { check(); }
      if (response?.status === 200) return { existing: false, creationAttempted: true, verificationAttempts };
      if (attempt + 1 < pollCount && pollIntervalMs > 0) {
        await wait();
        check();
      }
    }
    throw failure("account_setup_not_ready");
  })();
  try { return await Promise.race([request, aborted]); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", externalAbort);
  }
}
