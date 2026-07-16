import type {
  AgentDef, CompetitorPostRow, CompetitorResponse, CompetitorReviewRow, CompetitorRow,
  CustomerInsightsResponse, Draft, EffectivePrompt, EngagementSummary, GeneratePostIn,
  GeneratePostOut, GoogleReviewRow, IngestResponse, IngestSource, KpiSnapshot, KeywordVolumeRow,
  ListResponse, Modes, OwnPostRow, PostCommentRow, Questions, Recommendations, SkillDef,
  SocialResponse, StreamProgress, TrackedKeyword, Trends, ZohoChatRow,
} from "./types";
import { streamNdjson } from "./lib/stream";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

/** /data lists are ordered by id ascending server-side; fetch a wide window and
    sort client-side (see lib/derive.ts) so "recent" views and week-over-week
    stats have enough history. */
export const DATA_LIMIT = 500;

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const { headers, ...rest } = opts;
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json", ...(headers as Record<string, string> | undefined) },
    ...rest,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = String((await res.json())?.detail ?? ""); } catch { /* non-JSON body */ }
    throw new ApiError(res.status, detail || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** /data lists are ordered by id ascending with no "latest" param, so grab the
    tail: read the total count cheaply, then fetch the last DATA_LIMIT rows. */
async function listTail<T>(resource: string): Promise<ListResponse<T>> {
  const head = await request<ListResponse<T>>(`/data/${resource}?limit=1&offset=0`);
  const offset = Math.max(0, head.count - DATA_LIMIT);
  return request<ListResponse<T>>(`/data/${resource}?limit=${DATA_LIMIT}&offset=${offset}`);
}

export const api = {
  weeklyKpi: () => request<KpiSnapshot>("/home/weekly-kpi"),
  weeklyEngagement: () => request<EngagementSummary>("/home/weekly-engagement"),

  internetTrends: () => request<Trends>("/research/internet-trends"),
  customerQuestions: () => request<Questions>("/research/customer-questions"),
  customerInsights: () => request<CustomerInsightsResponse>("/research/customer-insights"),
  socialReviews: () => request<SocialResponse>("/research/social-reviews"),
  competitor: (name?: string) =>
    request<CompetitorResponse>(name
      ? `/research/competitor?competitor=${encodeURIComponent(name)}`
      : "/research/competitor"),

  ownPosts: () => listTail<OwnPostRow>("own-posts"),
  postComments: () => listTail<PostCommentRow>("post-comments"),
  competitorPosts: () => listTail<CompetitorPostRow>("competitor-posts"),
  competitorReviews: () => listTail<CompetitorReviewRow>("competitor-reviews"),
  googleReviews: () => listTail<GoogleReviewRow>("google-reviews"),
  keywordVolumes: () => listTail<KeywordVolumeRow>("keyword-volumes"),
  zohoChats: () => request<ListResponse<ZohoChatRow>>(`/data/zoho-chats?limit=1&offset=0`),

  generatePost: (body: GeneratePostIn) =>
    request<GeneratePostOut>("/generate/post", { method: "POST", body: JSON.stringify(body) }),
  listDrafts: () => request<ListResponse<Draft>>("/generate/drafts"),
  createDraft: (body: { platform: string; caption: string; image_b64?: string; canva_edit_url?: string }) =>
    request<Draft>("/generate/drafts", { method: "POST", body: JSON.stringify(body) }),
  updateDraft: (id: number, body: { caption?: string; platform?: string }) =>
    request<Draft>(`/generate/drafts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteDraft: (id: number) => request<void>(`/generate/drafts/${id}`, { method: "DELETE" }),
  recommendations: () => request<Recommendations>("/generate/recommendations"),
  recommendationsStream: (onProgress: (p: StreamProgress) => void) =>
    streamNdjson<Recommendations>(API_BASE + "/generate/recommendations/stream", {}, onProgress),
  generatePostStream: (body: GeneratePostIn, onProgress: (p: StreamProgress) => void) =>
    streamNdjson<GeneratePostOut>(API_BASE + "/generate/post/stream",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      onProgress),
  modes: () => request<Modes>("/config/modes"),
  ingest: (source: IngestSource) =>
    request<IngestResponse>(`/ingest/${source}`, { method: "POST" }),

  listCompetitors: () => request<ListResponse<CompetitorRow>>("/config/competitors"),
  createCompetitor: (body: { platform: string; name: string; external_id: string }) =>
    request<CompetitorRow>("/config/competitors", { method: "POST", body: JSON.stringify(body) }),
  updateCompetitor: (id: number, body: Partial<Pick<CompetitorRow, "name" | "external_id" | "enabled">>) =>
    request<CompetitorRow>(`/config/competitors/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCompetitor: (id: number) => request<void>(`/config/competitors/${id}`, { method: "DELETE" }),

  listKeywords: () => request<ListResponse<TrackedKeyword>>("/config/keywords"),
  createKeyword: (keyword: string) =>
    request<TrackedKeyword>("/config/keywords", { method: "POST", body: JSON.stringify({ keyword }) }),
  updateKeyword: (id: number, body: { keyword?: string; enabled?: boolean }) =>
    request<TrackedKeyword>(`/config/keywords/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteKeyword: (id: number) => request<void>(`/config/keywords/${id}`, { method: "DELETE" }),

  listAgents: () => request<ListResponse<AgentDef>>("/config/agents"),
  updateAgent: (key: string, body: { system_prompt?: string; skill_keys?: string[] }) =>
    request<AgentDef>(`/config/agents/${key}`, { method: "PATCH", body: JSON.stringify(body) }),
  effectivePrompt: (key: string) =>
    request<EffectivePrompt>(`/config/agents/${key}/effective-prompt`),

  listSkills: () => request<ListResponse<SkillDef>>("/config/skills"),
  createSkill: (body: { key: string; name: string; content: string }) =>
    request<SkillDef>("/config/skills", { method: "POST", body: JSON.stringify(body) }),
  updateSkill: (key: string, body: { name?: string; content?: string }) =>
    request<SkillDef>(`/config/skills/${key}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSkill: (key: string) =>
    request<{ deleted: string; detached_from: string[] }>(`/config/skills/${key}`, { method: "DELETE" }),
};
