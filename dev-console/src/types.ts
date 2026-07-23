export interface ListResponse<T> { items: T[]; count: number; }
export interface IngestResponse { source: string; inserted: number; updated: number; total: number;
  failed: string[]; skipped: boolean; }

export interface KpiSnapshot { posts: number; views: number; likes: number; interactions: number; }
export interface TopPost { source_id: string; platform: string; content: string;
  views: number; likes: number; interactions: number; }
export interface CommentInsights { summary: string; themes: string[]; sentiment: string;
  recurring_feedback: string[]; }
export interface EngagementSummary { top_post: TopPost | null; insights: CommentInsights; }

export interface Keyword { keyword: string; weekly_search_volume: number; }
export interface Trends { keywords: Keyword[]; titles: string[]; prefill_prompt: string; }
export interface Questions { questions: string[]; }
export interface CustomerInsights { top_services: string[]; top_features: string[];
  top_promotions: string[]; summary: string; }
export interface CustomerInsightsResponse { insights: CustomerInsights; titles: string[];
  prefill_prompt: string; }
export interface SocialReview { comment_topics: string[]; review_summary: string; }
export interface SocialResponse { views: number; insights: SocialReview; titles: string[];
  prefill_prompt: string; }
export interface Recommendation { title: string; detail: string; }
export interface Competitor { activity_summary: string; recommendations: Recommendation[]; }
export interface CompetitorResponse { insights: Competitor; titles: string[]; prefill_prompt: string; }

export interface PostOption { caption: string; hashtags: string[]; image_b64: string;
  mime_type: string; canva_edit_url: string; visual_style: string; }
export interface GeneratePostOut { options: PostOption[]; }
export interface GeneratePostIn {
  platform: string; tone: string; length: string; prefill_prompt: string; visual_style: string;
  include_hashtags: boolean; include_cta: boolean; include_emoji: boolean;
  include_pricing: boolean; options: number;
}
export interface Draft { id: number; platform: string; caption: string; image_b64: string;
  canva_edit_url: string; created_at: string; }
export interface Recommendations { titles: string[]; prefill_prompt: string; rationale: string; }

export type DataResource =
  | "own-posts" | "post-comments" | "competitor-posts" | "competitor-reviews"
  | "google-reviews" | "keyword-volumes" | "zoho-chats";
export type IngestSource =
  "meta" | "competitor" | "google_reviews" | "google_ads" | "zoho" | "competitor_reviews";

export interface CompetitorRow { id: number; platform: "facebook" | "instagram"; name: string;
  external_id: string; enabled: boolean; created_at: string; updated_at: string; }
export interface TrackedKeyword { id: number; keyword: string; enabled: boolean; created_at: string; }
export interface AgentDef { id: number; key: string; name: string; system_prompt: string;
  skill_keys: string[]; updated_at: string; }
export interface SkillDef { id: number; key: string; name: string; content: string; updated_at: string; }
export interface EffectivePrompt { key: string; effective_prompt: string; }
