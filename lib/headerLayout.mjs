const FORMS = new Set(["/create", "/update-goals", "/photo-log", "/chatgpt", "/voice-language", "/meal-times",
  "/theme", "/goals-survey", "/update-scale-type", "/export-data", "/motion-check", "/sign-up", "/forgot-password"]);
const PREVIEWS = new Set(["sign-up", "verification", "signup-setup", "forgot-password", "reset-code", "reset", "reset-activation", "manual", "manual-save-navigation-error", "text-review", "photo-review", "edit-meal", "edit-save-navigation-error", "edit-meal-load-token", "edit-meal-load-json", "edit-session", "photo", "photo-selected", "photo-save-navigation-error", "chatgpt",
  "chatgpt-disconnected", "chatgpt-catalog-error", "voice-language", "voice-language-load-error", "voice-language-save-error", "meal-times", "meal-times-load-error", "meal-times-save-error", "theme", "survey", "recommendation", "recommendation-unspecified", "recommendation-body-fat", "recommendation-save-token", "recommendation-save-response", "recommendation-save-error", "scale", "live"]);

// Only adopted form pages own their safe-area padding. Other app screens keep
// the original root inset, so adopting back-auth forms cannot shift tabs/Sign In.
export function formOwnsTopInset(pathname, page, platform, version) {
  if (platform !== "ios" || Number.parseInt(String(version), 10) < 26) return false;
  if (FORMS.has(pathname) || /^\/(edit|session-log-edit|insights)\/[^/]+$/.test(pathname)) return true;
  return pathname === "/ui-gallery" && PREVIEWS.has(Array.isArray(page) ? page[0] : page);
}
