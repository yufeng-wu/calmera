import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import * as reviewModel from "../lib/photoMealReview.mjs";
import * as editorDraft from "../lib/mealEditorDraft.mjs";
import { canEstimatePhoto, photoConnectionPresentation } from "../lib/photoLogPresentation.mjs";

const require = createRequire(import.meta.url);
const React = require("react");
const babel = require("@babel/core");
const food = { foodName: "Rice", quantity: "1 cup", mealType: "Lunch", calories: 200, protein: 4, carbs: 45, fat: 1 };
const compile = path => babel.transformSync(readFileSync(new URL(path, import.meta.url), "utf8"), {
  babelrc: false, configFile: false, presets: [[require.resolve("@babel/preset-react"), { runtime: "automatic" }]],
  plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
}).code;
function load(code, imports) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (Object.hasOwn(imports, name)) return imports[name];
    assert.equal(name, "react/jsx-runtime"); return require(name);
  } });
  return module.exports.default;
}
function hooks() {
  const slots = []; let index = 0;
  return { reset: () => { index = 0; }, react: { ...React,
    useRef(initial) { const at = index++; return slots[at] ??= { current: initial }; },
    useState(initial) { const at = index++; if (!(at in slots)) slots[at] = initial;
      return [slots[at], value => { slots[at] = typeof value === "function" ? value(slots[at]) : value; }]; },
    useCallback: callback => callback,
  } };
}
const all = node => !node || typeof node !== "object" ? [] : Array.isArray(node)
  ? node.flatMap(all) : [node, ...all(node.props?.children)];
