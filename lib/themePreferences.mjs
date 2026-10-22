import { DEFAULT_THEME_ID, isThemeId } from "../constants/appearance.mjs";

// Nonsecret appearance preference only. Each owner/scope has its own key;
// writes are serialized so rapid selections cannot restore an older choice.
export function createThemePreferences(storage) {
  const pending = new Map();
  return {
    async load(key) {
      await pending.get(key)?.catch(() => {});
      const value = await storage.getItem(key);
      return isThemeId(value) ? value : DEFAULT_THEME_ID;
    },
    save(key, id) {
      if (!key || !isThemeId(id)) return Promise.reject(new Error("invalid_theme"));
      const task = (pending.get(key) || Promise.resolve()).catch(() => {}).then(() => storage.setItem(key, id));
      pending.set(key, task);
      const cleanup = () => { if (pending.get(key) === task) pending.delete(key); };
      task.then(cleanup, cleanup);
      return task;
    },
  };
}
