import test from "node:test";
import assert from "node:assert/strict";
import { getFoodIcon } from "../lib/foodIcons.mjs";
import { PRODUCE_FALLBACK, PRODUCE_SLOTS, produceEmoji, produceItems, produceRow } from "../lib/insights/produce.mjs";

const iconFor = (entry) => getFoodIcon(entry.foodName);
const item = (name, count = 1) => ({ id: name.toLowerCase(), name, count });
const many = (count) => Array.from({ length: count }, (_, index) => item(`Veg ${String(index).padStart(2, "0")}`, count - index));
// The card on an iPhone 17 Pro (402 pt) and an iPhone SE (375 pt), at the default text size.
const PRO = { width: 402 - 76, slot: 30, gap: 10, chipWidth: (more) => Math.max(30, (String(more).length + 1) * 9 + 16) };
const SE = { ...PRO, width: 375 - 76 };
const used = ({ shown, more }, { slot, gap, chipWidth }) => shown.length * slot + Math.max(0, shown.length - 1) * gap + (more ? (shown.length ? gap : 0) + chipWidth(more) : 0);

test("every counted item is an icon or part of +N, and the row fits its card", () => {
  for (const layout of [PRO, SE, { ...SE, slot: 45, chipWidth: (more) => Math.max(45, Math.ceil((String(more).length + 1) * 13.5) + 16) }]) {
    for (let count = 0; count <= 40; count++) {
      const row = produceRow(many(count), layout);
      assert.equal(row.shown.length + row.more, count);
      assert.ok(row.shown.length + (row.more ? 1 : 0) <= PRODUCE_SLOTS);
      assert.ok(used(row, layout) <= layout.width, `${count} items overflow ${layout.width} pt`);
    }
  }
});

test("under, at and over the cap", () => {
  assert.deepEqual(produceRow(many(5), SE).more, 0);
  assert.equal(produceRow(many(PRODUCE_SLOTS), SE).shown.length, PRODUCE_SLOTS);
  assert.equal(produceRow(many(PRODUCE_SLOTS), SE).more, 0);
  const over = produceRow(many(PRODUCE_SLOTS + 1), SE);
  assert.deepEqual([over.shown.length, over.more], [PRODUCE_SLOTS - 1, 2]);
  assert.deepEqual(over.shown.map((entry) => entry.name), many(PRODUCE_SLOTS + 1).slice(0, PRODUCE_SLOTS - 1).map((entry) => entry.name));
});

test("greens that share an emoji each get an icon, and unmatched produce gets a seedling", () => {
  const items = produceItems({ vegetables: [item("Spinach", 3), item("Lettuce", 2), item("Celery", 1)], fruits: [item("Tomato", 1)] });
  assert.deepEqual(items.map((entry) => entry.name), ["Spinach", "Lettuce", "Celery", "Tomato"]);
  assert.deepEqual(items.map((entry) => produceEmoji(entry, iconFor)), ["🥬", "🥬", PRODUCE_FALLBACK, "🍅"]);
  assert.equal(new Set(produceItems({ vegetables: [item("Tomato")], fruits: [item("Tomato")] }).map((entry) => entry.key)).size, 2);
});
