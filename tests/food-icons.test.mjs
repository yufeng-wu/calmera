import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { FOOD_ICON_CATALOG, getFoodIcon, getFoodEmoji } from "../lib/foodIcons.mjs";
import { FOOD_ICON_ART } from "../lib/foodIconArt.mjs";

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
  assert.equal(getFoodIcon("coconut").id, "coconut");
  assert.equal(getFoodIcon("eggplant").id, "eggplant");
  assert.equal(getFoodIcon("Hash browns").id, "potato");
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

// Saved per-record choices store these IDs on the device; they must keep resolving.
const RELEASED_IDS = ["sandwich", "burger", "pizza", "taco", "burrito", "hot-dog", "sushi", "dumplings", "fried-rice", "noodles",
  "pasta", "curry", "salad", "soup", "fries", "pancakes", "cake", "pie", "cookie", "ice-cream", "chocolate", "doughnut", "bar",
  "smoothie", "juice", "coffee", "tea", "milk", "water", "soda", "beer", "wine", "oats", "yogurt", "bread", "croissant", "bagel",
  "rice", "egg", "cheese", "tofu", "beans", "chicken", "meat", "bacon", "fish", "shrimp", "seafood", "banana", "apple", "orange",
  "berries", "strawberry", "grapes", "watermelon", "pineapple", "mango", "peach", "pear", "kiwi", "lemon", "avocado", "broccoli",
  "greens", "carrot", "tomato", "cucumber", "sweet-potato", "potato", "corn", "mushroom", "nuts", "sauce"];

test("every previously released icon ID is still in the catalog", () => {
  const ids = new Set(FOOD_ICON_CATALOG.map(({ id }) => id));
  for (const id of RELEASED_IDS) assert.ok(ids.has(id), id);
});

test("dishes from many cuisines get a specific icon instead of the plate", () => {
  for (const [name, expected] of [
    ["Radish Kimchi", "radish-kimchi"], ["Seasoned Bean Sprouts", "bean-sprouts"], ["Pickled Peppers", "pickles"],
    ["Bibimbap", "bibimbap"], ["Napa Cabbage Kimchi", "kimchi"], ["Kimchi Fried Rice", "fried-rice"], ["Kimchi Jjigae", "soup"],
    ["Kimbap", "kimbap"], ["Tteokbokki", "tteokbokki"], ["Mapo Tofu", "mapo-tofu"], ["Silken tofu", "tofu"],
    ["Spring Rolls", "spring-rolls"], ["Char Siu Bao", "bao"], ["Samosa", "samosa"], ["Salmon Poke Bowl", "poke"],
    ["Banh Mi", "baguette"], ["Pho", "noodles"], ["Pad Thai", "noodles"], ["Onigiri", "rice-ball"], ["Edamame", "peas"],
    ["Chicken Tikka Masala", "curry"], ["Dal", "curry"], ["Naan", "flatbread"], ["Chicken Shawarma", "stuffed-flatbread"],
    ["Falafel", "falafel"], ["Tamales", "tamale"], ["Shakshuka", "paella"], ["Bubble Tea", "bubble-tea"],
    ["Scrambled Eggs", "fried-egg"], ["Mochi", "dango"], ["Xiaolongbao", "dumplings"], ["Pickled cucumber", "pickles"],
    ["Dill pickles", "pickles"], ["깍두기", "radish-kimchi"], ["黄豆芽", "bean-sprouts"], ["麻婆豆腐", "mapo-tofu"],
  ]) assert.equal(getFoodIcon(name).id, expected, name);
});

test("a longer matching phrase beats a shorter one; risky bare words are not aliases", () => {
  for (const [name, expected] of [
    ["Peanut butter", "nuts"], ["Coconut water", "coconut"], ["Kimchi pancake", "pancakes"], ["Poke cake", "cake"],
    ["Ice cream sandwich", "ice-cream"], ["Matcha latte", "tea"], ["Ginger ale", "soda"], ["Root beer", "soda"],
    ["Dr Pepper", "soda"], ["Water chestnut", "chestnut"], ["Soda bread", "bread"], ["Tea egg", "egg"],
    ["Tortilla chips", "fries"], ["Rice cakes", "rice-cracker"], ["Red pepper hummus", "sauce"], ["Mapo eggplant", "eggplant"],
    ["Black pepper beef", "meat"], ["Chicken salad", "salad"], ["Beef bulgogi bibimbap", "bibimbap"],
    ["김치찌개", "soup"], ["된장국", "soup"], ["냉면", "noodles"],
  ]) assert.equal(getFoodIcon(name).id, expected, name);
});

test("drawn icons carry their art key; emoji icons keep the original shape", () => {
  assert.deepEqual(getFoodIcon("Bibimbap"), { id: "bibimbap", emoji: "🍚", label: "Bibimbap", art: "bibimbap" });
  assert.deepEqual(getFoodIcon("Banana"), { id: "banana", emoji: "🍌", label: "Banana" });
  for (const entry of FOOD_ICON_CATALOG.filter(item => item.art)) assert.ok(FOOD_ICON_ART[entry.art], entry.art);
});

const allowed = new Set(["svg", "g", "defs", "path", "circle", "ellipse", "rect", "linearGradient", "radialGradient", "stop", "clipPath"]);
const compact = svg => svg.replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();

test("drawings are generated from the assets and stay small and renderer-safe", () => {
  const dir = new URL("../assets/food-icons/", import.meta.url);
  const files = readdirSync(dir).filter(name => name.endsWith(".svg")).sort();
  assert.deepEqual(Object.keys(FOOD_ICON_ART).sort(), files.map(name => name.slice(0, -4)));
  const seen = new Map();
  for (const name of files) {
    const svg = FOOD_ICON_ART[name.slice(0, -4)];
    assert.equal(svg, compact(readFileSync(new URL(name, dir), "utf8")), `${name} is stale: run scripts/generate-food-icon-art.mjs`);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">/, name);
    assert.ok(svg.length < 5000, `${name} is ${svg.length} bytes`);
    for (const [, tag] of svg.matchAll(/<([A-Za-z]+)/g)) assert.ok(allowed.has(tag), `${name} uses <${tag}>`);
    assert.doesNotMatch(svg, /\b(?:style|class|href|filter|mask)=/, name);
    for (const [, id] of svg.matchAll(/\bid="([^"]+)"/g)) {
      assert.ok(!seen.has(id) || seen.get(id) === name, `${id} repeats in ${name} and ${seen.get(id)}`);
      seen.set(id, name);
    }
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(svg.includes(`id="${ref}"`), `${name} references missing #${ref}`);
  }
});
