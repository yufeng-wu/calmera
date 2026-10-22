import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { createConfirmedMealSave } from "../lib/confirmedMealSave.mjs";
import * as reviewModel from "../lib/mealReview.mjs";
import * as foodIcons from "../lib/foodIcons.mjs";
import { connectionIssue } from "../lib/chatgpt/connectionStatus.mjs";
import { canAnalyzeMeal, connectionPresentation } from "../lib/mealLogPresentation.mjs";

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
  vm.runInNewContext(code, { AbortController, module, exports: module.exports, require: name => {
    if (Object.hasOwn(imports, name)) return imports[name];
    assert.equal(name, "react/jsx-runtime"); return require(name);
  } });
  return module.exports.default;
}
function hooks() {
  const slots = []; let index = 0;
  return { reset: () => { index = 0; }, react: { ...React,
    useRef(initial) { const at = index++; return slots[at] ??= { current: initial }; },
    useState(initial) { const at = index++; if (!(at in slots)) slots[at] = typeof initial === "function" ? initial() : initial;
      return [slots[at], value => { slots[at] = typeof value === "function" ? value(slots[at]) : value; }]; },
    useCallback: callback => callback, useEffect() {}, useId: () => "test-keyboard",
  } };
}
const all = node => !node || typeof node !== "object" ? [] : Array.isArray(node)
  ? node.flatMap(all) : [node, ...all(node.props?.children)];
const find = (tree, predicate) => all(tree).find(predicate);
const button = (tree, title) => find(tree, node => node.type === "GlassButton" && node.props.title === title);
const input = (tree, label) => find(tree, node => node.type === "TextInput" && node.props.accessibilityLabel === label);
const saveButton = tree => find(tree, node => node.type === "GlassButton" && /^Save meal as /.test(node.props.accessibilityLabel || ""));
const mealPicker = tree => find(tree, node => node.props?.testID === "meal-type-picker");
// Chainable stand-in for Reanimated layout-animation builders.
const motionBuilder = new Proxy(function builder() {}, { get: (_, key) => key === "then" ? undefined : motionBuilder, apply: () => motionBuilder });
const reanimatedStub = { View: "AnimatedView", Easing: { bezier: () => () => 0 }, FadeIn: motionBuilder, FadeInDown: motionBuilder, FadeOutDown: motionBuilder,
  useAnimatedStyle: () => ({}), useSharedValue: value => ({ value }), withTiming: value => value, withSpring: value => value, useReducedMotion: () => false };
const compiledReview = compile("../components/MealReview.jsx");
function reviewFixture() {
  const runtime = hooks(); const saves = [], alerts = [];
  const props = { photo: { dataURL: "synthetic-photo" }, review: reviewModel.createMealReview([food], "owner", "2026-10-21T12:00:00-04:00"),
    setReview: value => { props.review = typeof value === "function" ? value(props.review) : value; },
    onSave: (...args) => saves.push(args), onReestimate: () => {},
  };
  const Review = load(compiledReview, {
    react: runtime.react,
    "react-native": { ...Object.fromEntries(["Image", "InputAccessoryView", "Modal", "Pressable", "ScrollView", "StatusBar", "Text", "TextInput", "View"].map(key => [key, key])),
      Platform: { OS: "ios" },
      Alert: { alert: (...args) => alerts.push(args) }, Keyboard: { dismiss() {} }, AccessibilityInfo: { announceForAccessibility() {} },
      StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: {} }, useWindowDimensions: () => ({ fontScale: 1, width: 402, height: 874 }) },
    "react-native-reanimated": reanimatedStub, "expo-haptics": { selectionAsync: async () => {}, impactAsync: async () => {}, notificationAsync: async () => {},
      ImpactFeedbackStyle: {}, NotificationFeedbackType: {} },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0, top: 0 }) },
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@/components/GlassForm": Object.fromEntries(["FormScreen", "FormScrollView", "FormHeader", "FormCard", "GlassButton"].map(key => [key, key])),
    "@/constants/formTheme": { FORM_COLORS: {} }, "@/constants/typography": { TYPOGRAPHY: {} },
    "@/components/FoodEmojiPicker": "FoodEmojiPicker",
    "@/lib/foodIcons.mjs": foodIcons,
    "@/context/FoodIconsContext": { useFoodIcons: () => ({ emojiFor: entry => foodIcons.getFoodEmoji(entry.foodName) }) }, "@/lib/mealReview.mjs": reviewModel,
  });
  return { props, saves, alerts, render: () => { runtime.reset(); return Review(props); } };
}

