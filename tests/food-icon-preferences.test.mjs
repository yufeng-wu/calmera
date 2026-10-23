import test from "node:test";
import assert from "node:assert/strict";
import { createFoodIconPreferences } from "../lib/foodIconPreferences.mjs";

const storage = () => {
  const data = new Map();
  return { data, getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } };
};

test("emoji preferences survive a reload and remain scoped to account and record", async () => {
  const disk = storage(); let prefs = createFoodIconPreferences(disk);
  await prefs.save("owner-a", { 1: "sushi", 2: "apple" });
  await prefs.save("owner-b", { 1: "banana" });
  prefs = createFoodIconPreferences(disk);
  assert.deepEqual(await prefs.load("owner-a"), { 1: "sushi", 2: "apple" });
  assert.deepEqual(await prefs.load("owner-b"), { 1: "banana" });
  assert.deepEqual(await prefs.load("owner-c"), {});
});

test("concurrent preference writes merge instead of overwriting other food choices", async () => {
  const disk = storage(); const prefs = createFoodIconPreferences(disk);
  await Promise.all([prefs.save("owner", { 1: "sushi" }), prefs.save("owner", { 2: "apple" }), prefs.save("owner", { 1: "banana" })]);
  assert.deepEqual(await createFoodIconPreferences(disk).load("owner"), { 1: "banana", 2: "apple" });
});

test("corrupt metadata and unknown icons are ignored; failed writes can be explicitly retried", async () => {
  const disk = storage(); disk.data.set("calmera.food-icons.v1.owner", "not json");
  const prefs = createFoodIconPreferences(disk);
  assert.deepEqual(await prefs.load("owner"), {});
  await prefs.save("owner", { 1: "arbitrary", 2: "apple", "bad/id": "sushi" });
  assert.deepEqual(await prefs.load("owner"), { 2: "apple" });
  const original = disk.setItem; disk.setItem = async () => { throw new Error("disk failure"); };
  await assert.rejects(prefs.save("owner", { 3: "sushi" }));
  assert.deepEqual(await prefs.load("owner"), { 2: "apple" });
  disk.setItem = original; await prefs.save("owner", { 3: "sushi" });
  assert.deepEqual(await prefs.load("owner"), { 2: "apple", 3: "sushi" });
});
