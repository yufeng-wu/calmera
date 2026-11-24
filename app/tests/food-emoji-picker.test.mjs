import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { FOOD_ICON_CATALOG } from "../src/lib/foodIcons.mjs";
import * as pickerModel from "../src/lib/foodEmojiPicker.mjs";

const { FOOD_EMOJI_CATEGORIES, getFoodEmojiSections } = pickerModel;
const ids = sections => sections.flatMap(section => section.icons.map(icon => icon.id));

test("categories cover each existing saved icon ID exactly once without changing catalog metadata", () => {
  const grouped = FOOD_EMOJI_CATEGORIES.flatMap(category => category.icons);
  assert.equal(grouped.length, FOOD_ICON_CATALOG.length);
  assert.equal(new Set(grouped.map(icon => icon.id)).size, FOOD_ICON_CATALOG.length);
  assert.deepEqual([...grouped.map(icon => icon.id)].sort(), [...FOOD_ICON_CATALOG.map(icon => icon.id)].sort());
  assert.ok(FOOD_EMOJI_CATEGORIES.every(category => Object.isFrozen(category) && Object.isFrozen(category.icons)));
  assert.ok(grouped.every(icon => FOOD_ICON_CATALOG.includes(icon)));
});

test("search finds partial labels, English aliases, Chinese aliases and emoji variants", () => {
  for (const [query, expected] of [
    ["noo", ["noodles"]], ["toast", ["bread"]], ["  ＨＯＴ—ＤＯＧ  ", ["hot-dog"]],
    ["protein shake", ["smoothie"]], ["三文魚", ["fish"]], ["鸡胸", ["chicken"]],
    ["炒飯", ["fried-rice"]], ["☕️", ["coffee"]], ["🧃", ["juice"]],
    ["🥤", ["smoothie", "soda"]], ["kimchi", ["kimchi", "pancakes"]], ["깍두기", ["kimchi"]],
    ["sprouts", ["bean-sprouts"]], ["boba", ["bubble-tea"]], ["tea", ["egg", "bubble-tea", "tea"]], ["sub", ["sandwich"]],
    ["🥬", ["kimchi", "greens"]],
  ]) assert.deepEqual(ids(getFoodEmojiSections(query)), expected, query);
});

test("category browsing and global search stay predictable and leave the catalog immutable", () => {
  assert.deepEqual(getFoodEmojiSections("", "fruit").map(section => section.id), ["fruit"]);
  assert.deepEqual(ids(getFoodEmojiSections("turkey", "fruit")), ["chicken"]);
  assert.deepEqual(getFoodEmojiSections(" ", "fruit").map(section => section.id), ["fruit"]);
  assert.equal(ids(getFoodEmojiSections("", "unknown")).length, FOOD_ICON_CATALOG.length);
  assert.deepEqual(getFoodEmojiSections("nothing matching this query"), []);
  const result = getFoodEmojiSections("", "fruit");
  result[0].icons.pop();
  assert.equal(getFoodEmojiSections("", "fruit")[0].icons.length, 18);
});

const require = createRequire(import.meta.url);
const React = require("react");
const babel = require("@babel/core");
const compiled = babel.transformSync(readFileSync(new URL("../src/components/FoodEmojiPicker.jsx", import.meta.url), "utf8"), {
  babelrc: false, configFile: false, presets: [[require.resolve("@babel/preset-react"), { runtime: "automatic" }]],
  plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
}).code;
const all = node => !node || typeof node !== "object" ? [] : Array.isArray(node)
  ? node.flatMap(all) : [node, ...all(node.props?.children)];
const find = (tree, predicate) => all(tree).find(predicate);
const labelled = (tree, label) => find(tree, node => node.props?.accessibilityLabel === label);
function fixture({ disabled = false, fontScale = 1 } = {}) {
  const slots = []; let index = 0, closes = 0, dismissals = 0;
  const selections = [];
  const react = { ...React,
    useRef(initial) { const at = index++; return slots[at] ??= { current: initial }; },
    useState(initial) { const at = index++; if (!(at in slots)) slots[at] = initial;
      return [slots[at], value => { slots[at] = value; }]; },
  };
  const imports = {
    react,
    "react-native": { ...Object.fromEntries(["Pressable", "ScrollView", "Text", "TextInput", "View"].map(key => [key, key])),
      Keyboard: { dismiss: () => { dismissals++; } }, Platform: { OS: "ios" },
      StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: {} }, useWindowDimensions: () => ({ width: 402, fontScale }) },
    "@/components/SheetModal": "SheetModal",
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
    "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/components/GlassForm": { GlassButton: "GlassButton" },
    "@/constants/formTheme": { FORM_COLORS: {} }, "@/constants/typography": { TYPOGRAPHY: {} },
    "@/lib/foodEmojiPicker.mjs": pickerModel,
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
    if (Object.hasOwn(imports, name)) return imports[name];
    assert.equal(name, "react/jsx-runtime"); return require(name);
  } });
  const Picker = module.exports.default;
  return { selections, get closes() { return closes; }, get dismissals() { return dismissals; }, render: () => {
    index = 0;
    return Picker({ disabled, selectedIconId: "rice", onSelect: id => selections.push(id), onClose: () => { closes++; } });
  } };
}

test("category and search interactions expose matching choices and clear back to all foods", () => {
  const picker = fixture(); let tree = picker.render();
  labelled(tree, "Fruit food icons").props.onPress(); tree = picker.render();
  assert.ok(labelled(tree, "Apple")); assert.equal(labelled(tree, "Sushi"), undefined);
  labelled(tree, "Search food icons").props.onChangeText("sashimi"); tree = picker.render();
  assert.ok(labelled(tree, "Sushi")); assert.equal(labelled(tree, "Apple"), undefined);
  labelled(tree, "Search food icons").props.onChangeText("nothing matching this query"); tree = picker.render();
  assert.ok(find(tree, node => node.type === "Text" && node.props.children === "No matching foods"));
  labelled(tree, "Clear icon search").props.onPress(); tree = picker.render();
  assert.equal(labelled(tree, "Search food icons").props.value, "");
  assert.ok(labelled(tree, "Sushi")); assert.ok(labelled(tree, "Apple"));
});

test("selection emits the stable ID and dismisses the keyboard; disabled choices never submit", () => {
  const picker = fixture(); const tree = picker.render();
  assert.equal(labelled(tree, "Rice").props.accessibilityState.selected, true);
  labelled(tree, "Sushi").props.onPress();
  assert.deepEqual(picker.selections, ["sushi"]); assert.equal(picker.closes, 1); assert.equal(picker.dismissals, 1);
  const locked = fixture({ disabled: true });
  const sushi = labelled(locked.render(), "Sushi");
  assert.equal(sushi.props.disabled, true); sushi.props.onPress();
  assert.deepEqual(locked.selections, []); assert.equal(locked.closes, 0);
});

test("Close stays in the sheet header outside scrolling content and remains available at large text sizes", () => {
  const picker = fixture({ fontScale: 3 }); const tree = picker.render();
  assert.equal(tree.type, "SheetModal");
  assert.equal(tree.props.dismissLabel, "Dismiss icon picker");
  const scroll = find(tree, node => node.type === "ScrollView");
  assert.equal(labelled(scroll, "Close icon picker"), undefined);
  assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
  const sushi = labelled(tree, "Sushi");
  assert.ok(sushi.props.style({ pressed: false }).some(style => style.width >= 300));
  // Without a mounted sheet to animate, closing falls through to onClose directly.
  labelled(tree.props.header, "Close icon picker").props.onPress();
  assert.equal(picker.closes, 1); assert.equal(picker.dismissals, 1);
});