test("photo estimation requires a verified ready connection and a photo", () => {
  const ready = { photo: {}, connection: { state: "ready" } };
  assert.equal(canAnalyzeMeal(ready), true);
  assert.equal(canAnalyzeMeal({ ...ready, photo: null }), false);
  for (const state of ["checking", "disconnected", "temporary", "restricted", "limited", "sign-in", "unavailable"]) {
    assert.equal(canAnalyzeMeal({ ...ready, connection: { state } }), false);
  }
  for (const flag of ["busy", "selecting", "uncertain", "mealSaved"]) assert.equal(canAnalyzeMeal({ ...ready, [flag]: true }), false);
  assert.equal(connectionPresentation({ state: "restricted", issue: { action: null } }).action, "settings");
});

test("unavailable photo connections share one message and open settings without suggesting reauthorization", () => {
  const errors = [new Error("development_build_required"), new Error("no_eligible_models"),
    Object.assign(new Error("openai_http_403"), { apiCode: "subscription_sharing_user_not_eligible" }),
    Object.assign(new Error("openai_http_400"), { apiCode: "invalid_client" })];
  const presentations = errors.map(error => {
    const issue = connectionIssue(error);
    assert.equal(issue.action, null);
    return connectionPresentation({ state: issue.kind, issue });
  });
  assert.equal(new Set(presentations.map(value => value.title)).size, 1);
  assert.equal(new Set(presentations.map(value => value.detail)).size, 1);
  assert.ok(presentations.every(value => value.action === "settings"));
});

test("simplified photo messages retain distinct sign-in, permission, usage and retry actions", () => {
  const cases = [
    [new Error("chatgpt_refresh_required"), "sign-in"],
    [new Error("plan_permission_required"), "sign-in"],
    [Object.assign(new Error("openai_http_429"), { apiCode: "subscription_sharing_usage_limit_exceeded" }), "usage"],
    [new Error("openai_http_429"), "retry"],
    [new Error("openai_http_503"), "retry"],
  ];
  for (const [error, action] of cases) {
    const issue = connectionIssue(error);
    const presentation = connectionPresentation({ state: issue.kind, issue });
    assert.equal(presentation.action, action);
    assert.ok(presentation.actionLabel);
  }
  const permission = connectionIssue(new Error("plan_permission_required"));
  const expired = connectionIssue(new Error("chatgpt_refresh_required"));
  assert.notEqual(permission.title, expired.title);
});

test("the meal type starts from the estimate and is chosen inline without saving", () => {
  const fixture = reviewFixture(); let tree = fixture.render();
  assert.equal(find(tree, node => node.type === "Modal" && node.props.visible), undefined);
  assert.equal(mealPicker(tree).props.value, "Lunch");
  assert.equal(saveButton(tree).props.title, "Save lunch");
  mealPicker(tree).props.onChange("Breakfast"); tree = fixture.render();
  assert.equal(fixture.props.review.mealType, "Breakfast");
  assert.equal(saveButton(tree).props.title, "Save breakfast");
  assert.equal(fixture.saves.length, 0);
});

test("Save includes pending inline edits and submits the chosen meal type exactly once", () => {
  const fixture = reviewFixture(); let tree = fixture.render();
  find(tree, node => node.props?.accessibilityLabel === "Edit Rice").props.onPress();
  tree = fixture.render();
  assert.equal(find(tree, node => node.type === "FormHeader").props.title, "Review");
  input(tree, "Food name").props.onChangeText("Brown rice");
  input(tree, "Amount").props.onChangeText("150 g");
  input(tree, "Calories").props.onChangeText("180");
  mealPicker(fixture.render()).props.onChange("Dinner");
  tree = fixture.render();
  const save = saveButton(tree).props.onPress;
  save(); save();
  assert.equal(fixture.saves.length, 1);
  assert.equal(fixture.saves[0][0], "Dinner");
  assert.equal(fixture.saves[0][1].entries[0].foodName, "Brown rice");
  assert.equal(fixture.saves[0][1].entries[0].quantity, "150 g");
  assert.equal(fixture.saves[0][1].entries[0].calories, 180);
});

