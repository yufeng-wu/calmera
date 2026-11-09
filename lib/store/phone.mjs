import { foodEntryPayload } from "../chatgpt/protocol.mjs";

// The data module's insides: meals, goals and the profile live in this iPhone's app
// storage, which iCloud Backup and Quick Start copy to a new iPhone. `./index.js` lists
// the methods. Each day's meals are one entry, so saving a meal rewrites only its day,
// and one queue runs every call in turn, so two saves never overwrite each other.

const PREFIX = "calmera.data.v1.";
const META = `${PREFIX}meta`;
const PROFILE = `${PREFIX}profile`;
const GOALS = `${PREFIX}goals`;
const DAY = `${PREFIX}day.`;
const dayKey = (date) => `${DAY}${date}`;

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];
const NUMBERS = ["calories", "protein", "carbs", "fat"];
const GOAL_FIELDS = ["calorieGoal", "proteinGoal", "carbsGoal", "fatGoal"];
// Everyone starts with these until they choose their own.
export const DEFAULT_GOALS = Object.freeze({ calorieGoal: 2000, proteinGoal: 150, carbsGoal: 200, fatGoal: 50 });

export const isLocalDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const localDateOf = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const localTimeOf = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(11, 19);
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const zeros = () => Object.fromEntries(NUMBERS.map((key) => [key, 0]));
const parse = (text) => { try { return text == null ? null : JSON.parse(text); } catch { return null; } };
const byTime = (a, b) => String(a.localTime).localeCompare(String(b.localTime)) || Number(a.id) - Number(b.id);
const byStart = (a, b) => a.from.localeCompare(b.from);
const failure = (message, extra = {}) => Object.assign(new Error(message), { code: message, ...extra });

