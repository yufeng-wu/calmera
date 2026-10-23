import { FOOD_ICON_CATALOG } from "./foodIcons.mjs";

// Picker-only grouping. Catalog order still controls automatic food matching,
// and these existing IDs remain the values stored in a meal or preference.
const categoryIds = [
  ["meals", "Handhelds & bites", ["sandwich", "baguette", "burger", "pizza", "taco", "burrito", "stuffed-flatbread", "tamale", "falafel", "hot-dog", "sushi", "kimbap", "rice-ball", "dumplings", "bao", "spring-rolls", "samosa", "tempura", "oden"]],
  ["bowls", "Bowls & plates", ["bibimbap", "poke", "salad", "bento", "fried-rice", "noodles", "pasta", "curry", "soup", "paella", "tteokbokki", "mapo-tofu", "fondue"]],
  ["sides", "Sides & pickles", ["kimchi", "radish-kimchi", "bean-sprouts", "pickles", "fries", "sauce"]],
  ["fruit", "Fruit", ["banana", "apple", "orange", "berries", "strawberry", "cherries", "grapes", "watermelon", "melon", "pineapple", "mango", "peach", "pear", "kiwi", "lemon", "coconut", "avocado", "olive"]],
  ["vegetables", "Vegetables", ["broccoli", "greens", "carrot", "tomato", "cucumber", "eggplant", "chili", "bell-pepper", "sweet-potato", "potato", "corn", "mushroom", "onion", "garlic", "ginger", "peas"]],
  ["protein", "Protein & dairy", ["fried-egg", "egg", "cheese", "butter", "yogurt", "tofu", "beans", "chicken", "meat", "meat-on-bone", "bacon", "fish", "shrimp", "squid", "crab", "seafood"]],
  ["grains", "Grains & breakfast", ["pancakes", "waffle", "oats", "bread", "flatbread", "croissant", "bagel", "rice"]],
  ["snacks", "Snacks & sweets", ["bar", "nuts", "chestnut", "pretzel", "rice-cracker", "popcorn", "cake", "cupcake", "mooncake", "pie", "custard", "cookie", "fortune-cookie", "ice-cream", "shaved-ice", "dango", "chocolate", "candy", "doughnut", "honey"]],
  ["drinks", "Drinks", ["bubble-tea", "smoothie", "juice", "coffee", "tea", "mate", "milk", "water", "soda", "beer", "wine", "champagne", "cocktail", "spirits", "sake"]],
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
  normalizeSearch([icon.label, icon.art ? "" : icon.emoji, ...icon.aliases].join(" ")),
]));

// Words match from their start ("tea" is not steak); Chinese and Korean, written
// without spaces, and emoji match anywhere.
const matchesTerm = (text, term) => /^[\p{L}\p{N}]/u.test(term) && !/[\p{Script=Han}\p{Script=Hangul}]/u.test(term)
  ? (" " + text).includes(" " + term) : text.includes(term);

/** Search is global; choosing a category only filters unsearched browsing. */
export function getFoodEmojiSections(query = "", categoryId = "all") {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  const knownCategory = FOOD_EMOJI_CATEGORIES.some(category => category.id === categoryId);
  return FOOD_EMOJI_CATEGORIES
    .filter(category => terms.length > 0 || !knownCategory || category.id === categoryId)
    .map(category => ({ ...category, icons: category.icons.filter(icon =>
      terms.every(term => matchesTerm(searchText.get(icon.id), term))) }))
    .filter(category => category.icons.length);
}