test("invalid inline edits keep the editor open and never save", () => {
  const fixture = reviewFixture(); let tree = fixture.render();
  find(tree, node => node.props?.accessibilityLabel === "Edit Rice").props.onPress();
  tree = fixture.render(); input(tree, "Calories").props.onChangeText("-1");
  tree = fixture.render(); saveButton(tree).props.onPress(); tree = fixture.render();
  assert.equal(input(tree, "Calories").props.value, "-1");
  assert.equal(fixture.saves.length, 0); assert.equal(fixture.alerts.length, 1);
});

const compiledHook = compile("../hooks/useMealLogConnection.js");
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


test("food rows start compact; expanding exposes one set of directly editable fields", () => {
  const fixture = reviewFixture(); let tree = fixture.render();
  assert.equal(input(tree, "Calories"), undefined);
  find(tree, node => node.props?.accessibilityLabel === "Edit Rice").props.onPress();
  tree = fixture.render();
  assert.equal(all(tree).filter(node => node.type === "TextInput").length, 6);
  assert.equal(button(tree, "Apply changes"), undefined);
  assert.equal(button(tree, "Cancel edits"), undefined);
  input(tree, "Calories").props.onChangeText("250");
  assert.equal(fixture.props.review.entries[0].calories, "250");
  assert.equal(reviewModel.reviewTotals(fixture.props.review).calories, 250);
  assert.equal(fixture.saves.length, 0);
  find(fixture.render(), node => node.props?.accessibilityLabel === "Collapse Rice").props.onPress();
  assert.equal(input(fixture.render(), "Calories"), undefined);
  assert.equal(fixture.props.review.entries[0].calories, "250");
});

test("new food appears before Add, blocks another unfinished entry, and saves direct edits", () => {
  const fixture = reviewFixture(); button(fixture.render(), "Add food").props.onPress();
  let tree = fixture.render();
  assert.equal(fixture.props.review.entries.length, 2);
  assert.equal(button(tree, "Add food").props.disabled, true);
  const nodes = all(tree);
  assert.ok(nodes.indexOf(input(tree, "Food name")) < nodes.indexOf(button(tree, "Add food")));
  input(tree, "Food name").props.onChangeText("Egg"); input(tree, "Amount").props.onChangeText("1 egg");
  input(tree, "Calories").props.onChangeText("70");
  tree = fixture.render();
  assert.equal(button(tree, "Add food").props.disabled, false);
  assert.equal(fixture.saves.length, 0);
});

test("emoji choice is retained in the draft; compact removal and Undo preserve it", () => {
  const fixture = reviewFixture(); let tree = fixture.render();
  find(tree, node => node.props?.accessibilityLabel === "Change emoji for Rice").props.onPress();
  tree = fixture.render();
  const picker = find(tree, node => node.type === "FoodEmojiPicker");
  assert.equal(picker.props.selectedIconId, "rice");
  picker.props.onSelect("sushi"); picker.props.onClose();
  assert.equal(fixture.props.review.entries[0].iconId, "sushi");
  find(fixture.render(), node => node.props?.accessibilityLabel === "Edit Rice").props.onPress();
  find(fixture.render(), node => node.props?.accessibilityLabel === "Remove Rice").props.onPress();
  assert.equal(fixture.props.review.entries.length, 0);
  find(fixture.render(), node => node.type === "Pressable" && node.props.accessibilityLabel === "Undo").props.onPress();
  assert.equal(fixture.props.review.entries[0].iconId, "sushi");
  assert.equal(fixture.props.review.entries.length, 1);
});

test("text analysis needs one nonblank description; amount is optional at input", () => {
  const ready = { inputMode: "text", text: "Apple", connection: { state: "ready" } };
  assert.equal(canAnalyzeMeal(ready), true);
  assert.equal(canAnalyzeMeal({ ...ready, text: "Had an apple and scrambled eggs for breakfast" }), true);
  for (const text of ["", "  ", "a".repeat(3001), null]) assert.equal(canAnalyzeMeal({ ...ready, text }), false);
  for (const flag of ["busy", "selecting", "uncertain", "mealSaved"]) assert.equal(canAnalyzeMeal({ ...ready, [flag]: true }), false);
});

