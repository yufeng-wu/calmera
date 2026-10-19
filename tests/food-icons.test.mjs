import test from "node:test";
import assert from "node:assert/strict";
import { FOOD_ICON_CATALOG, getFoodIcon, getFoodEmoji } from "../lib/foodIcons.mjs";

test("named dishes win over their ingredients in English and Chinese", () => {
  for (const [name, expected] of [
    ["Grilled fish sandwich with lettuce, tomato and pickle", "sandwich"],
    ["Chicken salad", "salad"],
    ["Banana smoothie", "smoothie"],
    ["Apple pie", "pie"],
    ["Strawberry yogurt", "yogurt"],
    ["Tofu curry with rice", "curry"],
    ["鸡肉沙拉", "salad"],
    ["草莓蛋糕", "cake"],
    ["牛肉炒飯", "fried-rice"],
    ["香蕉奶昔", "smoothie"],
    ["燕麥奶", "milk"],
    ["French fries", "fries"],
    ["Sweet potato", "sweet-potato"],
  ]) {
    assert.equal(getFoodIcon(name).id, expected, name);
  }
});

test("word boundaries avoid accidental ingredient matches", () => {
  for (const name of ["Pineapple", "PINEAPPLES"]) {
    assert.equal(getFoodIcon(name).id, "pineapple");
  }
  assert.equal(getFoodIcon("chickpeas").id, "beans");
  assert.equal(getFoodIcon("coconut").id, "meal");
  assert.equal(getFoodIcon("eggplant").id, "meal");
  assert.equal(getFoodIcon("nutmeg").id, "meal");
  assert.equal(getFoodIcon("wheatgrass").id, "meal");
  assert.equal(getFoodIcon("discovery").id, "meal");
});

test("normalization handles case, full width and punctuation without changing input", () => {
  assert.equal(getFoodEmoji("ＢＡＮＡＮＡ"), "🍌");
  assert.equal(getFoodIcon("  HOT-DOG  ").id, "hot-dog");
  assert.equal(getFoodIcon("(salmon), grilled").id, "fish");
  assert.equal(getFoodIcon("BANANA - CALMERA PHONE VOICE TEST 2026-10-18").id, "banana");
  assert.equal(getFoodIcon("Unknown - CALMERA PHOTO TEST banana").id, "meal");
});

test("unknown or malformed names have a neutral, stable fallback", () => {
  for (const name of ["", "  ", null, undefined, 123, {}, "家常餐", "A new dish"]) {
    assert.deepEqual(getFoodIcon(name), { id: "meal", emoji: "🍽️", label: "Meal" });
  }
});

test("catalog has unique keys, complete display metadata and immutable aliases", () => {
  assert.ok(FOOD_ICON_CATALOG.length >= 60);
  assert.equal(new Set(FOOD_ICON_CATALOG.map(({ id }) => id)).size, FOOD_ICON_CATALOG.length);
  for (const entry of FOOD_ICON_CATALOG) {
    assert.ok(entry.emoji && entry.label && entry.aliases.length > 0);
    assert.ok(Object.isFrozen(entry));
    assert.ok(Object.isFrozen(entry.aliases));
    const result = getFoodIcon(entry.aliases[0]);
    assert.equal(result.id, entry.id, entry.id);
  }
});
