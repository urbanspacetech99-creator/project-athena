import type { CompetitorPostRow, KeywordVolumeRow, OwnPostRow } from "../types";

interface Windowed { window_date: string }

/** Date-only key so windows compare stably regardless of time component. */
const day = (iso: string) => iso.slice(0, 10);

export function newestFirst<T extends Windowed>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    a.window_date < b.window_date ? 1 : a.window_date > b.window_date ? -1 : 0,
  );
}

/** Unique window days, ascending. */
function windowDays(rows: Windowed[]): string[] {
  return [...new Set(rows.map((r) => day(r.window_date)))].sort();
}

const pct = (cur: number, prev: number): number | null =>
  prev === 0 ? null : Math.round((100 * (cur - prev)) / prev);

export interface KpiDeltas {
  views: number | null; likes: number | null; interactions: number | null; posts: number | null;
}

/** Week-over-week deltas: compares the newest window against the window closest
    to 7 days earlier (5-9 day tolerance). Null when no ~week-apart window exists,
    so "vs last week" badges never compare adjacent daily snapshots. */
export function kpiDeltas(rows: OwnPostRow[]): KpiDeltas | null {
  const days = windowDays(rows);
  if (days.length < 2) return null;
  const curDay = days[days.length - 1];
  const curMs = Date.parse(curDay);
  const prevDay = days.slice(0, -1)
    .map((d) => ({ d, diff: (curMs - Date.parse(d)) / 86_400_000 }))
    .filter((x) => x.diff >= 5 && x.diff <= 9)
    .sort((a, b) => Math.abs(a.diff - 7) - Math.abs(b.diff - 7))[0]?.d;
  if (prevDay === undefined) return null;
  const sum = (d: string, f: (r: OwnPostRow) => number) =>
    rows.filter((r) => day(r.window_date) === d).reduce((acc, r) => acc + f(r), 0);
  return {
    views: pct(sum(curDay, (r) => r.views), sum(prevDay, (r) => r.views)),
    likes: pct(sum(curDay, (r) => r.likes), sum(prevDay, (r) => r.likes)),
    interactions: pct(sum(curDay, (r) => r.interactions), sum(prevDay, (r) => r.interactions)),
    posts: pct(sum(curDay, () => 1), sum(prevDay, () => 1)),
  };
}

export type KeywordChange = { kind: "pct"; pct: number } | { kind: "new" };

/** Per-keyword WoW change between the two most recent windows. Null if <2 windows. */
export function keywordChanges(rows: KeywordVolumeRow[]): Map<string, KeywordChange> | null {
  const days = windowDays(rows);
  if (days.length < 2) return null;
  const [prevDay, curDay] = days.slice(-2);
  const volume = (d: string) => new Map(
    rows.filter((r) => day(r.window_date) === d).map((r) => [r.keyword, r.weekly_search_volume]),
  );
  const prev = volume(prevDay);
  const out = new Map<string, KeywordChange>();
  for (const [keyword, vol] of volume(curDay)) {
    const p = prev.get(keyword);
    if ((p === undefined || p === 0) && vol > 0) out.set(keyword, { kind: "new" });
    else if (p !== undefined && p > 0) {
      const change = pct(vol, p);
      if (change !== null) out.set(keyword, { kind: "pct", pct: change });
    }
  }
  return out;
}

export interface CompetitorPlatformStat {
  postsTracked: number;
  lastActive: string | null;
  commentCount: number;
  recent: CompetitorPostRow[];
}

/** Per-platform stats for a single competitor's already-filtered posts. */
export function competitorPlatformStats(
  posts: CompetitorPostRow[], platform: string,
): CompetitorPlatformStat {
  const mine = newestFirst(posts.filter((p) => p.platform === platform));
  return {
    postsTracked: mine.length,
    lastActive: mine.length ? mine[0].window_date : null,
    commentCount: mine.reduce((a, p) => a + (p.comment_count ?? 0), 0),
    recent: mine.slice(0, 5),
  };
}
