import test from "node:test";
import assert from "node:assert/strict";
import { createThemePreferences } from "../src/lib/settings/themePreferences.mjs";
import { APPEARANCE_THEMES, DEFAULT_THEME_ID } from "../src/constants/appearance.mjs";
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test("all permanent themes including White, Off-white, Matcha Latte and Mocha persist and restore", async () => {
  const map = new Map();
  const store = createThemePreferences({ getItem: async key => map.get(key), setItem: async (key, value) => map.set(key, value) });
  for (const theme of APPEARANCE_THEMES) {
    await store.save("test", theme.id);
    assert.equal(await store.load("test"), theme.id);
  }
});
test("missing and obsolete theme values fall back without rewriting storage", async () => {
  const store = createThemePreferences({ getItem: async () => "old-palette", setItem: () => assert.fail("no implicit write") });
  assert.equal(await store.load("test"), DEFAULT_THEME_ID);
});
test("rapid writes serialize and loading waits for the final selection", async () => {
  const gate = deferred(); const started = []; let saved;
  const store = createThemePreferences({ getItem: async () => saved,
    setItem: async (key, id) => { started.push(id); if (id === "dawn") await gate.promise; saved = id; } });
  const first = store.save("test", "dawn");
  const last = store.save("test", "aura");
  const restored = store.load("test");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, ["dawn"]);
  gate.resolve(); await Promise.all([first, last]);
  assert.deepEqual(started, ["dawn", "aura"]);
  assert.equal(await restored, "aura");
});
test("a failed write does not poison later selections", async () => {
  let saved;
  const store = createThemePreferences({ getItem: async () => saved,
    setItem: async (key, id) => { if (id === "dawn") throw new Error("disk"); saved = id; } });
  const failed = store.save("test", "dawn");
  const later = store.save("test", "glow");
  await assert.rejects(failed, /disk/); await later;
  assert.equal(await store.load("test"), "glow");
});
test("owner/review keys remain isolated and never enumerate preferences", async () => {
  const reads = []; const values = new Map([["owner-a", "glow"], ["owner-b", "aura"]]);
  const store = createThemePreferences({ getItem: async key => { reads.push(key); return values.get(key); },
    setItem: async (key, id) => values.set(key, id) });
  await store.save("review", "dawn");
  assert.equal(await store.load("owner-a"), "glow");
  assert.deepEqual(reads, ["owner-a"]);
  assert.equal(values.get("owner-b"), "aura");
});
test("invalid theme cannot reach storage", async () => {
  const store = createThemePreferences({ getItem: async () => null, setItem: () => assert.fail("invalid write") });
  await assert.rejects(store.save("test", "arbitrary"), /invalid_theme/);
});
test("read errors propagate for an explicit UI retry", async () => {
  const store = createThemePreferences({ getItem: async () => { throw new Error("disk"); }, setItem: async () => {} });
  await assert.rejects(store.load("test"), /disk/);
});
