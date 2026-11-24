// The icon row on the Veggies and fruits card: one icon for every vegetable and fruit the card counts, most often
// first, so what the row shows always adds up to the number written above it. Two greens are two icons, even if
// they share one emoji, and produce with no emoji of its own gets a seedling rather than the takeout box that
// stands for an unknown meal. The row is one line: when it can't hold everything, it ends in a "+N" chip for the rest.

export const PRODUCE_FALLBACK = "🌱";
// The most the row ever holds, the chip included, however wide the card is.
export const PRODUCE_SLOTS = 7;

// The emoji for one vegetable or fruit, from the app's food icons (`iconFor`, as in FoodIconsContext).
export function produceEmoji(item, iconFor) {
  const icon = iconFor({ foodName: item.name });
  return !icon || icon.id === "meal" ? PRODUCE_FALLBACK : icon.emoji;
}

// Vegetables and fruits together, most often first, each keyed by its group so a name in both stays two items.
export function produceItems({ vegetables = [], fruits = [] }) {
  return [...vegetables.map((item) => ({ ...item, key: `vegetable:${item.id}` })), ...fruits.map((item) => ({ ...item, key: `fruit:${item.id}` }))]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// Which items get an icon in a row `width` wide, where each icon takes `slot` and they're `gap` apart, and how many
// are left for the chip, whose width for a given count is `chipWidth(count)`. `shown.length + more` is always every item.
export function produceRow(items, { width, slot, gap, chipWidth, slots = PRODUCE_SLOTS }) {
  const across = (count) => count * slot + Math.max(0, count - 1) * gap;
  if (items.length <= slots && across(items.length) <= width) return { shown: items, more: 0 };
  let fit = Math.min(items.length - 1, slots - 1);
  while (fit > 0 && across(fit) + gap + chipWidth(items.length - fit) > width) fit--;
  return { shown: items.slice(0, fit), more: items.length - fit };
}
