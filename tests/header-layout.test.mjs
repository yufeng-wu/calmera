import test from "node:test";
import assert from "node:assert/strict";
import { formOwnsTopInset } from "../lib/headerLayout.mjs";

test("adopted iOS26 forms own the safe area without shifting ordinary tabs", () => {
  for (const path of ["/create", "/update-goals", "/photo-log", "/ai-connection", "/ai-connect", "/ai-model", "/ai-usage", "/voice-language", "/theme", "/goals-survey", "/export-data", "/erase-data", "/privacy", "/insights/typical", "/edit/synthetic-id", "/motion-check"]) {
    assert.equal(formOwnsTopInset(path, undefined, "ios", "26.0"), true, path);
  }
  for (const path of ["/dashboard", "/settings", "/ui-gallery", "/background-compare", "/unknown"]) {
    assert.equal(formOwnsTopInset(path, undefined, "ios", "26.0"), false, path);
  }
});
test("only adopted gallery pages get full-bleed headers", () => {
  for (const page of ["manual", "manual-save-navigation-error", "edit-save-navigation-error", "photo-save-navigation-error", "theme", "ai-connection", "ai-connection-key", "ai-connection-openai", "ai-connection-chatgpt", "ai-connection-expired", "ai-connection-refused", "ai-connection-signin-error", "ai-connect-key", "ai-connect-key-error", "ai-model", "ai-model-error", "voice-language-load-error", "voice-language-save-error", "recommendation", "recommendation-unspecified", "recommendation-minor", "recommendation-save-error", "erase-data", "erase-data-erasing", "erase-data-failed", "erase-data-done", "privacy", "privacy-health-data", "privacy-consent", "privacy-consent-updated", "privacy-consent-error", "photo-selected", "edit-meal"]) {
    assert.equal(formOwnsTopInset("/ui-gallery", page, "ios", 26), true, page);
  }
  assert.equal(formOwnsTopInset("/ui-gallery", ["theme"], "ios", 26), true);
  for (const page of ["settings", "today-calendar", "unregistered-stage", undefined]) {
    assert.equal(formOwnsTopInset("/ui-gallery", page, "ios", 26), false);
  }
});
test("older iOS and other platforms retain their existing safe area", () => {
  for (const [platform, version] of [["ios", "18.6"], ["ios", "25.9"], ["android", 36], ["web", "26"]]) {
    assert.equal(formOwnsTopInset("/create", null, platform, version), false);
    assert.equal(formOwnsTopInset("/erase-data", null, platform, version), false);
    assert.equal(formOwnsTopInset("/ui-gallery", "erase-data", platform, version), false);
  }
});
test("pages removed with sign-in no longer claim the safe area", () => {
  for (const path of ["/sign-in", "/sign-up", "/forgot-password", "/account", "/delete-account", "/update-scale-type", "/session-log-edit/1"]) {
    assert.equal(formOwnsTopInset(path, undefined, "ios", "26.0"), false, path);
  }
});
