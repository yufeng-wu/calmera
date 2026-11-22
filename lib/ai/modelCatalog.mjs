import { providerFor } from "./models.mjs";

// The models a person can pick, the same shape for every connection: { id, name }, newest first,
// with no model singled out. One is chosen to begin with (the provider's default in models.mjs,
// or Automatic for ChatGPT) so logging always works; it is simply the one with the check.
// Lists come live from the provider; when that fails, these built-in ones stand in. Ids and
// order checked 2026-11-21 against Anthropic's and OpenAI's model pages.
export const FALLBACK_MODELS = Object.freeze({
  anthropic: Object.freeze([
    { id: "claude-opus-5-5", name: "Opus 5.5" },
    { id: "claude-sonnet-5-5", name: "Sonnet 5.5" },
    { id: "claude-haiku-5-5", name: "Haiku 5.5" },
  ]),
  openai: Object.freeze([
    { id: "gpt-6.2-astra", name: "Astra 6.2" },
    { id: "gpt-6.2-sol", name: "Sol 6.2" },
    { id: "gpt-6.1-terra", name: "Terra 6.1" },
    { id: "gpt-6-luna", name: "Luna 6" },
  ]),
});
export const AUTOMATIC = "auto";

const cap = word => word.charAt(0).toUpperCase() + word.slice(1);

// Model names without the maker's name, which every place they appear already says: "Fable 5.2"
// rather than "Claude Fable 5.2", "Sol 6.2" rather than "GPT-6.2 Sol". A name with no family
// word ("GPT-5.4 mini") keeps its GPT, since the number alone would say nothing.
const NAMED = ["luna", "terra", "sol", "astra"];
export function shortName(name) {
  if (typeof name !== "string") return "";
  const trimmed = name.trim().replace(/\s+/g, " ");
  const oldClaude = /^Claude (\d+(?:\.\d+)?) ([A-Za-z]+)$/.exec(trimmed);
  if (oldClaude) return `${oldClaude[2]} ${oldClaude[1]}`;
  const claude = /^Claude (.+)$/.exec(trimmed);
  if (claude) return claude[1];
  const gpt = /^GPT-(\d+(?:\.\d+)?) (Luna|Terra|Sol|Astra)\b ?(.*)$/i.exec(trimmed);
  if (gpt) return [cap(gpt[2].toLowerCase()), gpt[1], gpt[3]].filter(Boolean).join(" ");
  return trimmed;
}

// A name for an id the provider gave no name for: "gpt-6.2-sol" is "Sol 6.2".
export function modelName(provider, id) {
  const known = FALLBACK_MODELS[provider]?.find(model => model.id === id);
  if (known) return known.name;
  if (typeof id !== "string" || !id) return "";
  const claude = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(id);
  if (claude) return `${cap(claude[1])} ${claude[2]}${claude[3] ? `.${claude[3]}` : ""}`;
  const gpt = /^(gpt|chatgpt)-(\d+(?:\.\d+)?[a-z]?)(.*)$/.exec(id);
  if (!gpt) return id;
  const date = /-(\d{4}-\d{2}-\d{2})$/.exec(gpt[3]);
  const words = (date ? gpt[3].slice(0, -11) : gpt[3]).split("-").filter(Boolean);
  const family = gpt[1] === "gpt" ? words.find(word => NAMED.includes(word)) : null;
  const rest = words.filter(word => word !== family);
  const named = family ? [cap(family), gpt[2], ...rest] : [`${gpt[1] === "gpt" ? "GPT" : "ChatGPT"}-${gpt[2]}`, ...rest];
  return named.join(" ") + (date ? ` (${date[1]})` : "");
}

// Anthropic reports what each model can do; one that can't read photos can't log a meal photo.
export function anthropicModels(data) {
  return (Array.isArray(data) ? data : []).filter(model => typeof model?.id === "string" && /^[\w.:-]{1,200}$/.test(model.id)
    && model.capabilities?.image_input?.supported !== false)
    .map(model => ({ id: model.id, name: shortName(model.display_name) || modelName("anthropic", model.id),
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

// A key's models: listed (from anthropicModels/openaiModels, newest first) or null when the list
// couldn't be fetched. saved: the person's choice, or null for the default.
const plain = ({ id, name, effort, search }) => ({ id, name, ...(effort !== undefined ? { effort } : {}), ...(search !== undefined ? { search } : {}) });
export function keyModels(provider, listed, saved) {
  const defaultModel = providerFor(provider)?.model;
  const fallback = !listed?.length;
  const models = (fallback ? FALLBACK_MODELS[provider] || [] : listed).map(plain);
  // A default or a saved choice the list leaves out still shows, at the end, so its check does.
  if (defaultModel && !models.some(model => model.id === defaultModel)) models.push({ id: defaultModel, name: modelName(provider, defaultModel) });
  if (saved?.id && !models.some(model => model.id === saved.id)) models.push({ id: saved.id, name: shortName(saved.name) || modelName(provider, saved.id) });
  return { provider, defaultModel, selected: saved?.id || defaultModel, fromFallback: fallback, models };
}

// ChatGPT's models, from the catalog its sign-in can use, after ChatGPT's own Automatic.
export function chatgptModels(details) {
  const choices = Array.isArray(details?.choices) ? details.choices.filter(item => typeof item?.slug === "string" && item.slug) : [];
  const preferred = typeof details?.preferred === "string" && details.preferred ? details.preferred : null;
  const listed = choices.map(item => ({ id: item.slug, name: shortName(item.display_name) || modelName("openai", item.slug) }));
  // A saved model the account no longer offers falls back to Automatic, as logging does; with no
  // catalog at all, the saved one is shown as it is.
  if (preferred && !choices.length) listed.push({ id: preferred, name: modelName("openai", preferred) });
  const models = [{ id: AUTOMATIC, name: "Automatic" }, ...listed];
  return { provider: "chatgpt", defaultModel: AUTOMATIC, fromFallback: false, issue: details?.issue || null,
    selected: preferred && models.some(model => model.id === preferred) ? preferred : AUTOMATIC, models };
}

// What the model row shows: the chosen model's name.
export function selectedName(catalog) {
  return catalog?.models?.find(model => model.id === catalog.selected)?.name || null;
}
