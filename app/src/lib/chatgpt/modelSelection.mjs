// Lightweight fallback policy, not a measured latency guarantee. Match families
// rather than exact versions. Keep aliases/ranking here when providers rename them.
const FAMILY_ORDER = Object.freeze(["luna", "terra", "sol", "astra"]);

function familyRank(name) {
  const words = typeof name === "string" ? name.toLowerCase().split(/[^a-z0-9]+/) : [];
  return FAMILY_ORDER.findIndex(family => words.includes(family));
}

function fallbackRank(model) {
  const slugRank = familyRank(model.slug);
  const rank = slugRank >= 0 ? slugRank : familyRank(model.display_name);
  return rank < 0 ? FAMILY_ORDER.length : rank;
}

// Always honor an available explicit choice. Do not mutate catalog order or
// persist the fallback: the user's preference may become available again.
export function selectNutritionModel(models, preferred) {
  const available = Array.isArray(models)
    ? models.filter(model => typeof model?.slug === "string" && model.slug.length > 0) : [];
  const selected = available.find(model => model.slug === preferred);
  if (selected) return selected.slug;
  let best;
  for (const model of available) {
    if (!best || fallbackRank(model) < fallbackRank(best)) best = model;
  }
  // Within a family, or when all names are unknown, retain server order.
  return best?.slug;
}
