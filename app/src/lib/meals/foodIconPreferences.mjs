import { FOOD_ICON_CATALOG } from "./foodIcons.mjs";

const icons = new Map(FOOD_ICON_CATALOG.map(icon => [icon.id, icon]));
export const foodIconById = id => icons.get(id) || null;
const validId = id => /^[\w:-]{1,180}$/.test(String(id ?? ""));
const clean = value => value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).filter(([id, icon]) => validId(id) && icons.has(icon))) : {};

// Display preferences only, keyed by owner and saved meal ID. No media, nutrition
// or credentials are stored.
export function createFoodIconPreferences(storage) {
  const states = new Map();
  const stateFor = owner => {
    if (!validId(owner)) throw new Error("food_icon_owner_required");
    if (!states.has(owner)) states.set(owner, { data: null, loading: null, pending: Promise.resolve() });
    return states.get(owner);
  };
  const key = owner => `calmera.food-icons.v1.${owner}`;
  const load = async owner => {
    const state = stateFor(owner);
    if (state.data) return state.data;
    if (!state.loading) state.loading = storage.getItem(key(owner)).then(raw => {
      try { state.data = clean(JSON.parse(raw)); } catch { state.data = {}; }
      return state.data;
    }).finally(() => { state.loading = null; });
    return state.loading;
  };
  return {
    load,
    save(owner, choices) {
      const state = stateFor(owner);
      const patch = clean(choices);
      const task = state.pending.catch(() => {}).then(async () => {
        const data = { ...await load(owner), ...patch };
        await storage.setItem(key(owner), JSON.stringify(data));
        state.data = data;
        return data;
      });
      state.pending = task;
      return task;
    },
  };
}
