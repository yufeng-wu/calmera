// One small saved copy of Today and goals per account, so opening the app shows
// them before the network answers. Reads replace it, and sign-out removes it.
export function createTodayCache(storage) {
  const key = owner => `calmera.today.v1.${owner}`;
  return {
    async read(owner, date) {
      try {
        const saved = JSON.parse(await storage.getItem(key(owner)));
        if (!saved) return null;
        // Goals carry over to a new day, but yesterday's meals aren't today's.
        return { date, profile: saved.profile ?? null, day: saved.date === date ? saved.day ?? null : null };
      } catch { return null; }
    },
    write: (owner, value) => storage.setItem(key(owner), JSON.stringify(value)).catch(() => {}),
    clear: owner => storage.removeItem(key(owner)).catch(() => {}),
  };
}
