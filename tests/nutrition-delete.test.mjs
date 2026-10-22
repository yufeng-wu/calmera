import test from "node:test";
import assert from "node:assert/strict";
import { deleteNutritionEntry, removeStoredNutritionEntry } from "../lib/nutritionDelete.mjs";
import { createNutritionStore } from "../lib/nutritionStore.mjs";

const ownerKey = "synthetic-delete-owner", dateKey = "2026-10-20";
const options = { url: "https://calmera.invalid/api/food-entries/1", getToken: async () => "synthetic-token" };
const rows = [
  { id: 1, food_name: "Synthetic banana", meal_type: "Breakfast", local_time: "09:00:00", calories: 100 },
  { id: 2, food_name: "Synthetic toast", meal_type: "Lunch", local_time: "12:00:00", calories: 200 },
];
const rawDay = entries => ({ foodEntries: entries, dailyTotals: { calories: entries.reduce((sum, row) => sum + row.calories, 0) } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
async function seededStore(t) {
  const store = createNutritionStore({ ownerKey });
  t.after(() => store.dispose());
  await store.loadDay(dateKey, async () => rawDay(rows));
  return store;
}
const ids = store => store.getSnapshot().days[dateKey]?.entries.map(row => row.id);
async function failureOf(promise, code) {
  let failure;
  await promise.catch(error => { failure = error; });
  assert.ok(failure, "synthetic deletion must reject");
  assert.equal(failure.message, code); assert.equal(failure.code, code);
  return failure;
}

test("confirmed DELETE keeps exact URL/auth, sends no body, and never parses a deleted record", async () => {
  const calls = [];
  const result = await deleteNutritionEntry({ ...options, fetchImpl: async (url, request) => {
    calls.push({ url, request }); return { ok: true, status: 200, json: () => assert.fail("no deleted record read") };
  } });
  assert.deepEqual(result, { deleted: true });
  assert.equal(calls.length, 1); assert.equal(calls[0].url, options.url);
  assert.equal(calls[0].request.method, "DELETE"); assert.equal(calls[0].request.body, undefined);
  assert.deepEqual(calls[0].request.headers, { Authorization: "Bearer synthetic-token" });
});

test("non-ok responses including404 remain failures without parsing raw server text", async () => {
  let calls = 0;
  for (const status of [401, 403, 404, 500, 503]) {
    const error = await failureOf(deleteNutritionEntry({ ...options, fetchImpl: async () => {
      calls++; return { ok: false, status, json: () => assert.fail("no failure payload read"), text: () => assert.fail("no raw text") };
    } }), "meal_delete_failed");
    assert.equal(error.dispatched, true);
    assert.equal(error.mayHaveDeleted, status >= 500);
    assert.equal(error.timedOut, false); assert.equal(error.cancelled, false);
  }
  assert.equal(calls, 5);
});

test("missing or failed credentials cannot dispatch and provider errors are sanitized", async () => {
  const missing = await failureOf(deleteNutritionEntry({ ...options, getToken: async () => null,
    fetchImpl: () => assert.fail("missing credentials cannot delete") }), "calmera_sign_in_required");
  assert.equal(missing.dispatched, false); assert.equal(missing.mayHaveDeleted, false);
  const rejected = await failureOf(deleteNutritionEntry({ ...options, getToken: async () => { throw Error("synthetic private provider detail"); },
    fetchImpl: () => assert.fail("failed credentials cannot delete") }), "meal_delete_failed");
  assert.equal(rejected.dispatched, false);
});

test("stalled credentials are bounded and a late token cannot delete", async () => {
  const token = deferred(); let calls = 0;
  const error = await failureOf(deleteNutritionEntry({ ...options, timeoutMs: 10, getToken: () => token.promise,
    fetchImpl: () => { calls++; } }), "meal_delete_timeout");
  assert.equal(error.timedOut, true); assert.equal(error.dispatched, false); assert.equal(error.mayHaveDeleted, false);
  token.resolve("late synthetic-token"); await nextTurn(); assert.equal(calls, 0);
});

test("a stalled dispatched DELETE is uncertain and cannot turn into late success", async () => {
  const reply = deferred(); let calls = 0; let confirmed = 0; let requestSignal;
  const pending = deleteNutritionEntry({ ...options, timeoutMs: 10, fetchImpl: (url, request) => {
    calls++; requestSignal = request.signal; return reply.promise;
  } }).then(value => { confirmed++; return value; });
  const error = await failureOf(pending, "meal_delete_timeout");
  assert.equal(error.dispatched, true); assert.equal(error.mayHaveDeleted, true); assert.equal(requestSignal.aborted, true);
  reply.resolve({ ok: true, status: 200 }); await nextTurn();
  assert.equal(confirmed, 0); assert.equal(calls, 1);
});

test("external cancellation while credentials wait blocks any late dispatch", async () => {
  const token = deferred(); const controller = new AbortController(); let calls = 0;
  const pending = deleteNutritionEntry({ ...options, signal: controller.signal, getToken: () => token.promise,
    fetchImpl: () => { calls++; } });
  controller.abort(); const error = await failureOf(pending, "meal_delete_cancelled");
  assert.equal(error.name, "AbortError"); assert.equal(error.cancelled, true); assert.equal(error.mayHaveDeleted, false);
  token.resolve("late synthetic-token"); await nextTurn(); assert.equal(calls, 0);
});

test("confirmed removal settles bookkeeping before current-owner refresh", async t => {
  const store = await seededStore(t); const reply = deferred(); let refresh; let reads = 0; let callbacks = 0;
  const pending = removeStoredNutritionEntry({ ...options, store, ownerKey, dateKey, id: 1,
    fetchImpl: () => reply.promise, onSettled: () => {
      callbacks++; assert.deepEqual(ids(store), [2]);
      refresh = store.loadDay(dateKey, async () => { reads++; return rawDay([rows[1]]); }, { force: true });
    },
  });
  assert.deepEqual(ids(store), [2]);
  assert.equal(store.getSnapshot().days[dateKey].summary.dailyTotals.calories, 200);
  reply.resolve({ ok: true, status: 200 }); assert.equal(await pending, true); await refresh;
  assert.equal(callbacks, 1); assert.equal(reads, 1);
  assert.deepEqual(ids(store), [2]);
});

test("token timeout rolls back the real store, releases blocked reads, then refreshes once", async t => {
  const store = await seededStore(t); const token = deferred(); let fetchCalls = 0; let callbacks = 0; let reads = 0; let refresh;
  const pending = removeStoredNutritionEntry({ ...options, store, ownerKey, dateKey, id: 1, timeoutMs: 10,
    getToken: () => token.promise, fetchImpl: () => { fetchCalls++; }, onSettled: () => {
      callbacks++; assert.deepEqual(ids(store), [1, 2]);
      assert.equal(store.getSnapshot().days[dateKey].summary.dailyTotals.calories, 300);
      refresh = store.loadDay(dateKey, async () => { reads++; return rawDay(rows); }, { force: true });
    },
  });
  assert.deepEqual(ids(store), [2]);
  await store.loadDay(dateKey, async () => { reads++; return rawDay(rows); }, { force: true });
  assert.equal(reads, 0, "pending optimistic removal blocks premature replacement");
  const error = await failureOf(pending, "meal_delete_timeout"); await refresh;
  assert.equal(error.mayHaveDeleted, false); assert.equal(callbacks, 1); assert.equal(reads, 1);
  token.resolve("late synthetic-token"); await nextTurn();
  assert.equal(fetchCalls, 0); assert.deepEqual(ids(store), [1, 2]);
});

test("404 retains existing rollback semantics and is not retried automatically", async t => {
  const store = await seededStore(t); let calls = 0; let callbacks = 0;
  const error = await failureOf(removeStoredNutritionEntry({ ...options, store, ownerKey, dateKey, id: 1,
    fetchImpl: async () => { calls++; return { ok: false, status: 404 }; },
    onSettled: () => { callbacks++; assert.deepEqual(ids(store), [1, 2]); },
  }), "meal_delete_failed");
  assert.equal(error.mayHaveDeleted, false); assert.equal(calls, 1); assert.equal(callbacks, 1);
});

test("uncertain dispatched failure rolls back first and an authoritative read can reconcile absence", async t => {
  const store = await seededStore(t); let deletes = 0; let reads = 0; let refresh;
  const error = await failureOf(removeStoredNutritionEntry({ ...options, store, ownerKey, dateKey, id: 1,
    fetchImpl: async () => { deletes++; throw Error("synthetic lost DELETE response"); }, onSettled: () => {
      assert.deepEqual(ids(store), [1, 2]);
      refresh = store.loadDay(dateKey, async () => { reads++; return rawDay([rows[1]]); }, { force: true });
    },
  }), "meal_delete_failed");
  await refresh;
  assert.equal(error.mayHaveDeleted, true); assert.equal(error.dispatched, true);
  assert.equal(deletes, 1); assert.equal(reads, 1); assert.deepEqual(ids(store), [2]);
});

test("a duplicate removal of an already-hidden row cannot dispatch another DELETE", async t => {
  const store = await seededStore(t); const reply = deferred(); let calls = 0; let callbacks = 0;
  const args = { ...options, store, ownerKey, dateKey, id: 1, fetchImpl: () => { calls++; return reply.promise; },
    onSettled: () => { callbacks++; } };
  const first = removeStoredNutritionEntry(args);
  assert.equal(await removeStoredNutritionEntry(args), false);
  reply.resolve({ ok: true, status: 200 }); assert.equal(await first, true);
  assert.equal(calls, 1); assert.equal(callbacks, 1);
});

test("an inactive or different owner cannot even remove optimistically", async t => {
  const store = await seededStore(t);
  for (const extra of [{ ownerKey: "synthetic-other-owner" }, { isActive: () => false }]) {
    assert.equal(await removeStoredNutritionEntry({ ...options, store, ownerKey, dateKey, id: 1, ...extra,
      getToken: () => assert.fail("inactive owner cannot request credentials"),
      onSettled: () => assert.fail("inactive owner cannot refresh"),
    }), false);
    assert.deepEqual(ids(store), [1, 2]);
  }
});

test("current-owner handoff during token lookup cannot delete with a newer token or show stale errors", async t => {
  const store = await seededStore(t); const token = deferred(); let active = true; let calls = 0; let callbacks = 0;
  const pending = removeStoredNutritionEntry({ ...options, store, ownerKey, dateKey, id: 1,
    getToken: () => token.promise, isActive: () => active, fetchImpl: () => { calls++; }, onSettled: () => { callbacks++; },
  });
  active = false;
  assert.equal(store.belongsTo(ownerKey), true, "simulate the gap before old store cleanup");
  token.resolve("new-owner synthetic-token"); assert.equal(await pending, false);
  assert.equal(calls, 0); assert.equal(callbacks, 0); assert.deepEqual(ids(store), [1, 2]);
});

test("disposal while credentials wait suppresses stale errors, callbacks, and late dispatch", async t => {
  const store = await seededStore(t); const token = deferred(); let calls = 0; let callbacks = 0;
  const pending = removeStoredNutritionEntry({ ...options, store, ownerKey, dateKey, id: 1,
    getToken: () => token.promise, fetchImpl: () => { calls++; }, onSettled: () => { callbacks++; },
  });
  store.dispose(); token.resolve("late disposed synthetic-token");
  assert.equal(await pending, false); assert.equal(calls, 0); assert.equal(callbacks, 0);
  assert.deepEqual(store.getSnapshot().days, {});
});

test("a response completing after owner departure cannot settle the new owner's presentation", async t => {
  const store = await seededStore(t); const reply = deferred(), started = deferred(); let active = true; let callbacks = 0;
  const pending = removeStoredNutritionEntry({ ...options, store, ownerKey, dateKey, id: 1, isActive: () => active,
    fetchImpl: () => { started.resolve(); return reply.promise; }, onSettled: () => { callbacks++; },
  });
  await started.promise; active = false; reply.resolve({ ok: true, status: 200 });
  assert.equal(await pending, false); assert.equal(callbacks, 0); assert.deepEqual(ids(store), [1, 2]);
});

test("current-owner cancellation settles and restores its optimistic row before callback", async t => {
  const store = await seededStore(t); const token = deferred(); const controller = new AbortController(); let callbacks = 0;
  const pending = removeStoredNutritionEntry({ ...options, store, ownerKey, dateKey, id: 1, signal: controller.signal,
    getToken: () => token.promise, fetchImpl: () => assert.fail("cancelled token cannot dispatch"),
    onSettled: () => { callbacks++; assert.deepEqual(ids(store), [1, 2]); },
  });
  controller.abort(); const error = await failureOf(pending, "meal_delete_cancelled");
  assert.equal(error.cancelled, true); assert.equal(callbacks, 1);
  token.resolve("late cancelled synthetic-token"); await nextTurn();
});
