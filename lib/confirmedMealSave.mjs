// A mounted draft's confirmed write is irreversible even when cache refresh or
// navigation fails afterward. This does not retry writes or add backend keys.
export function createConfirmedMealSave() {
  const confirmed = new Set();
  const pending = new Map();
  return {
    hasConfirmed: key => confirmed.has(key),
    run({ key, persist, onConfirmed, isCurrent = () => true, exit }) {
      if (confirmed.has(key)) return Promise.resolve({ kind: "already-confirmed" });
      if (pending.has(key)) return pending.get(key);
      const work = Promise.resolve().then(async () => {
        if (!isCurrent()) return { kind: "inactive" };
        await persist();
        // Record success before invoking any application callback. Failures
        // below cannot turn a successful POST/PUT into a retryable write.
        confirmed.add(key);
        try {
          await onConfirmed?.();
          if (!isCurrent()) return { kind: "confirmed-inactive" };
          await exit();
          return { kind: "left" };
        } catch {
          return { kind: "confirmed-staying" };
        }
      });
      const operation = work.finally(() => { if (pending.get(key) === operation) pending.delete(key); });
      pending.set(key, operation);
      return operation;
    },
  };
}
