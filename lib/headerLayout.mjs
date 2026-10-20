const FORMS = new Set(["/create", "/update-goals", "/photo-log", "/chatgpt", "/voice-language",
  "/theme", "/goals-survey", "/update-scale-type", "/motion-check"]);
const PREVIEWS = new Set(["manual", "edit-meal", "edit-meal-load-token", "edit-meal-load-json", "edit-session", "photo", "photo-selected", "chatgpt",
  "chatgpt-disconnected", "voice-language", "theme", "survey", "recommendation", "recommendation-save-token", "recommendation-save-response", "recommendation-save-error", "scale", "live"]);

// Only adopted form pages own their safe-area padding. Other app screens keep
// the original root inset, so this fix cannot shift Today/History/Settings/Auth.
export function formOwnsTopInset(pathname, page, platform, version) {
  if (platform !== "ios" || Number.parseInt(String(version), 10) < 26) return false;
  if (FORMS.has(pathname) || /^\/(edit|session-log-edit)\/[^/]+$/.test(pathname)) return true;
  return pathname === "/ui-gallery" && PREVIEWS.has(Array.isArray(page) ? page[0] : page);
}
