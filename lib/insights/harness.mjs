// The insights harness: a locked core the user can read but not change, plus
// their own instructions appended after it. Their text can never replace the core.
import { FOCUS } from "./digest.mjs";

export const CORE_RULES = `You are calmera's nutrition analyst. You read one person's food log summary (and Apple Health activity, when present) and tell them, briefly, how they are eating relative to their own goals.
Always:
- Judge against this person's stated focus and goals, never against an average person.
- Lead with a verdict. Mention at most two things, the ones that matter most for their focus.
- Be warm, concrete and short. Suggest small swaps, not rules.
- Treat the numbers as estimates from photo and voice logs.
Never:
- Suggest eating under 1200 kcal a day, skipping meals to lose weight, or fasting regimes.
- Use guilt words such as "bad food", "cheat", "junk", "earn", or "burn off".
- Give medical diagnoses or supplement doses. If the person mentions dizziness, fainting, bingeing, purging or fear of food, kindly suggest talking to a doctor or a registered dietitian.`;

export const DEFAULT_PREFS = { focus: "balanced", tone: "gentle", notes: "", chatModel: null, effort: "medium", webSearch: true };
export const EFFORTS = { low: "Light", medium: "Medium", high: "Deep" };

export const TONES = {
  gentle: "Encouraging, like a friendly coach.",
  direct: "Straight to the point, no cushioning, still kind.",
};

const REPORT_FORMAT = `Reply with JSON only, no markdown:
{"verdict":"keep"|"tweak"|"watch","headline":"max 8 words","summary":"one or two sentences tied to their focus","tips":[{"title":"max 6 words","why":"one sentence on why it matters for their focus"}]}
Use "keep" when they are doing well, "tweak" for one or two small changes, "watch" when a habit is clearly working against their focus. Give zero to two tips.`;

export function instructions(prefs = DEFAULT_PREFS, context, { report = false, webSearch = false } = {}) {
  return [
    CORE_RULES,
    `Tone: ${TONES[prefs.tone] || TONES.gentle}`,
    `Their focus: ${FOCUS[prefs.focus]?.label || FOCUS.balanced.label}.`,
    prefs.notes?.trim() ? `Instructions from the person (follow unless they conflict with the rules above):\n${prefs.notes.trim().slice(0, 2000)}` : "",
    `Their data:\n${context}`,
    context.includes("## Full food log") ? "Use the summaries for overall questions. For anything they don't cover (a specific food, day, meal, or longer trend), work it out from the full food log and say briefly how you counted." : "",
    webSearch ? "For questions about nutrition science or trends, search the web for current evidence and name your sources in a few words. Use their data above for anything about them." : "",
    report ? REPORT_FORMAT : "Answer in at most 150 words unless they ask for more. Match the language the person writes in.",
  ].filter(Boolean).join("\n\n");
}

export function parseInsight(text) {
  const value = JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  if (!["keep", "tweak", "watch"].includes(value.verdict) || typeof value.headline !== "string") throw new Error("invalid_insight");
  return {
    verdict: value.verdict, headline: value.headline.slice(0, 80), summary: String(value.summary || "").slice(0, 280),
    tips: (Array.isArray(value.tips) ? value.tips : []).slice(0, 2)
      .filter((tip) => typeof tip?.title === "string").map((tip) => ({ title: tip.title.slice(0, 60), why: String(tip.why || "").slice(0, 200) })),
  };
}

