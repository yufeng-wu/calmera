// Focus generations prevent a departed form's async completion from changing
// a newer screen, even if a provider ignores AbortSignal or resolves late.
export function createUiTaskScope() {
  let active = false;
  let generation = 0;
  let owner;
  const controllers = new Set();
  return {
    activate(nextOwner) { owner = nextOwner; active = true; generation += 1; },
    deactivate() { active = false; generation += 1; for (const c of controllers) c.abort(); controllers.clear(); },
    isActive: () => active,
    start() {
      if (!active) return null;
      const ticket = generation;
      const ticketOwner = owner;
      const controller = new AbortController();
      controllers.add(controller);
      return { signal: controller.signal,
        isCurrent: () => active && ticket === generation && ticketOwner === owner && !controller.signal.aborted,
        finish: () => controllers.delete(controller) };
    },
  };
}
