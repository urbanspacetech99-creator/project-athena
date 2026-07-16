import { expect, test } from "vitest";
import {
  competitorPlatformStats, keywordChanges, kpiDeltas, newestFirst,
} from "../lib/derive";
import { fmt } from "../lib/fmt";
import type { CompetitorPostRow, KeywordVolumeRow, OwnPostRow } from "../types";

const own = (o: Partial<OwnPostRow>): OwnPostRow => ({
  id: 1, source_id: "s", platform: "instagram", title: "", content: "",
  views: 0, likes: 0, interactions: 0, window_date: "2026-07-01T00:00:00Z", ...o,
});
const kw = (o: Partial<KeywordVolumeRow>): KeywordVolumeRow => ({
  id: 1, source_id: "s", keyword: "k", weekly_search_volume: 0,
  window_date: "2026-07-01T00:00:00Z", ...o,
});

test("fmt: thousands get a k suffix", () => {
  expect(fmt(11800)).toBe("11.8k");
  expect(fmt(1000)).toBe("1k");
  expect(fmt(950)).toBe("950");
});

test("fmt: millions get an M suffix", () => {
  expect(fmt(1_000_000)).toBe("1M");
  expect(fmt(2_500_000)).toBe("2.5M");
});

test("newestFirst sorts by window_date descending", () => {
  const rows = [own({ id: 1, window_date: "2026-07-01T00:00:00Z" }),
                own({ id: 2, window_date: "2026-07-08T00:00:00Z" })];
  expect(newestFirst(rows)[0].id).toBe(2);
});

test("kpiDeltas: null with fewer than two windows", () => {
  expect(kpiDeltas([own({})])).toBeNull();
  expect(kpiDeltas([])).toBeNull();
});

test("kpiDeltas compares the newest window against the week-earlier window", () => {
  const rows = [
    own({ views: 100, likes: 10, interactions: 5, window_date: "2026-07-01T00:00:00Z" }),
    own({ views: 150, likes: 5, interactions: 5, window_date: "2026-07-08T00:00:00Z" }),
  ];
  const d = kpiDeltas(rows)!;
  expect(d.views).toBe(50);        // +50%
  expect(d.likes).toBe(-50);       // -50%
  expect(d.interactions).toBe(0);
  expect(d.posts).toBe(0);         // 1 post each window
});

test("kpiDeltas: null pct when previous window total is 0", () => {
  const rows = [
    own({ views: 0, window_date: "2026-07-01T00:00:00Z" }),
    own({ views: 80, window_date: "2026-07-08T00:00:00Z" }),
  ];
  expect(kpiDeltas(rows)!.views).toBeNull();
});

test("kpiDeltas: null when the only other window is an adjacent daily snapshot", () => {
  const rows = [
    own({ views: 100, window_date: "2026-07-07T00:00:00Z" }),
    own({ views: 150, window_date: "2026-07-08T00:00:00Z" }),
  ];
  expect(kpiDeltas(rows)).toBeNull();
});

test("kpiDeltas picks the window closest to 7 days back, skipping daily neighbours", () => {
  const rows = [
    own({ views: 100, window_date: "2026-07-01T00:00:00Z" }),
    own({ views: 999, window_date: "2026-07-07T00:00:00Z" }),
    own({ views: 150, window_date: "2026-07-08T00:00:00Z" }),
  ];
  expect(kpiDeltas(rows)!.views).toBe(50); // 07-08 vs 07-01, not vs 07-07
});

test("keywordChanges: zero previous volume counts as a first appearance", () => {
  const rows = [
    kw({ keyword: "surge", weekly_search_volume: 0, window_date: "2026-07-01T00:00:00Z" }),
    kw({ keyword: "surge", weekly_search_volume: 100, window_date: "2026-07-08T00:00:00Z" }),
  ];
  expect(keywordChanges(rows)!.get("surge")).toEqual({ kind: "new" });
});

test("keywordChanges: pct for persisting keywords, new tag for first appearance, null with one window", () => {
  expect(keywordChanges([kw({})])).toBeNull();
  const rows = [
    kw({ keyword: "storage", weekly_search_volume: 100, window_date: "2026-07-01T00:00:00Z" }),
    kw({ keyword: "storage", weekly_search_volume: 141, window_date: "2026-07-08T00:00:00Z" }),
    kw({ keyword: "fulfilment", weekly_search_volume: 50, window_date: "2026-07-08T00:00:00Z" }),
  ];
  const ch = keywordChanges(rows)!;
  expect(ch.get("storage")).toEqual({ kind: "pct", pct: 41 });
  expect(ch.get("fulfilment")).toEqual({ kind: "new" });
});

test("keywordChanges: dead 0-to-0 keyword is omitted, not NEW", () => {
  const rows = [
    kw({ keyword: "dead", weekly_search_volume: 0, window_date: "2026-07-01T00:00:00Z" }),
    kw({ keyword: "dead", weekly_search_volume: 0, window_date: "2026-07-08T00:00:00Z" }),
  ];
  const ch = keywordChanges(rows)!;
  expect(ch.get("dead")).toBeUndefined();
});

test("competitorPlatformStats aggregates one competitor's posts for a platform", () => {
  const posts: CompetitorPostRow[] = [
    { id: 1, source_id: "a", competitor: "X", platform: "facebook", text: "newest",
      comment_count: 3, like_count: 10, window_date: "2026-07-10T00:00:00Z" },
    { id: 2, source_id: "b", competitor: "X", platform: "facebook", text: "older",
      comment_count: 2, like_count: 5, window_date: "2026-07-01T00:00:00Z" },
    { id: 3, source_id: "c", competitor: "X", platform: "instagram", text: "ig",
      comment_count: 9, like_count: 1, window_date: "2026-07-05T00:00:00Z" },
  ];
  const fb = competitorPlatformStats(posts, "facebook");
  expect(fb.postsTracked).toBe(2);
  expect(fb.commentCount).toBe(5);                 // 3 + 2
  expect(fb.lastActive).toBe("2026-07-10T00:00:00Z");
  expect(fb.recent[0].text).toBe("newest");        // newest first
  expect(competitorPlatformStats(posts, "instagram").postsTracked).toBe(1);
});