// Rules-only verdict for when ChatGPT is not connected, and the instant first paint.
const CHECKS = [
  { id: "protein", test: (d) => d.proteinRatio != null && d.proteinRatio < 0.85,
    weight: { muscle: 3, energy: 2, lighter: 2, balanced: 1 },
    tip: (d) => ({ title: "Add protein to one meal", why: `You're averaging ${d.average.protein} g, about ${Math.round(d.proteinRatio * 100)}% of your goal.` }) },
  { id: "veg", test: (d) => d.groups.veg < 5,
    weight: { balanced: 3, energy: 2, lighter: 2, muscle: 1 },
    tip: (d) => ({ title: "One more veggie a day", why: `Vegetables showed up ${d.groups.veg} times this week. Fibre keeps you full and steady.` }) },
  { id: "breakfast", test: (d) => d.breakfastDays < d.daysLogged * 0.6,
    weight: { energy: 3, balanced: 1, lighter: 1, muscle: 1 },
    tip: (d) => ({ title: "Try a quick breakfast", why: `You ate breakfast on ${d.breakfastDays} of ${d.daysLogged} days; mornings without it often mean a slump later.` }) },
  { id: "sweets", test: (d) => d.groups.sweets >= 4,
    weight: { energy: 3, lighter: 2, balanced: 2, muscle: 1 },
    tip: (d) => ({ title: "Swap one sweet drink", why: `Sweets or sugary drinks came up ${d.groups.sweets} times; sugar highs end in energy dips.` }) },
  { id: "late", test: (d) => d.lateDays >= 2,
    weight: { energy: 2, lighter: 2, balanced: 1, muscle: 0 },
    tip: (d) => ({ title: "Wrap up eating earlier", why: `You ate after 21:30 on ${d.lateDays} days, which can affect sleep and next-day energy.` }) },
  { id: "over", test: (d) => d.calorieRatio != null && d.calorieRatio > 1.12,
    weight: { lighter: 3, balanced: 1, energy: 1, muscle: 0 },
    tip: (d) => ({ title: "Trim portions slightly", why: `You're about ${Math.round((d.calorieRatio - 1) * 100)}% above your calorie goal on average.` }) },
  { id: "under", test: (d) => d.calorieRatio != null && d.calorieRatio < 0.8,
    weight: { muscle: 3, energy: 3, balanced: 2, lighter: 1 },
    tip: (d) => ({ title: "Eat a bit more", why: `You're averaging ${d.average.calories} kcal, well under your goal; too little fuel drains energy.` }) },
  { id: "weekend", test: (d) => d.weekendCalories && d.weekdayCalories && d.weekendCalories > d.weekdayCalories * 1.25,
    weight: { lighter: 2, balanced: 1, energy: 0, muscle: 0 },
    tip: (d) => ({ title: "Plan one weekend meal", why: `Weekends average ${d.weekendCalories} kcal versus ${d.weekdayCalories} on weekdays.` }) },
  { id: "variety", test: (d) => d.distinctFoods < 8,
    weight: { balanced: 2, energy: 1, muscle: 1, lighter: 1 },
    tip: (d) => ({ title: "Mix up your foods", why: `You ate ${d.distinctFoods} different foods; variety covers more vitamins and minerals.` }) },
];

function strength(digest) {
  if (digest.proteinRatio >= 0.95) return "protein is right where you want it";
  if (digest.groups.veg >= 7) return "you're eating plenty of vegetables";
  if (digest.calorieOnTrackDays >= 4) return `calories were on track ${digest.calorieOnTrackDays} days`;
  if (digest.breakfastDays >= digest.daysLogged * 0.8) return "your breakfasts are consistent";
  return `you logged ${digest.daysLogged} days`;
}

export function localInsight(digest, prefs = DEFAULT_PREFS) {
  if (digest.daysLogged < 3) {
    return { verdict: "start", headline: "Log a few more days", tips: [],
      summary: `You have ${digest.daysLogged} day${digest.daysLogged === 1 ? "" : "s"} this week. After three, calmera can tell you how you're doing.` };
  }
  const focus = prefs.focus in FOCUS ? prefs.focus : "balanced";
  const hits = CHECKS.filter((check) => check.weight[focus] >= 2 && check.test(digest))
    .sort((a, b) => b.weight[focus] - a.weight[focus]);
  const good = strength(digest);
  if (!hits.length) {
    return { verdict: "keep", headline: "You're eating well, keep it up", tips: [],
      summary: `For ${FOCUS[focus].label.toLowerCase()}, this week looks solid: ${good}.` };
  }
  const verdict = hits.length >= 3 ? "watch" : "tweak";
  return {
    verdict,
    headline: verdict === "watch" ? "A few habits are working against you" : hits.length === 1 ? "Solid week, one small tweak" : "Good base, two small tweaks",
    summary: `Nice: ${good}. For ${FOCUS[focus].label.toLowerCase()}, ${hits.length === 1 ? "this is the change" : "these are the changes"} that would help most.`,
    tips: hits.slice(0, 2).map((check) => ({ id: check.id, ...check.tip(digest) })),
  };
}

export const VERDICTS = {
  keep: { label: "On track", color: "#2F7A45" },
  tweak: { label: "Small adjustments", color: "#A26A00" },
  watch: { label: "Needs attention", color: "#B5541A" },
  start: { label: "Not enough data", color: "#78685E" },
};

export const STARTERS = [
  "Is my diet balanced?",
  "Any obvious diet habit to improve?",
  "What are the noticeable trends?",
]

// Offline stand-in so the chat can be tried before ChatGPT is connected.
export function previewReply(question, digest, prefs = DEFAULT_PREFS) {
  const insight = localInsight(digest, prefs);
  const tip = insight.tips[0];
  if (/energy|tired|精力|累/i.test(question)) {
    return `For steadier energy: you ate breakfast on ${digest.breakfastDays} of ${digest.daysLogged} days and had ${digest.groups.sweets} sweet items. Start the day with protein plus fibre (eggs and toast, or yogurt and fruit) and swap one sweet drink for sparkling water.`;
  }
  if (/nutrient|enough|营养|够/i.test(question)) {
    return `Mostly yes on the basics: protein averages ${digest.average.protein} g. The gap is variety: ${digest.groups.veg} vegetable and ${digest.groups.fruit} fruit entries across ${digest.distinctFoods} different foods. Adding one colourful vegetable a day would cover far more vitamins.`;
  }
  return tip ? `${tip.title}. ${tip.why} Small, repeatable changes beat big overhauls.`
    : `${insight.summary} Keep doing what you're doing.`;
}
