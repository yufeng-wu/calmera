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
  for (const page of ["manual", "manual-save-navigation-error", "edit-save-navigation-error", "photo-save-navigation-error", "theme", "chatgpt-catalog-error", "voice-language-load-error", "voice-language-save-error", "recommendation", "recommendation-unspecified", "recommendation-body-fat", "recommendation-save-token", "recommendation-save-response", "recommendation-save-error", "photo-selected", "edit-meal", "edit-meal-load-token", "edit-meal-load-json", "edit-session"]) {
    assert.equal(formOwnsTopInset("/ui-gallery", page, "ios", 26), true);
  }
  assert.equal(formOwnsTopInset("/ui-gallery", ["theme"], "ios", 26), true);
  for (const page of ["settings", "history", "sign-in", undefined]) {
    assert.equal(formOwnsTopInset("/ui-gallery", page, "ios", 26), false);
  }
});
test("older iOS and other platforms retain their existing safe area", () => {
  assert.equal(formOwnsTopInset("/create", null, "ios", "18.6"), false);
  assert.equal(formOwnsTopInset("/create", null, "android", 36), false);
  assert.equal(formOwnsTopInset("/create", null, "web", "26"), false);
});


test("back-auth routes and all of their gallery stages share native safe-area ownership", () => {
  const pages = ["sign-up", "verification", "signup-setup", "forgot-password", "reset-code", "reset", "reset-activation"];
  for (const version of [26, "26.0", "27.1"]) {
    for (const route of ["/sign-up", "/forgot-password"]) {
      assert.equal(formOwnsTopInset(route, undefined, "ios", version), true, `${route} on iOS ${version}`);
    }
    for (const page of pages) {
      assert.equal(formOwnsTopInset("/ui-gallery", page, "ios", version), true, `${page} on iOS ${version}`);
    }
    // Sign In keeps its scrolling wordmark and navigator-owned inset, including
    // when visited immediately before/after one of the adopted back-auth forms.
    assert.equal(formOwnsTopInset("/sign-in", undefined, "ios", version), false);
    assert.equal(formOwnsTopInset("/ui-gallery", "sign-in", "ios", version), false);
    assert.equal(formOwnsTopInset("/settings", undefined, "ios", version), false);
  }
});

test("back-auth native ownership stays disabled on legacy platforms and unknown preview IDs", () => {
  for (const [platform, version] of [["ios", "18.6"], ["ios", "25.9"], ["android", 36], ["web", "26"]]) {
    for (const route of ["/sign-up", "/forgot-password"]) {
      assert.equal(formOwnsTopInset(route, undefined, platform, version), false);
    }
    for (const page of ["sign-up", "verification", "signup-setup", "forgot-password", "reset-code", "reset", "reset-activation"]) {
      assert.equal(formOwnsTopInset("/ui-gallery", page, platform, version), false);
    }
  }
  assert.equal(formOwnsTopInset("/ui-gallery", ["reset-code", "sign-in"], "ios", "26.0"), true);
  assert.equal(formOwnsTopInset("/ui-gallery", ["sign-in", "reset-code"], "ios", "26.0"), false);
  assert.equal(formOwnsTopInset("/ui-gallery", "unregistered-auth-stage", "ios", "26.0"), false);
});
