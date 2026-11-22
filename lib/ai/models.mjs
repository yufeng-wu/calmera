// The models a person's own API key runs, one per provider. Keep every model id here.
// OpenAI: gpt-6-luna is the model OpenAI's docs recommend for cost-sensitive, high-volume
// work; it reads images and answers through the Responses API (checked 2026-11-20).
// Anthropic: claude-haiku-5-5 reads images through the Messages API.
export const API_KEY_PROVIDERS = Object.freeze({
  anthropic: Object.freeze({
    id: "anthropic", name: "Claude", company: "Anthropic", model: "claude-haiku-5-5", modelName: "Haiku 5.5",
    host: "api.anthropic.com", keyPrefix: "sk-ant-",
  }),
  openai: Object.freeze({
    id: "openai", name: "OpenAI", company: "OpenAI", model: "gpt-6-luna", modelName: "Luna 6",
    host: "api.openai.com", keyPrefix: "sk-",
  }),
});

export const PROVIDER_IDS = Object.freeze(Object.keys(API_KEY_PROVIDERS));
export const ANTHROPIC_VERSION = "2026-10-21";
export const providerFor = id => (Object.prototype.hasOwnProperty.call(API_KEY_PROVIDERS, id) ? API_KEY_PROVIDERS[id] : null);
