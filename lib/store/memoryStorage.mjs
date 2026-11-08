// A stand-in for the iPhone's app storage, kept in memory, for previews and tests. It has the
// AsyncStorage methods the data module uses. `failWrites` makes that many writes reject
// (true for all of them); `delayMs` makes every call take that long.
export function createMemoryStorage(seed = {}, { failWrites = 0, delayMs = 0 } = {}) {
  const data = new Map(Object.entries(seed));
  let failuresLeft = failWrites === true ? Infinity : Number(failWrites) || 0;
  const pause = () => delayMs ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();
  const read = async (task) => { await pause(); return task(); };
  const write = async (task) => {
    await pause();
    if (failuresLeft > 0) { failuresLeft -= 1; throw new Error("storage_write_failed"); }
    task();
  };
  return {
    data,
    getItem: (key) => read(() => data.has(key) ? data.get(key) : null),
    multiGet: (keys) => read(() => keys.map((key) => [key, data.has(key) ? data.get(key) : null])),
    getAllKeys: () => read(() => [...data.keys()]),
    setItem: (key, value) => write(() => data.set(key, String(value))),
    multiSet: (pairs) => write(() => pairs.forEach(([key, value]) => data.set(key, String(value)))),
    removeItem: (key) => write(() => data.delete(key)),
    multiRemove: (keys) => write(() => keys.forEach((key) => data.delete(key))),
  };
}