const compiledLog = compile("../components/MealLogScreen.jsx");
function logFixture(inputMode = "text") {
  const runtime = hooks();
  let focus, cleanup, owner = "owner", exits = 0;
  const requests = [], writes = [], alerts = [], errors = [];
  const service = { analyze: async () => [food], estimate: async () => ({ calories: 180, protein: 4, carbs: 39, fat: 1 }) };
  const navigation = { setOptions() {}, dispatch() {} };
  const Log = load(compiledLog, {
    react: runtime.react,
    "react-native": { ...Object.fromEntries(["ActivityIndicator", "Image", "InputAccessoryView", "Pressable", "Text", "TextInput", "View"].map(key => [key, key])),
      Alert: { alert: (...args) => alerts.push(args) }, Linking: {}, Platform: { OS: "ios" }, Keyboard: { dismiss() {} }, StyleSheet: { create: value => value },
      useWindowDimensions: () => ({ fontScale: 1, width: 402, height: 874 }) },
    "react-native-reanimated": reanimatedStub,
    "@clerk/clerk-expo": { useAuth: () => ({ userId: owner, getToken: async () => "synthetic-token" }) },
    "expo-router": { useLocalSearchParams: () => ({}), useRouter: () => ({}) },
    "@react-navigation/native": { useNavigation: () => navigation, useFocusEffect: callback => { focus = callback; }, usePreventRemove() {} },
    "expo-constants": { expoConfig: { extra: {} } },
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@/hooks/useMealLogConnection": () => ({ connection: { state: "ready" }, refresh() {} }),
    "@/lib/mealLogPresentation.mjs": { canAnalyzeMeal, connectionPresentation, estimationTitle: () => "Sending…", NO_FOOD_DETECTED: { title: "No Food Detected" }, noFoodMessage: mode => `${mode} no food` },
    "@/hooks/usePageExit": () => () => { exits++; },
    "@/components/GlassForm": Object.fromEntries(["FormScreen", "FormScrollView", "FormHeader", "FormCard", "GlassButton"].map(key => [key, key])),
    "@/lib/chatgpt/phoneTestFixtures.mjs": { phoneTestNutritionLabel: "synthetic-photo" },
    "@/constants/formTheme": { FORM_COLORS: {} }, "@/constants/typography": { TYPOGRAPHY: {} },
    "@/constants/api": { FOOD_ENTRIES_API_URL: "https://test.invalid/meals" },
    "@/context/EntriesRefreshContext": { useRefreshSignal: () => ({ store: { belongsTo: id => id === owner }, setShouldRefresh() {} }) },
    "@/lib/chatgpt/planClient": { pickMealPhoto: async () => ({ dataURL: "synthetic-photo" }) },
    "@/lib/chatgpt/nutrition": { nutritionClient: async () => ({ model: "synthetic", client: { estimate: options => { requests.push(options); return service.analyze(options); } } }),
      estimateMacros: (...args) => service.estimate(...args), inferenceError: error => errors.push(error) },
    "@/components/MealReview": "MealReview",
    "@/context/FoodIconsContext": { useFoodIcons: () => ({ rememberIcons: async () => {} }) },
    "@/lib/mealTimeSettings": { mealTimePreferences: { load: async () => ({ Breakfast: 300, Lunch: 660, Dinner: 1020, Snack: 1320 }) } },
    "@/lib/mealTimes.mjs": { mealForLocalTime: () => "Lunch" },
    "@/lib/mealReview.mjs": { ...reviewModel, saveMealReview: async (draft, id, options) => { writes.push({ draft, id, options }); return draft.entries.map((entry, index) => ({ ...entry, id: index + 1 })); } },
    "@/lib/confirmedMealSave.mjs": { createConfirmedMealSave },
    "@/lib/utils": { getLocalTimeWithOffset: () => "2026-10-22T12:00:00-04:00" },
  });
  const Form = Log({ inputMode }).type;
  const render = () => { runtime.reset(); return Form({ inputMode }); };
  render(); cleanup = focus();
  return { render, requests, writes, alerts, errors, service, blur: () => cleanup(), focus: () => { render(); cleanup = focus(); },
    changeOwner: value => { owner = value; render(); }, exits: () => exits };
}
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

