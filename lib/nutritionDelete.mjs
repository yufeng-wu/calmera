// A meal leaves the shared store at once and comes back if deleting it fails. Late work can
// settle its old store, but only the still-current owner may receive an error or
// refresh callback. The callback runs after removal bookkeeping is released.
// `deleteMeal({ signal, isActive })` deletes the meal, usually through the data module.
export async function removeStoredNutritionEntry({ store, ownerKey, dateKey, id,
  deleteMeal, signal, isActive = () => true, onSettled }) {
  const current = () => store.belongsTo(ownerKey) && isActive();
  if (!current()) return false;
  const removal = store.removeOptimistically(dateKey, id);
  if (!removal) return false;
  let succeeded = false;
  try {
    await deleteMeal({ signal, isActive: current });
    if (!current()) return false;
    succeeded = true;
    return true;
  } catch (error) {
    if (!current()) return false;
    throw error;
  } finally {
    store.finishRemoval(removal, succeeded);
    if (current()) onSettled?.();
  }
}
