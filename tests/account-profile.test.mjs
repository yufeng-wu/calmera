import test from "node:test";
import assert from "node:assert/strict";
import { checkAccountProfile, createAccountReadyMemory } from "../lib/accountProfile.mjs";
import { completeAccountSetup } from "../lib/accountSetup.mjs";
const options = { url: "https://calmera.invalid/users/", getToken: async () => "synthetic-token" };
const response = status => ({ ok: status === 200, status, json: async () => ({ userId: "synthetic-user" }) });

test("an existing account is ready with one authenticated profile read", async () => {
  const requests = [];
  assert.equal(await checkAccountProfile({ ...options, fetchImpl: async (url, request) => {
    requests.push({ url, ...request }); return response(200);
  } }), "ready");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://calmera.invalid/users/get-user");
  assert.equal(requests[0].headers.Authorization, "Bearer synthetic-token");
});

test("only a confirmed 404 leads to the missing-profile recovery screen", async () => {
  assert.equal(await checkAccountProfile({ ...options, fetchImpl: async () => response(404) }), "missing");
  for (const status of [401, 403, 429, 500, 503]) {
    await assert.rejects(checkAccountProfile({ ...options, fetchImpl: async () => response(status) }),
      { code: `nutrition_http_${status}` });
  }
});

test("missing credentials cannot trigger profile reads or setup", async () => {
  await assert.rejects(checkAccountProfile({ ...options, getToken: async () => null,
    fetchImpl: () => assert.fail("must not dispatch") }), { code: "calmera_sign_in_required" });
});

test("a stalled credential lookup times out rather than presenting an empty day", async () => {
  await assert.rejects(checkAccountProfile({ ...options, getToken: () => new Promise(() => {}), timeoutMs: 15,
    fetchImpl: () => assert.fail("must not dispatch") }), { code: "nutrition_request_timeout" });
});

test("an account switch cancels a late missing-profile result", async () => {
  const controller = new AbortController();
  let finish;
  const pending = checkAccountProfile({ ...options, signal: controller.signal,
    fetchImpl: () => new Promise(resolve => { finish = resolve; }) });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { code: "nutrition_request_cancelled" });
  finish(response(404));
});

test("missing account recovery creates once, verifies, then becomes ready", async () => {
  let exists = false;
  const calls = [];
  const fetchImpl = async (url, request = {}) => {
    calls.push(request.method || "GET");
    if (request.method === "POST") { exists = true; return response(201); }
    return response(exists ? 200 : 404);
  };
  assert.equal(await checkAccountProfile({ ...options, fetchImpl }), "missing");
  await completeAccountSetup({ ...options, fetchImpl, email: "calmera@example.invalid", localDate: "2026-10-20", pollIntervalMs: 0 });
  assert.equal(await checkAccountProfile({ ...options, fetchImpl }), "ready");
  assert.deepEqual(calls, ["GET", "GET", "POST", "GET", "GET"]);
});

test("a confirmed account is remembered per account, and storage failures read as unknown", async () => {
  const saved = new Map();
  const memory = createAccountReadyMemory({
    getItem: async key => saved.get(key) ?? null,
    setItem: async (key, value) => { saved.set(key, value); },
    removeItem: async key => { saved.delete(key); },
  });
  assert.equal(await memory.known("synthetic-a"), false);
  await memory.set("synthetic-a", true);
  assert.equal(await memory.known("synthetic-a"), true);
  assert.equal(await memory.known("synthetic-b"), false);
  await memory.set("synthetic-a", false);
  assert.equal(await memory.known("synthetic-a"), false);
  const broken = createAccountReadyMemory({
    getItem: async () => { throw Error("synthetic_storage_failure"); },
    setItem: async () => { throw Error("synthetic_storage_failure"); },
    removeItem: async () => { throw Error("synthetic_storage_failure"); },
  });
  assert.equal(await broken.known("synthetic-a"), false);
  await broken.set("synthetic-a", true);
});