const find = (tree, predicate) => all(tree).find(predicate);
const button = (tree, title) => find(tree, node => node.type === "GlassButton" && node.props.title === title);
const compiledReview = compile("../components/PhotoMealReview.jsx");
function reviewFixture() {
  const runtime = hooks(); const saves = [], alerts = [];
  const props = { photo: { dataURL: "synthetic-photo" }, review: reviewModel.createPhotoMealReview([food], "owner", "2026-10-21T12:00:00-04:00"),
    editor: null, setReview: value => { props.review = value; },
    setEditor: value => { props.editor = typeof value === "function" ? value(props.editor) : value; },
    onSave: (...args) => saves.push(args), onReestimate: () => {},
  };
  const Review = load(compiledReview, {
    react: runtime.react,
    "react-native": { ...Object.fromEntries(["Image", "Modal", "Pressable", "ScrollView", "Text", "View"].map(key => [key, key])),
      Alert: { alert: (...args) => alerts.push(args) }, Keyboard: { dismiss() {} },
      StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: {} }, useWindowDimensions: () => ({ fontScale: 1 }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@/components/GlassForm": Object.fromEntries(["FormScreen", "FormScrollView", "FormHeader", "FormCard", "GlassButton"].map(key => [key, key])),
    "@/components/FoodEntryFormCard": { FoodEntryFormCard: "FoodEntryFormCard" },
    "@/constants/formTheme": { FORM_COLORS: {} }, "@/constants/typography": { TYPOGRAPHY: {} },
    "@/lib/foodIcons.mjs": { getFoodEmoji: () => "🍚" },
    "@/lib/mealEditorDraft.mjs": editorDraft, "@/lib/photoMealReview.mjs": reviewModel,
  });
  return { props, saves, alerts, render: () => { runtime.reset(); return Review(props); } };
}

test("photo estimation requires a verified ready connection and a photo", () => {
  const ready = { photo: {}, connection: { state: "ready" } };
  assert.equal(canEstimatePhoto(ready), true);
  assert.equal(canEstimatePhoto({ ...ready, photo: null }), false);
  for (const state of ["checking", "disconnected", "temporary", "restricted", "limited", "sign-in", "unavailable"]) {
    assert.equal(canEstimatePhoto({ ...ready, connection: { state } }), false);
  }
  for (const flag of ["busy", "selecting", "uncertain", "mealSaved"]) assert.equal(canEstimatePhoto({ ...ready, [flag]: true }), false);
  assert.equal(photoConnectionPresentation({ state: "restricted", issue: { action: null } }).action, null);
});

test("Save opens four categories; Cancel leaves the review unsaved", () => {
  const fixture = reviewFixture(); let tree = fixture.render();
  button(tree, "Save meal").props.onPress(); tree = fixture.render();
  const modal = find(tree, node => node.type === "Modal");
  assert.equal(modal.props.visible, true);
  assert.deepEqual(all(modal).filter(node => node.type === "GlassButton").map(node => node.props.title), [...reviewModel.PHOTO_MEAL_TYPES, "Cancel"]);
  assert.equal(fixture.saves.length, 0);
  button(modal, "Cancel").props.onPress();
  assert.equal(find(fixture.render(), node => node.type === "Modal").props.visible, false);
  assert.equal(fixture.saves.length, 0);
});

test("Save includes pending inline edits and submits the selected category exactly once", () => {
  const fixture = reviewFixture(); let tree = fixture.render();
  find(tree, node => node.props?.accessibilityLabel === "Edit Rice").props.onPress();
  tree = fixture.render();
  assert.equal(find(tree, node => node.type === "FormHeader").props.title, "Review meal");
  const form = find(tree, node => node.type === "FoodEntryFormCard");
  form.props.setFoodName("Brown rice"); form.props.setQuantity("150 g"); form.props.setCalories("180");
  tree = fixture.render();
  button(tree, "Save meal").props.onPress(); tree = fixture.render();
  const chooseDinner = button(find(tree, node => node.type === "Modal"), "Dinner").props.onPress;
  chooseDinner(); chooseDinner();
  assert.equal(fixture.saves.length, 1);
  assert.equal(fixture.saves[0][0], "Dinner");
  assert.equal(fixture.saves[0][1].entries[0].foodName, "Brown rice");
  assert.equal(fixture.saves[0][1].entries[0].quantity, "150 g");
  assert.equal(fixture.saves[0][1].entries[0].calories, 180);
});

test("invalid inline edits keep the editor open and never open category selection", () => {
  const fixture = reviewFixture(); let tree = fixture.render();
  find(tree, node => node.props?.accessibilityLabel === "Edit Rice").props.onPress();
  tree = fixture.render(); find(tree, node => node.type === "FoodEntryFormCard").props.setCalories("-1");
  tree = fixture.render(); button(tree, "Save meal").props.onPress(); tree = fixture.render();
  assert.ok(fixture.props.editor);
  assert.equal(find(tree, node => node.type === "Modal").props.visible, false);
  assert.equal(fixture.saves.length, 0); assert.equal(fixture.alerts.length, 1);
});

const compiledHook = compile("../hooks/usePhotoLogConnection.js");
function connectionFixture() {
  const runtime = hooks(); const pending = []; let focus, appListener, cleanup;
  const runConnectionHook = load(compiledHook, {
    react: runtime.react,
    "react-native": { AppState: { currentState: "active", addEventListener: (_, callback) => { appListener = callback; return { remove() {} }; } } },
    "@react-navigation/native": { useFocusEffect: callback => { focus = callback; } },
    "@/lib/chatgpt/planClient": { createPlanClient: () => ({}) },
    "@/lib/chatgpt/connectionOutcome.mjs": { readChatGPTConnection: (_, options) => new Promise(resolve => pending.push({ resolve, options })) },
    "@/lib/chatgpt/connectionStatus.mjs": { connectionIssue: () => ({ action: "retry" }) },
  });
  return { pending, render: () => { runtime.reset(); return runConnectionHook("owner"); },
    focus: () => { cleanup = focus(); }, blur: () => cleanup(), appState: state => appListener(state) };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test("an obsolete connection check cannot override a newer result or a later screen focus", async () => {
  const fixture = connectionFixture(); fixture.render(); fixture.focus();
  fixture.render().refresh();
  fixture.pending[1].resolve({ state: "temporary" }); await settle();
  fixture.pending[0].resolve({ state: "ready" }); await settle();
  assert.equal(fixture.render().connection.state, "temporary");
  fixture.render().refresh(); fixture.blur();
  assert.equal(fixture.pending[2].options.isCurrent(), false);
  fixture.pending[2].resolve({ state: "ready" }); await settle();
  fixture.render(); fixture.focus();
  assert.equal(fixture.render().connection.state, "checking");
  fixture.pending[3].resolve({ state: "ready" }); await settle();
  assert.equal(fixture.render().connection.state, "ready");
  fixture.appState("background"); fixture.appState("active");
  assert.equal(fixture.render().connection.state, "checking");
  assert.equal(fixture.pending.length, 5);
});
