/** localStorage cache for expensive AI GETs. Fail-open: storage errors and
 *  corrupt/expired entries are a miss, so private mode degrades to plain fetching. */
const PREFIX = "athena:cache:v1:";
export const DAY_MS = 24 * 60 * 60 * 1000;

interface Entry<T> { v: 1; expiresAt: number; data: T }

export function cacheGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return undefined;
    let entry: Entry<T>;
    try {
      entry = JSON.parse(raw) as Entry<T>;
    } catch {
      localStorage.removeItem(PREFIX + key);
      return undefined;
    }
    if (entry.v !== 1 || typeof entry.expiresAt !== "number" || Date.now() >= entry.expiresAt) {
      localStorage.removeItem(PREFIX + key);
      return undefined;
    }
    return entry.data;
  } catch {
    return undefined;
  }
}

export function cacheSet<T>(key: string, data: T, ttlMs: number = DAY_MS): void {
  try {
    const entry: Entry<T> = { v: 1, expiresAt: Date.now() + ttlMs, data };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch { /* storage unavailable or full — cache is best-effort */ }
}

export function cacheDelete(key: string): void {
  try { localStorage.removeItem(PREFIX + key); } catch { /* best-effort */ }
}