// A bare number of something ("2") is a count, as the calmera server saved it.
function normalizeQuantity(quantity) {
  const trimmed = String(quantity ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return String(quantity ?? "").trim();
  return parseFloat(trimmed) === 1 ? `${trimmed} count` : `${trimmed} counts`;
}

// The local day and time a meal was eaten, read from the time it was logged
// ("2026-11-08T08:15:00-05:00"), never shifted to another time zone.
function eatenAt(createdAt, now) {
  const [date, rest = ""] = String(createdAt ?? "").split("T");
  const time = rest.split(/[.+\-Z]/)[0];
  if (isLocalDate(date) && /^\d{2}:\d{2}(:\d{2})?$/.test(time)) return { date, time: time.length === 5 ? `${time}:00` : time };
  const at = new Date(now());
  return { date: localDateOf(at), time: localTimeOf(at) };
}

function mealProblems(meal = {}) {
  const problems = [];
  if (typeof meal.foodName !== "string" || !meal.foodName.trim()) problems.push("Enter a food name.");
  else if (meal.foodName.length > 255) problems.push("Food names can be up to 255 characters.");
  if (typeof meal.quantity !== "string" || !meal.quantity.trim()) problems.push("Enter an amount, such as a bowl or 150 g.");
  else if (meal.quantity.length > 255) problems.push("Amounts can be up to 255 characters.");
  if (!MEAL_TYPES.includes(meal.mealType)) problems.push(`Meal type must be one of: ${MEAL_TYPES.join(", ")}.`);
  for (const key of NUMBERS) {
    const value = meal[key] === "" || meal[key] == null ? NaN : Number(meal[key]);
    if (!Number.isFinite(value) || value < 0) problems.push(`Check ${key}: enter a number of 0 or more.`);
  }
  return problems;
}

const mealFields = (meal) => ({ foodName: meal.foodName.trim(), quantity: normalizeQuantity(meal.quantity), mealType: meal.mealType,
  ...Object.fromEntries(NUMBERS.map((key) => [key, Number(meal[key])])) });

function summarize(meals, goals) {
  const dailyTotals = zeros();
  const mealTotals = Object.fromEntries(MEAL_TYPES.map((type) => [type, zeros()]));
  for (const meal of meals) {
    for (const key of NUMBERS) {
      const value = Number(meal[key]) || 0;
      dailyTotals[key] += value;
      if (mealTotals[meal.mealType]) mealTotals[meal.mealType][key] += value;
    }
  }
  for (const group of [dailyTotals, ...Object.values(mealTotals)]) for (const key of NUMBERS) group[key] = round(group[key]);
  return { dailyTotals, mealTotals, foodEntries: [...meals].sort(byTime).map((meal) => ({ ...meal })),
    ...(goals ? { goals: Object.fromEntries(GOAL_FIELDS.map((key) => [key, goals[key]])) } : {}) };
}

export function createPhoneStore({ storage, now = Date.now } = {}) {
  if (!storage || typeof storage.getItem !== "function") throw new Error("data_store_storage_required");
  let queue = Promise.resolve();
  let meta = null;      // { nextId, days: { [mealId]: date } }, loaded once
  let profile = null;   // { createdAtLocalDate }
  let goals = null;     // [{ from, calorieGoal, … }], oldest first

  // Every call waits for the one before it, so reads see whole writes.
  const exclusive = (task) => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  };
  const current = ({ signal, isActive } = {}) => !signal?.aborted && (!isActive || isActive());
  const readCancelled = () => failure("read_cancelled", { name: "AbortError", cancelled: true });

  async function readAllDays() {
    const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(DAY));
    if (!keys.length) return {};
    const days = {};
    for (const [key, value] of await storage.multiGet(keys)) {
      const meals = parse(value);
      if (Array.isArray(meals) && meals.length) days[key.slice(DAY.length)] = meals;
    }
    return days;
  }
  const readDayMeals = async (date) => { const meals = parse(await storage.getItem(dayKey(date))); return Array.isArray(meals) ? meals : []; };

  // The index from meal to day is rebuilt from the days whenever it's missing.
  async function loadMeta() {
    if (meta) return meta;
    const saved = parse(await storage.getItem(META));
    if (saved && Number.isInteger(saved.nextId) && saved.days && typeof saved.days === "object") {
      // A new id always comes after every id the index knows.
      const last = Math.max(0, ...Object.keys(saved.days).map(Number).filter(Number.isFinite));
      return (meta = { ...saved, nextId: Math.max(saved.nextId, last + 1) });
    }
    const days = {};
    let last = 0;
    for (const [date, meals] of Object.entries(await readAllDays())) {
      for (const meal of meals) { days[String(meal.id)] = date; last = Math.max(last, Number(meal.id) || 0); }
    }
    return (meta = { nextId: last + 1, days });
  }

  // The first time anything is read, the person starts today with the default goals.
  async function loadProfile() {
    if (profile && goals) return;
    const [[, savedProfile], [, savedGoals]] = await storage.multiGet([PROFILE, GOALS]);
    let nextProfile = parse(savedProfile), nextGoals = parse(savedGoals);
    const writes = [];
    if (!nextProfile || !isLocalDate(nextProfile.createdAtLocalDate)) {
      nextProfile = { createdAtLocalDate: localDateOf(new Date(now())) };
      writes.push([PROFILE, JSON.stringify(nextProfile)]);
    }
    if (!Array.isArray(nextGoals) || !nextGoals.length) {
      nextGoals = [{ from: nextProfile.createdAtLocalDate, ...DEFAULT_GOALS }];
      writes.push([GOALS, JSON.stringify(nextGoals)]);
    }
    if (writes.length) await storage.multiSet(writes);
    profile = nextProfile;
    goals = [...nextGoals].sort(byStart);
  }
  const goalsNow = () => goals[goals.length - 1];
  const goalsOn = (date) => goals.filter((row) => row.from <= date).pop();

  async function findMeal(id) {
    const index = await loadMeta();
    const key = String(id);
    const indexed = index.days[key];
    if (indexed) {
      const meals = await readDayMeals(indexed);
      const meal = meals.find((item) => String(item.id) === key);
      if (meal) return { date: indexed, meals, meal };
    }
    // The index can trail an interrupted write; the days themselves are the truth.
    for (const [date, meals] of Object.entries(await readAllDays())) {
      const meal = meals.find((item) => String(item.id) === key);
      if (meal) { index.days[key] = date; return { date, meals, meal }; }
    }
    return null;
  }

  async function writeDay(date, meals, nextMeta) {
    const metaEntry = [META, JSON.stringify(nextMeta)];
    if (meals.length) await storage.multiSet([[dayKey(date), JSON.stringify(meals)], metaEntry]);
    else { await storage.removeItem(dayKey(date)); await storage.setItem(...metaEntry); }
    meta = nextMeta;
  }

  return {
    readDay(date, options) {
      return exclusive(async () => {
        if (!current(options)) throw readCancelled();
        await loadProfile();
        return { date, ...summarize(await readDayMeals(date), goalsOn(date)) };
      });
    },
    readDays(options) {
      return exclusive(async () => {
        if (!current(options)) throw readCancelled();
        await loadProfile();
        const days = await readAllDays();
        return Object.fromEntries(Object.entries(days).map(([date, meals]) => [date, summarize(meals, goalsOn(date) ?? goals[0])]));
      });
    },

    readMeal(id, options) {
      return exclusive(async () => {
        if (!current(options)) throw readCancelled();
        const found = await findMeal(id);
        if (!found) throw failure("meal_not_found");
        return { ...found.meal };
      });
    },
    createMeals(foods, { createdAt, signal, isActive } = {}) {
      if (!Array.isArray(foods) || !foods.length || foods.length > 20) return Promise.reject(new Error("no_food_detected"));
      let entries;
      try { entries = foods.map((food) => foodEntryPayload(food, createdAt)); }
      catch (error) { return Promise.reject(error); }
      const { date, time } = eatenAt(createdAt, now);
      const notSaved = (reason, extra = {}) => failure("meal_save_failed", { savedEntries: [], mayHaveSaved: false,
        dispatched: false, reason, timedOut: false, ...extra });
      return exclusive(async () => {
        if (!current({ signal, isActive })) throw notSaved("meal_save_cancelled", { cancelled: true });
        let index, meals;
        try { await loadProfile(); index = await loadMeta(); meals = await readDayMeals(date); }
        catch (error) { throw notSaved(error?.message || "storage_failed"); }
        let nextId = index.nextId;
        const saved = entries.map((entry) => ({ id: nextId++, ...mealFields(entry), localTime: time,
          ...(entry.ingredients ? { ingredients: entry.ingredients } : {}) }));
        // A review that stopped being current while this waited never writes.
        if (!current({ signal, isActive })) throw notSaved("meal_save_cancelled", { cancelled: true });
        const days = { ...index.days };
        for (const meal of saved) days[String(meal.id)] = date;
        try { await writeDay(date, [...meals, ...saved], { nextId, days }); }
        catch (error) { meta = null; throw notSaved(error?.message || "storage_failed"); }
        return saved.map((meal) => ({ ...meal }));
      });
    },
    updateMeal(id, meal, { signal, isActive } = {}) {
      const problems = mealProblems(meal);
      if (problems.length) return Promise.reject(Object.assign(new Error(problems.join("\n")), { code: "meal_invalid", mayHaveSaved: false }));
      return exclusive(async () => {
        if (!current({ signal, isActive })) throw failure("meal_update_cancelled", { cancelled: true, mayHaveSaved: false });
        const notSaved = (reason) => Object.assign(new Error("Couldn’t save your changes. Please try again."), { code: "meal_save_failed", mayHaveSaved: false, reason });
        let found;
        try { found = await findMeal(id); }
        catch (error) { throw notSaved(error?.message); }
        if (!found) throw Object.assign(new Error("This meal is no longer in your log."), { code: "meal_not_found", mayHaveSaved: false });
        const fields = mealFields(meal);
        const next = { ...found.meal, ...fields };
        // A renamed food may be a different food, so its old ingredients no longer apply.
        if (found.meal.foodName !== fields.foodName) delete next.ingredients;
        if (!current({ signal, isActive })) throw failure("meal_update_cancelled", { cancelled: true, mayHaveSaved: false });
        try { await writeDay(found.date, found.meals.map((item) => item === found.meal ? next : item), await loadMeta()); }
        catch (error) { meta = null; throw notSaved(error?.message); }
        return undefined;
      });
    },
    deleteMeal(id, { signal, isActive } = {}) {
      const notDeleted = (code, extra = {}) => failure(code, { mayHaveDeleted: false, dispatched: false, timedOut: false, cancelled: false, ...extra });
      return exclusive(async () => {
        if (!current({ signal, isActive })) throw notDeleted("meal_delete_cancelled", { name: "AbortError", cancelled: true });
        try {
          const found = await findMeal(id);
          if (!found) throw notDeleted("meal_delete_failed");
          const index = await loadMeta();
          const days = { ...index.days };
          delete days[String(id)];
          await writeDay(found.date, found.meals.filter((item) => item !== found.meal), { ...index, days });
        } catch (error) {
          meta = null;
          throw error?.code === "meal_delete_failed" ? error : notDeleted("meal_delete_failed");
        }
        return { deleted: true };
      });
    },

    readGoals(options) {
      return exclusive(async () => {
        if (!current(options)) throw readCancelled();
        await loadProfile();
        return Object.fromEntries(GOAL_FIELDS.map((key) => [key, goalsNow()[key] ?? null]));
      });
    },
    saveGoals(next = {}, { startDate, signal, isActive } = {}) {
      const notSaved = (code, extra = {}) => failure(code, { mayHaveSaved: false, dispatched: false, timedOut: false, cancelled: false, ...extra });
      const given = GOAL_FIELDS.filter((key) => next?.[key] !== undefined);
      const valid = (value) => value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
      if (!isLocalDate(startDate) || !given.every((key) => valid(next[key]))) return Promise.reject(notSaved("goals_save_failed"));
      return exclusive(async () => {
        if (!current({ signal, isActive })) throw notSaved("goals_save_cancelled", { cancelled: true });
        try { await loadProfile(); }
        catch { throw notSaved("goals_save_failed"); }
        if (!given.length) return undefined;
        const latest = goalsNow() ?? DEFAULT_GOALS;
        const row = { from: startDate, ...Object.fromEntries(GOAL_FIELDS.map((key) => [key, given.includes(key) ? Number(next[key]) : latest[key]])) };
        const rows = [...goals.filter((item) => item.from !== startDate), row].sort(byStart);
        try { await storage.setItem(GOALS, JSON.stringify(rows)); }
        catch { throw notSaved("goals_save_failed"); }
        goals = rows;
        return undefined;
      });
    },

    readProfile(options) {
      return exclusive(async () => {
        if (!current(options)) throw readCancelled();
        await loadProfile();
        return { createdAtLocalDate: profile.createdAtLocalDate,
          ...Object.fromEntries(GOAL_FIELDS.map((key) => [key, goalsNow()[key] ?? null])) };
      });
    },

    // Everything above, gone from this iPhone. The next read starts a new profile.
    eraseAll() {
      return exclusive(async () => {
        const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
        if (keys.length) await storage.multiRemove(keys);
        meta = null; profile = null; goals = null;
        return { erased: keys.length };
      });
    },
  };
}
