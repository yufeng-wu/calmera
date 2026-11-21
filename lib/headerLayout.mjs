const FORMS = new Set(["/create", "/update-goals", "/photo-log", "/chatgpt", "/api-key", "/voice-language",
  "/theme", "/goals-survey", "/export-data", "/erase-data", "/privacy", "/motion-check"]);
const PREVIEWS = new Set(["manual", "manual-save-navigation-error", "text-review", "photo-review", "edit-meal", "edit-save-navigation-error", "photo", "photo-selected", "photo-save-navigation-error", "chatgpt",
  "chatgpt-disconnected", "chatgpt-catalog-error", "api-key", "api-key-saved", "api-key-error", "voice-language", "voice-language-load-error", "voice-language-save-error", "theme", "survey", "recommendation", "recommendation-unspecified", "recommendation-minor", "recommendation-save-error",
  "erase-data", "erase-data-erasing", "erase-data-failed", "erase-data-done",
  "privacy", "privacy-health-data", "privacy-consent", "privacy-consent-updated", "privacy-consent-error"]);

// Only adopted form pages own their safe-area padding. Other app screens keep
// the original root inset, so adopting forms cannot shift the tabs.
export function formOwnsTopInset(pathname, page, platform, version) {
  if (platform !== "ios" || Number.parseInt(String(version), 10) < 26) return false;
  if (FORMS.has(pathname) || /^\/(edit|insights)\/[^/]+$/.test(pathname)) return true;
  return pathname === "/ui-gallery" && PREVIEWS.has(Array.isArray(page) ? page[0] : page);
}
