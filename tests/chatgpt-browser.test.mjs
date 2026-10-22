import test from "node:test";
import assert from "node:assert/strict";
import { waitForBrowserCallback } from "../lib/chatgpt/browserCallback.mjs";

function setup() {
  let resolve, reject;
  const callback = new Promise((yes, no) => { resolve = yes; reject = no; });
  const calls = { cancelled: 0, dismissed: 0, opened: 0 };
  const native = { waitForCallback: () => callback, cancelCallback: () => { calls.cancelled++; reject(new Error("authorization_cancelled")); } };
  const browser = {
    openBrowserAsync: () => { calls.opened++; return new Promise(() => {}); },
    dismissBrowser: async () => { calls.dismissed++; },
  };
  return { native, browser, calls, resolve, reject };
}

test("closing Safari releases authorization without calling an already-dismissed browser", async () => {
  const s = setup();
  s.browser.openBrowserAsync = async () => ({ type: "cancel" });
  // Expo's native promise can hang in this case; the implementation must never call it.
  s.browser.dismissBrowser = () => { throw new Error("must not dismiss twice"); };
  await assert.rejects(waitForBrowserCallback({ ...s, url: "https://example.invalid" }), /authorization_cancelled/);
  assert.equal(s.calls.cancelled, 1);
});

test("successful callback closes the still-open browser exactly once", async () => {
  const s = setup();
  const result = waitForBrowserCallback({ ...s, url: "https://example.invalid" });
  s.resolve("synthetic-callback");
  assert.equal(await result, "synthetic-callback");
  assert.equal(s.calls.dismissed, 1);
  assert.equal(s.calls.cancelled, 1);
});

test("callback timeout closes the browser and cannot yield an authorization result", async () => {
  const s = setup();
  const result = waitForBrowserCallback({ ...s, url: "https://example.invalid" });
  s.reject(new Error("authorization_timeout"));
  await assert.rejects(result, /authorization_timeout/);
  assert.equal(s.calls.dismissed, 1);
});

test("development browser handoff returns only through the original callback and cancels cleanly", async () => {
  const s = setup();
  let visibleURL;
  const result = waitForBrowserCallback({ ...s, url: "https://example.invalid", development: true, onAuthorizationURL: url => { visibleURL = url; } });
  assert.equal(visibleURL, "https://example.invalid");
  assert.equal(s.calls.opened, 0);
  s.native.cancelCallback();
  await assert.rejects(result, /authorization_cancelled/);
  assert.equal(s.calls.dismissed, 0);
});

test("release builds reject the development handoff before exposing a URL", async () => {
  const s = setup();
  // No callback wait is created for this rejected configuration.
  s.native.cancelCallback = () => { s.calls.cancelled++; };
  await assert.rejects(waitForBrowserCallback({ ...s, url: "https://example.invalid", development: false, onAuthorizationURL: () => { throw new Error("must not expose URL"); } }), /development_build_required/);
  assert.equal(s.calls.opened, 0);
  assert.equal(s.calls.dismissed, 0);
});
