import test from "node:test";
import assert from "node:assert/strict";
import { completeNutritionRefresh } from "../lib/completeNutritionRefresh.mjs";

for (const failedIndex of [0, 1]) {
  test(`refresh remains pending when read ${failedIndex} fails before its sibling`, async () => {
    let finishOther;
    const other = new Promise(resolve => { finishOther = resolve; });
    const error = new Error("read failed");
    const reads = [other, other];
    reads[failedIndex] = Promise.reject(error);
    let settled = false;
    const refresh = completeNutritionRefresh(reads);
    const checked = assert.rejects(refresh, value => value === error);
    refresh.then(() => { settled = true; }, () => { settled = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    finishOther("completed");
    await checked;
    assert.equal(settled, true);
  });
}

test("successful refresh returns both reads in input order", async () => {
  assert.deepEqual(await completeNutritionRefresh([Promise.resolve("meals"), Promise.resolve("goals")]), ["meals", "goals"]);
});