// These exercise the production screen's handlers with isolated network/storage
// boundaries, including asynchronous callbacks arriving after navigation.
test("a typed meal is analyzed as text, produces structured foods, and never saves on analysis", async () => {
  const fixture = logFixture(); let tree = fixture.render();
  assert.equal(button(tree, "Analyze Meal").props.disabled, true);
  assert.equal(input(tree, "Amount"), undefined);
  input(tree, "Meal description").props.onChangeText("Apple");
  fixture.service.analyze = async () => [food, { ...food, foodName: "Egg" }];
  tree = fixture.render(); await button(tree, "Analyze Meal").props.onPress();
  const request = fixture.requests[0];
  assert.equal(request.text, "Apple"); assert.equal(request.image, undefined);
  assert.equal(request.defaultMealType, "Lunch");
  const review = fixture.render(); assert.equal(review.type, "MealReview");
  assert.equal(review.props.review.entries.length, 2);
  assert.equal(fixture.writes.length, 0);
  await Promise.all([review.props.onSave("Dinner", review.props.review), review.props.onSave("Dinner", review.props.review)]);
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0].draft.mealType, "Dinner");
  assert.equal(fixture.exits(), 1);
});

test("photo input uses the same review flow with only the selected image", async () => {
  const fixture = logFixture("photo");
  assert.equal(button(fixture.render(), "Analyze Meal").props.disabled, true);
  await button(fixture.render(), "Photos").props.onPress();
  await button(fixture.render(), "Analyze Meal").props.onPress();
  assert.equal(fixture.requests[0].image, "synthetic-photo");
  assert.equal(fixture.requests[0].text, "");
  assert.equal(fixture.render().type, "MealReview");
  assert.equal(fixture.writes.length, 0);
});

test("rapid Analyze presses share the operation lock and a blurred request cannot publish a review", async () => {
  const fixture = logFixture(); const pending = defer();
  fixture.service.analyze = () => pending.promise;
  input(fixture.render(), "Meal description").props.onChangeText("Apple");
  const analyze = button(fixture.render(), "Analyze Meal").props.onPress;
  const work = analyze(); analyze(); await settle();
  assert.equal(fixture.requests.length, 1);
  fixture.blur(); assert.equal(fixture.requests[0].signal.aborted, true);
  pending.resolve([food]); await work;
  assert.notEqual(fixture.render().type, "MealReview");
  assert.equal(fixture.alerts.length, 0); assert.equal(fixture.writes.length, 0);
  fixture.focus(); assert.equal(input(fixture.render(), "Meal description").props.value, "Apple");
});

test("an owner change suppresses an old analysis and its errors", async () => {
  const fixture = logFixture(); const pending = defer(); fixture.service.analyze = () => pending.promise;
  input(fixture.render(), "Meal description").props.onChangeText("Apple");
  const work = button(fixture.render(), "Analyze Meal").props.onPress(); await settle();
  fixture.changeOwner("new-owner"); pending.reject(new Error("failed")); await work;
  assert.equal(fixture.errors.length, 0); assert.equal(fixture.writes.length, 0);
  assert.notEqual(fixture.render().type, "MealReview");
});

test("empty analysis retains the text and offers the text-specific no-food message", async () => {
  const fixture = logFixture(); fixture.service.analyze = async () => [];
  input(fixture.render(), "Meal description").props.onChangeText("hello");
  await button(fixture.render(), "Analyze Meal").props.onPress();
  assert.deepEqual(fixture.alerts[0], ["No Food Detected", "text no food"]);
  assert.equal(input(fixture.render(), "Meal description").props.value, "hello");
  assert.equal(fixture.writes.length, 0);
});

test("re-estimation updates only the selected food and keeps its icon", async () => {
  const fixture = logFixture(); input(fixture.render(), "Meal description").props.onChangeText("Rice");
  await button(fixture.render(), "Analyze Meal").props.onPress();
  let review = fixture.render();
  review.props.setReview(reviewModel.setReviewField(review.props.review, review.props.review.entries[0].id, "iconId", "sushi"));
  review = fixture.render(); await review.props.onReestimate(review.props.review.entries[0].id);
  const entry = fixture.render().props.review.entries[0];
  assert.equal(entry.calories, 180); assert.equal(entry.iconId, "sushi");
  assert.equal(fixture.writes.length, 0);
});
