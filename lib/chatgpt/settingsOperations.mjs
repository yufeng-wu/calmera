// Only in-flight promises live here. This mutex never reads credentials or
// storage, and it deliberately outlives page focus/unmount. Provider and local
// persistence work cannot be cancelled just by hiding their result in the UI.
export function createSettingsOperations() {
  const pending = new Map();
  // Native authorization owns one process-wide callback listener. A different
  // account must not start a new Connect while an old listener is settling.
  let providerConnect = null;
  return {
    current: owner => providerConnect || pending.get(owner) || null,
    start(owner, kind, action) {
      if (providerConnect || pending.has(owner)) return null;
      const operation = { kind, promise: null };
      pending.set(owner, operation);
      if (kind === "connect") providerConnect = operation;
      operation.promise = Promise.resolve().then(action).finally(() => {
        if (pending.get(owner) === operation) pending.delete(owner);
        if (providerConnect === operation) providerConnect = null;
      });
      return operation;
    },
  };
}
