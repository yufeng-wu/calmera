import { parseMeals, parseNutrition } from "../chatgpt/protocol.mjs";
import { mealInstructions, quantityPrompt } from "../chatgpt/prompts.mjs";

// The one place meals are estimated, whatever answers: a ChatGPT sign-in or a person's own key.
// `complete({ instructions, text, image, signal, onProgress })` returns the model's text; the
// prompts and parsing here are the same for every provider.
// search: the request can look things up online, so the instructions say when to.
export function createMealEstimator(complete, { search = false } = {}) {
  return {
    async estimate({ text = "", image, signal, defaultMealType = "Snack", onProgress }) {
      const instructions = mealInstructions(text, Boolean(image), defaultMealType, { search });
      return parseMeals(await complete({ instructions, text, image, signal, onProgress }));
    },
    async estimateQuantity({ foodName, quantity, signal }) {
      if (typeof foodName !== "string" || !foodName.trim() || foodName.length > 255 ||
          typeof quantity !== "string" || !quantity.trim() || quantity.length > 255) throw new Error("invalid_meal_text");
      const normalizedQuantity = /^\d+(?:\.\d+)?$/.test(quantity.trim()) ? `${quantity.trim()} counts` : quantity;
      const ask = async () => parseNutrition(await complete({ signal,
        text: `${foodName}, ${normalizedQuantity}`, instructions: quantityPrompt(foodName, normalizedQuantity) }));
      // Now and then a model answers in a shape with no numbers to read. Ask once more
      // before showing an error; it's only an estimate, so nothing is saved either way.
      let result;
      try { result = await ask(); } catch (error) {
        if (signal?.aborted || !(error?.message === "invalid_estimate" || error?.name === "SyntaxError")) throw error;
        result = await ask();
      }
      return { ...result, normalizedQuantity };
    },
  };
}
