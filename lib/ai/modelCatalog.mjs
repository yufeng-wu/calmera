import { providerFor } from "./models.mjs";

// The models a person can pick, the same shape for every connection: { id, name, detail }, the
// recommended one first, the rest newest first. Lists come live from the provider; when that
// fails, these built-in ones stand in. Ids and order checked 2026-11-21 against Anthropic's and
// OpenAI's model pages.
export const FALLBACK_MODELS = Object.freeze({
  anthropic: Object.freeze([
    { id: "claude-haiku-5-5", name: "Claude Haiku 5.5" },
    { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" },
    { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
  ]),
  openai: Object.freeze([
    { id: "gpt-6-luna", name: "GPT-6 Luna" },
    { id: "gpt-6.1-terra", name: "GPT-6.1 Terra" },
    { id: "gpt-6.2-sol", name: "GPT-6.2 Sol" },
    { id: "gpt-6.2-astra", name: "GPT-6.2 Astra" },
  ]),
});
export const AUTOMATIC = "auto";

// What a model is like, in plain words, by family. Only the newest of each family gets them.
const FAMILIES = Object.freeze({
  anthropic: [["haiku", "Fastest and cheapest"], ["sonnet", "Balanced: more careful, still quick"],
    ["opus", "Most careful. Slower and pricier"], ["fable", "Most capable. Slowest and priciest"], ["mythos", "Most capable. Slowest and priciest"]],
  openai: [["luna", "Fastest and cheapest"], ["terra", "Quick and inexpensive"], ["sol", "Balanced: careful at a fair price"],
    ["astra", "Most capable. Slowest and priciest"], ["pro", "Most thorough. Slowest and priciest"], ["nano", "Smallest and fastest"], ["mini", "Small and quick"]],
});
const words = id => String(id || "").toLowerCase().split(/[^a-z0-9]+/);
const familyOf = (provider, id) => (FAMILIES[provider] || []).find(([word]) => words(id).includes(word))?.[0] || null;
const describe = (provider, id) => (FAMILIES[provider] || []).find(([word]) => words(id).includes(word))?.[1] || null;
const cap = word => word.charAt(0).toUpperCase() + word.slice(1);

// A name for an id the provider gave no name for: "gpt-6.2-sol" is "GPT-6.2 Sol".
export function modelName(provider, id) {
  const known = FALLBACK_MODELS[provider]?.find(model => model.id === id);
  if (known) return known.name;
  if (typeof id !== "string" || !id) return "";
  const claude = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(id);
  if (claude) return `Claude ${cap(claude[1])} ${claude[2]}${claude[3] ? `.${claude[3]}` : ""}`;
  const gpt = /^(gpt|chatgpt)-(\d+(?:\.\d+)?[a-z]?)(.*)$/.exec(id);
  if (!gpt) return id;
  const date = /-(\d{4}-\d{2}-\d{2})$/.exec(gpt[3]);
  const rest = (date ? gpt[3].slice(0, -11) : gpt[3]).split("-").filter(Boolean)
    .map(word => (["luna", "terra", "sol", "astra"].includes(word) ? cap(word) : word));
  return [`${gpt[1] === "gpt" ? "GPT" : "ChatGPT"}-${gpt[2]}`, ...rest].join(" ") + (date ? ` (${date[1]})` : "");
}

// Anthropic reports what each model can do; one that can't read photos can't log a meal photo.
export function anthropicModels(data) {
  return (Array.isArray(data) ? data : []).filter(model => typeof model?.id === "string" && /^[\w.:-]{1,200}$/.test(model.id)
    && model.capabilities?.image_input?.supported !== false)
    .map(model => ({ id: model.id, name: typeof model.display_name === "string" && model.display_name.trim() ? model.display_name.trim() : modelName("anthropic", model.id),
      created: Date.parse(model.created_at) || 0, effort: model.capabilities ? Boolean(model.capabilities.effort?.low?.supported) : undefined,
      search: model.capabilities ? Boolean(model.capabilities.server_tools?.web_search?.supported) : undefined }))
    .sort((a, b) => b.created - a.created);
}

// OpenAI's list says nothing about what a model can do, so models built for something else
// (embeddings, speech, images, moderation, search-only, open-weight text-only) are left out by
// name. Anything else that turns out not to work is caught when a meal is sent.
const OPENAI_FOR_MEALS = /^(gpt-|o\d|chatgpt-)/;
const OPENAI_NOT_FOR_MEALS = /(embed|whisper|tts|dall-e|image|moderation|audio|realtime|transcri|search|babbage|davinci|instruct|computer-use|sora|codex|deep-research|gpt-oss|^gpt-3\.5|^gpt-4(-\d{4}|-32k|-turbo-preview|-\d{4}-preview|-vision-preview)?$|^gpt-4-\d{4})/;
export function openaiModels(data) {
  return (Array.isArray(data) ? data : []).filter(model => typeof model?.id === "string" && /^[\w.:-]{1,200}$/.test(model.id)
    && OPENAI_FOR_MEALS.test(model.id) && !OPENAI_NOT_FOR_MEALS.test(model.id))
    .map(model => ({ id: model.id, name: modelName("openai", model.id), created: Number(model.created) || 0 }))
    .sort((a, b) => b.created - a.created);
}

// Plain words on each: the recommended one says so; the newest of a family says what it's like;
// older ones say they're older.
function withDetails(provider, models, recommended) {
  const newest = new Map();
  for (const model of models) {
    const family = familyOf(provider, model.id) || "other";
    if (!newest.has(family)) newest.set(family, model.id);
  }
  return models.map(model => {
    const family = familyOf(provider, model.id) || "other";
    const plain = newest.get(family) === model.id ? describe(provider, model.id) : "Earlier version";
    return { id: model.id, name: model.name,
      detail: model.id === recommended ? [plain, "Recommended"].filter(Boolean).join(" · ") : plain,
      ...(model.effort !== undefined ? { effort: model.effort } : {}), ...(model.search !== undefined ? { search: model.search } : {}) };
  });
}

// A key's models: listed (from anthropicModels/openaiModels) or null when the list couldn't be
// fetched. saved: the person's choice, or null for the recommended one.
export function keyModels(provider, listed, saved) {
  const recommended = providerFor(provider)?.model;
  const fallback = !listed?.length;
  let models = (fallback ? FALLBACK_MODELS[provider] || [] : listed).map(model => ({ ...model }));
  if (recommended && !models.some(model => model.id === recommended)) models.unshift({ id: recommended, name: modelName(provider, recommended) });
  if (saved?.id && !models.some(model => model.id === saved.id)) models.push({ id: saved.id, name: saved.name || modelName(provider, saved.id) });
  models = withDetails(provider, models, recommended);
  const first = models.find(model => model.id === recommended);
  return { provider, recommended, selected: saved?.id || recommended, fromFallback: fallback,
    models: [first, ...models.filter(model => model !== first)].filter(Boolean) };
}

// ChatGPT's models, from the catalog its sign-in can use. Automatic stays recommended.
export function chatgptModels(details) {
  const choices = Array.isArray(details?.choices) ? details.choices.filter(item => typeof item?.slug === "string" && item.slug) : [];
  const preferred = typeof details?.preferred === "string" && details.preferred ? details.preferred : null;
  const listed = choices.map(item => ({ id: item.slug, name: (typeof item.display_name === "string" && item.display_name.trim()) || modelName("openai", item.slug) }));
  // A saved model the account no longer offers falls back to Automatic, as logging does; with no
  // catalog at all, the saved one is shown as it is.
  if (preferred && !choices.length) listed.push({ id: preferred, name: modelName("openai", preferred) });
  const models = [{ id: AUTOMATIC, name: "Automatic", detail: "Picked for you · Recommended" }, ...withDetails("openai", listed, null)];
  return { provider: "chatgpt", recommended: AUTOMATIC, fromFallback: false, issue: details?.issue || null,
    selected: preferred && models.some(model => model.id === preferred) ? preferred : AUTOMATIC, models };
}

// What the model row shows: the chosen model's name.
export function selectedName(catalog) {
  return catalog?.models?.find(model => model.id === catalog.selected)?.name || null;
}
