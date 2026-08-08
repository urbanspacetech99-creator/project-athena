export interface ListResponse<T> { items: T[]; count: number; }

export interface KpiSnapshot { posts: number; views: number; likes: number; interactions: number; }
export interface TopPost { source_id: string; platform: string; content: string;
  views: number; likes: number; interactions: number; }
export interface CommentInsights { summary: string; themes: string[]; sentiment: string;
  recurring_feedback: string[]; }
export interface EngagementSummary { top_post: TopPost | null; insights: CommentInsights; }

export interface TitleSuggestion { title: string; confidence: number; confidence_reason: string; }
export interface Keyword { keyword: string; weekly_search_volume: number; }
export interface Trends { keywords: Keyword[]; titles: TitleSuggestion[]; prefill_prompt: string; }
export interface Questions { questions: string[]; }
export interface CustomerInsights { top_services: string[]; top_features: string[];
  top_promotions: string[]; summary: string; }
export interface CustomerInsightsResponse { insights: CustomerInsights; titles: TitleSuggestion[];
  prefill_prompt: string; }
export interface SocialReview { comment_topics: string[]; review_summary: string; }
export interface SocialResponse { views: number; insights: SocialReview; titles: TitleSuggestion[];
  prefill_prompt: string; }
export interface Recommendation { title: string; detail: string; confidence: number; confidence_reason: string; }
export interface Competitor { activity_summary: string; recommendations: Recommendation[]; }
export interface CompetitorResponse { insights: Competitor; titles: TitleSuggestion[]; prefill_prompt: string; }

export interface PostOption { caption: string; hashtags: string[]; image_b64: string;
  mime_type: string; canva_edit_url: string; canva_design_id: string; visual_style: string;
  caption_failed: boolean; image_failed: boolean; }
export interface GeneratePostOut { options: PostOption[]; }
export interface GeneratePostIn {
  platform: string; tone: string; length: string; prefill_prompt: string; visual_style: string;
  include_hashtags: boolean; include_cta: boolean; include_emoji: boolean;
  include_pricing: boolean; options: number;
}
export interface Draft { id: number; platform: string; caption: string; image_b64: string;
  canva_edit_url: string; created_at: string; canva_design_id: string;}
export interface Recommendations { titles: TitleSuggestion[]; prefill_prompt: string; rationale: string; }

export interface CompetitorRow { id: number; platform: "facebook" | "instagram" | "google"; name: string;
  external_id: string; enabled: boolean; created_at: string; updated_at: string; }
export interface TrackedKeyword { id: number; keyword: string; enabled: boolean; created_at: string; }
export interface AgentDef { id: number; key: string; name: string; system_prompt: string;
  skill_keys: string[]; updated_at: string; }
export interface SkillDef { id: number; key: string; name: string; content: string; updated_at: string; }
export interface EffectivePrompt { key: string; effective_prompt: string; }

export interface OwnPostRow { id: number; source_id: string; platform: string; title: string;
  content: string; views: number; likes: number; interactions: number; image_b64: string;
  permalink: string; is_video: boolean; window_date: string; }
export interface PostCommentRow { id: number; source_id: string; post_source_id: string;
  text: string; window_date: string; }
export interface CompetitorPostRow { id: number; source_id: string; competitor: string;
  platform: string; text: string; like_count: number; comment_count: number; window_date: string; }
export interface CompetitorReviewRow { id: number; source_id: string; competitor: string;
  star_rating: number; comment: string; reviewer: string;
  place_rating: number; place_review_count: number; window_date: string; }
export interface GoogleReviewRow { id: number; source_id: string; star_rating: number;
  comment: string; reviewer: string; window_date: string; }
export interface KeywordVolumeRow { id: number; source_id: string; keyword: string;
  weekly_search_volume: number; window_date: string; }
export interface ZohoChatRow { id: number; source_id: string; transcript: string; window_date: string; }

export type IngestSource =
  "meta" | "competitor" | "google_reviews" | "google_ads" | "zoho" | "competitor_reviews";
export interface IngestResponse {
  source: string; inserted: number; updated: number; total: number; failed: string[];
  /** True only in the degenerate single-DB live config (fixture-pinned source with no
   *  fixture DB configured); with one configured, sources route there and never skip. */
  skipped: boolean;
}

/** Research → Generate handoff payload. */
export interface GenRequest { title: string; context: string; }

export interface Modes {
  sources: { meta: string; google_reviews: string; google_ads: string; zoho: string; google_places: string };
  ai: { llm: string; image: string; canva: string };
}
export interface StreamProgress { step: number; total: number; label: string }
