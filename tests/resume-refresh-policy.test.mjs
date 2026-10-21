import test from "node:test";
import assert from "node:assert/strict";
import { createResumeRefreshPolicy } from "../lib/resumeRefreshPolicy.mjs";

function clock(initialState = "active") {
  let time = 0;
  return { advance: value => { time += value; }, change: createResumeRefreshPolicy({ initialState, now: () => time }) };
}

test("Notification Center never becomes a long-background refresh", () => {
  const c = clock();
  assert.equal(c.change("inactive"), false);
  c.advance(600000);
  assert.equal(c.change("active"), false);
});
test("short app switching preserves the current page", () => {
  const c = clock();
  c.change("inactive"); c.change("background"); c.advance(5000);
  c.change("inactive");
  assert.equal(c.change("active"), false);
});
test("a real long background stay refreshes once, through intermediate inactive events", () => {
  const c = clock();
  c.change("background"); c.advance(130000);
  assert.equal(c.change("inactive"), false);
  assert.equal(c.change("active"), true);
  assert.equal(c.change("active"), false);
});
test("overlay time before background does not inflate the background duration", () => {
  const c = clock();
  c.change("inactive"); c.advance(600000);
  c.change("background"); c.advance(1000);
  assert.equal(c.change("active"), false);
});
test("mounting in the background still tracks a genuine long absence", () => {
  const c = clock("background"); c.advance(120000);
  assert.equal(c.change("active"), true);
});
