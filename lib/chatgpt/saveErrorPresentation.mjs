// Describe write outcomes without retrying, navigating, or exposing server text.
// Positive/partial evidence wins over contradictory flags. Old callers without
// explicit outcome metadata remain conservative about a possible saved meal.
export function mealSaveErrorPresentation(error) {
  const message = error?.message || "";
  if (!/meal_save/.test(message)) return null;
  const partial = Array.isArray(error.savedEntries) && error.savedEntries.length > 0;
  const uncertain = partial || /meal_save_uncertain/.test(message)
    || error.mayHaveSaved === true || error.uncertain === true;
  const knownNonWrite = !uncertain && (error.mayHaveSaved === false || error.dispatched === false);
  if (knownNonWrite) return {
    kind: "failed", title: "Couldn’t save meal",
    message: error.timedOut
      ? "Saving took too long. Your meal was not saved. Please try again."
      : "Your meal was not saved. Please try again.",
  };
  return {
    kind: "uncertain", title: "Check your meals",
    message: "Some entries may already have been saved. Check your meals before trying again to avoid duplicates.",
  };
}
