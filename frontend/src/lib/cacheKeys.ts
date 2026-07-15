/** Cache keys for the AI-backed GETs cached via useCachedApi (lib/cache.ts).
 *  Shared so a view's useCachedApi key and ResearchView's Refresh cache-bust
 *  can never drift apart. */
export const CACHE_KEYS = {
  weeklyEngagement: "weekly-engagement",
  internetTrends: "internet-trends",
  customerInsights: "customer-insights",
  socialReviews: "social-reviews",
  competitor: "competitor",
  recommendations: "recommendations",
} as const;
