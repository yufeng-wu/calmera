// Bounded profile reads/writes. Abort covers token acquisition as well as fetch.
async function goalProfileRequest({ getToken, url, signal, timeoutMs = 20000, fetchImpl = fetch,
  method = "GET", body }) {
  if (signal?.aborted) throw new Error("goals_request_cancelled");
  const controller = new AbortController();
  let timedOut = false;
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = () => {
    controller.abort();
    rejectAbort(new Error(timedOut ? "goals_request_timeout" : "goals_request_cancelled"));
  };
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
  const request = (async () => {
    const token = await getToken();
    if (controller.signal.aborted) throw new Error("goals_request_cancelled");
    if (!token) throw new Error("goals_sign_in_required");
    const response = await fetchImpl(url, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(method === "GET" ? "goals_load_failed" : "goals_save_failed");
    return method === "GET" ? response.json() : undefined;
  })();
  try { return await Promise.race([request, aborted]); }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}

export function fetchGoalProfile(options) { return goalProfileRequest({ ...options, method: "GET" }); }
export function saveGoalProfile(options) { return goalProfileRequest({ ...options, method: "PUT" }); }
