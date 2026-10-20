import test from "node:test";
import assert from "node:assert/strict";
import { formOwnsTopInset } from "../lib/headerLayout.mjs";

test("adopted iOS26 forms own the safe area without shifting ordinary tabs", () => {
  for (const path of ["/create", "/update-goals", "/photo-log", "/chatgpt", "/voice-language", "/theme", "/goals-survey", "/update-scale-type", "/edit/synthetic-id", "/session-log-edit/synthetic-id", "/motion-check"]) {
    assert.equal(formOwnsTopInset(path, undefined, "ios", "26.0"), true, path);
  }
  for (const path of ["/dashboard", "/history", "/settings", "/sign-in", "/ui-gallery", "/background-compare", "/unknown"]) {
    assert.equal(formOwnsTopInset(path, undefined, "ios", "26.0"), false, path);
  }
});
test("only adopted gallery pages get full-bleed headers", () => {
  for (const page of ["manual", "theme", "chatgpt-catalog-error", "voice-language-load-error", "voice-language-save-error", "recommendation", "recommendation-save-token", "recommendation-save-response", "recommendation-save-error", "photo-selected", "edit-meal", "edit-meal-load-token", "edit-meal-load-json", "edit-session"]) {
    assert.equal(formOwnsTopInset("/ui-gallery", page, "ios", 26), true);
  }
  assert.equal(formOwnsTopInset("/ui-gallery", ["theme"], "ios", 26), true);
  for (const page of ["settings", "history", "sign-in", "reset-activation", undefined]) {
    assert.equal(formOwnsTopInset("/ui-gallery", page, "ios", 26), false);
  }
});
test("older iOS and other platforms retain their existing safe area", () => {
  assert.equal(formOwnsTopInset("/create", null, "ios", "18.6"), false);
  assert.equal(formOwnsTopInset("/create", null, "android", 36), false);
  assert.equal(formOwnsTopInset("/create", null, "web", "26"), false);
});
