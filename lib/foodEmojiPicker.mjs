import { FOOD_ICON_CATALOG } from "./foodIcons.mjs";

// Picker-only grouping. Catalog order still controls automatic food matching,
// and these existing IDs remain the values stored in a meal or preference.
const categoryIds = [
  ["meals", "Meals & sides", ["sandwich", "burger", "pizza", "taco", "burrito", "hot-dog", "sushi", "dumplings", "fried-rice", "noodles", "pasta", "curry", "salad", "soup", "fries", "sauce"]],
  ["fruit", "Fruit", ["banana", "apple", "orange", "berries", "strawberry", "grapes", "watermelon", "pineapple", "mango", "peach", "pear", "kiwi", "lemon", "avocado"]],
  ["vegetables", "Vegetables", ["broccoli", "greens", "carrot", "tomato", "cucumber", "sweet-potato", "potato", "corn", "mushroom"]],
  ["protein", "Protein & dairy", ["egg", "cheese", "yogurt", "tofu", "beans", "chicken", "meat", "bacon", "fish", "shrimp", "seafood"]],
  ["grains", "Grains & breakfast", ["pancakes", "oats", "bread", "croissant", "bagel", "rice"]],
  ["snacks", "Snacks & sweets", ["bar", "nuts", "cake", "pie", "cookie", "ice-cream", "chocolate", "doughnut"]],
  ["drinks", "Drinks", ["smoothie", "juice", "coffee", "tea", "milk", "water", "soda", "beer", "wine"]],
];
const iconsById = new Map(FOOD_ICON_CATALOG.map(icon => [icon.id, icon]));

export const FOOD_EMOJI_CATEGORIES = Object.freeze(categoryIds.map(([id, label, ids]) => Object.freeze({
  id,
  label,
  icons: Object.freeze(ids.map(iconId => iconsById.get(iconId))),
})));

function normalizeSearch(value) {
  return typeof value === "string" ? value.normalize("NFKC")
    .toLowerCase()
    .replace(/[\uFE0E\uFE0F]/gu, "")
    .replace(/[‐‑–—-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim() : "";
}
const searchText = new Map(FOOD_ICON_CATALOG.map(icon => [icon.id,
  normalizeSearch([icon.label, icon.emoji, ...icon.aliases].join(" ")),
]));

/** Search is global; choosing a category only filters unsearched browsing. */
export function getFoodEmojiSections(query = "", categoryId = "all") {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  const knownCategory = FOOD_EMOJI_CATEGORIES.some(category => category.id === categoryId);
  return FOOD_EMOJI_CATEGORIES
    .filter(category => terms.length > 0 || !knownCategory || category.id === categoryId)
    .map(category => ({ ...category, icons: category.icons.filter(icon =>
      terms.every(term => searchText.get(icon.id).includes(term))) }))
    .filter(category => category.icons.length);
}
