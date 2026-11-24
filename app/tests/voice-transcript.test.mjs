import assert from "node:assert/strict";
import test from "node:test";
import { emptyTranscript, joinTranscript, transcriptReducer, transcriptText } from "../src/lib/voice/transcript.mjs";

// Feeds events through the reducer and returns the final state.
const play = (events, state = emptyTranscript()) => events.reduce(transcriptReducer, state);
const said = (text, isFinal = false) => ({ type: "result", text, isFinal });
const textOf = events => transcriptText(play(events));

test("Words before a pause stay when iOS starts the next phrase from empty", () => {
  // iOS 18+: a pause closes the phrase with a final result, later results hold only new words
  // (the library prefixes them with a space).
  assert.equal(textOf([
    said("Two"), said("Two eggs"), said("Two eggs", true),
    said(" and"), said(" and toast"),
  ]), "Two eggs and toast");
});

test("Several pauses keep every phrase in order", () => {
  assert.equal(textOf([
    said("Two eggs"), said("Two eggs", true),
    said(" a slice of toast"), said(" a slice of toast", true),
    said(" and a latte"), said(" and a latte", true),
    said(" with oat milk"),
  ]), "Two eggs a slice of toast and a latte with oat milk");
});

test("Interim words are revised in place, then replaced by the final phrase", () => {
  const state = play([said("to"), said("two eggs"), said("Two eggs and toast", true)]);
  assert.deepEqual(state.finals, ["Two eggs and toast"]);
  assert.equal(state.interim, "");
  assert.equal(transcriptText(state), "Two eggs and toast");
  // While speaking, only the latest interim is shown, never a pile of earlier guesses.
  assert.equal(textOf([said("Two eggs", true), said(" and"), said(" and to"), said(" and toast")]), "Two eggs and toast");
});

test("A result that re-emits earlier words only adds what is new", () => {
  // Older iOS, or a restarted task, may repeat everything heard so far.
  assert.equal(textOf([
    said("Two eggs", true),
    said("two eggs, and toast"), said("Two eggs and toast.", true),
  ]), "Two eggs and toast.");
  // The same finished phrase sent twice is kept once.
  assert.equal(textOf([said("Two eggs"), said("Two eggs", true), said("Two eggs", true)]), "Two eggs");
});

test("A phrase really said twice is kept twice", () => {
  assert.equal(textOf([said("An apple", true), said(" an apple"), said(" an apple", true)]), "An apple an apple");
});

test("An empty end-of-phrase marker closes the phrase so the next one can't replace it", () => {
  assert.equal(textOf([said("Two eggs"), said("", true), said(" and toast")]), "Two eggs and toast");
});

test("A new phrase without an end-of-phrase marker still keeps the earlier one", () => {
  assert.equal(textOf([said("A bowl of ramen"), said("and two"), said("and two gyoza")]), "A bowl of ramen and two gyoza");
  // Ordinary revisions that keep the start are not mistaken for a new phrase.
  assert.equal(textOf([said("Chicken burrito bowl with guac"), said("Chicken burrito bowl")]), "Chicken burrito bowl");
});

test("A no-speech error mid-session keeps everything said, and Resume adds to it", () => {
  const stopped = play([
    said("Greek yogurt", true), said(" with honey"),
    { type: "error", error: "no-speech" }, { type: "end" },
  ]);
  assert.equal(stopped.committed, "Greek yogurt with honey");
  assert.equal(transcriptText(stopped), "Greek yogurt with honey");
  const resumed = play([said("and granola"), said("and granola", true)], stopped);
  assert.equal(transcriptText(resumed), "Greek yogurt with honey and granola");
});

test("Pause, hand edit, then resume follows the edited words", () => {
  const paused = play([said("Two eggs", true), said(" and toast"), { type: "end" }]);
  const edited = transcriptReducer(paused, { type: "edit", text: "Three eggs and toast" });
  assert.equal(transcriptText(play([said("and jam", true)], edited)), "Three eggs and toast and jam");
});

test("Cancel clears everything", () => {
  const state = play([said("Two eggs", true), { type: "end" }, said(" and toast"), { type: "reset" }]);
  assert.deepEqual(state, emptyTranscript());
  assert.equal(transcriptText(state), "");
});

test("Chinese phrases join without spaces; English phrases with one", () => {
  assert.equal(textOf([said("两个鸡蛋", true), said("和一片吐司")]), "两个鸡蛋和一片吐司");
  assert.equal(joinTranscript("两个鸡蛋。", "一杯拿铁"), "两个鸡蛋。一杯拿铁");
  assert.equal(joinTranscript("两个鸡蛋", "and toast"), "两个鸡蛋 and toast");
  assert.equal(joinTranscript("two eggs ", " and toast"), "two eggs and toast");
});

test("Events that carry no words change nothing", () => {
  const state = play([said("Two eggs", true), said(""), { type: "start" }, { type: "error", error: "network" }]);
  assert.equal(transcriptText(state), "Two eggs");
});
