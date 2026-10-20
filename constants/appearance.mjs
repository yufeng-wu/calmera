export const BASE_CANVAS_COLOR = "#FFFBF9";
export const DEFAULT_THEME_ID = "solid";
export const APPEARANCE_THEMES = Object.freeze([
  { id: "solid", name: "Soft Tangerine", label: "50%", description: "A gentle peach wash", animated: false },
  { id: "dawn", name: "Dawn", label: "Dawn", description: "Peach fading into rose", animated: false },
  { id: "glow", name: "Glow", label: "Glow", description: "Warm, drifting light", animated: true },
  { id: "aura", name: "Aura", label: "Aura", description: "Lavender, peach and mint", animated: true },
  { id: "matcha", name: "Matcha Latte", label: "Matcha", description: "Fresh matcha and creamy oat milk", animated: false },
  { id: "mocha", name: "Mocha", label: "Mocha", description: "Soft cocoa and warm latte", animated: false },
]);
export const isThemeId = value => APPEARANCE_THEMES.some(theme => theme.id === value);
export const themeForId = value => APPEARANCE_THEMES.find(theme => theme.id === value) || APPEARANCE_THEMES[0];
