import type {
  AgentDef, CompetitorResponse, CompetitorRow, CustomerInsightsResponse, Draft,
  EffectivePrompt, EngagementSummary, GeneratePostIn, GeneratePostOut, IngestResponse,
  IngestSource, KpiSnapshot, ListResponse, Questions, Recommendations, SkillDef,
  SocialResponse, Trends, TrackedKeyword, DataResource,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" }, ...opts,
  });
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  listData: (resource: DataResource, limit = 50, offset = 0) =>
    request<ListResponse<Record<string, unknown>>>(
      `/data/${resource}?limit=${limit}&offset=${offset}`),
  ingest: (source: IngestSource) =>
    request<IngestResponse>(`/ingest/${source}`, { method: "POST" }),

  weeklyKpi: () => request<KpiSnapshot>("/home/weekly-kpi"),
  weeklyEngagement: () => request<EngagementSummary>("/home/weekly-engagement"),

  internetTrends: () => request<Trends>("/research/internet-trends"),
  customerQuestions: () => request<Questions>("/research/customer-questions"),
  customerInsights: () => request<CustomerInsightsResponse>("/research/customer-insights"),
  socialReviews: () => request<SocialResponse>("/research/social-reviews"),
  competitor: () => request<CompetitorResponse>("/research/competitor"),

  generatePost: (body: GeneratePostIn) =>
    request<GeneratePostOut>("/generate/post", { method: "POST", body: JSON.stringify(body) }),
  listDrafts: () => request<ListResponse<Draft>>("/generate/drafts"),
  createDraft: (body: { platform: string; caption: string; image_b64?: string;
    canva_edit_url?: string }) =>
    request<Draft>("/generate/drafts", { method: "POST", body: JSON.stringify(body) }),
  updateDraft: (id: number, body: { caption?: string; platform?: string }) =>
    request<Draft>(`/generate/drafts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteDraft: (id: number) =>
    request<void>(`/generate/drafts/${id}`, { method: "DELETE" }),
  recommendations: () => request<Recommendations>("/generate/recommendations"),

  listCompetitors: (platform?: string) =>
    request<ListResponse<CompetitorRow>>(
      `/config/competitors${platform ? `?platform=${platform}` : ""}`),
  createCompetitor: (body: { platform: string; name: string; external_id: string }) =>
    request<CompetitorRow>("/config/competitors", { method: "POST", body: JSON.stringify(body) }),
  updateCompetitor: (id: number, body: Partial<Pick<CompetitorRow, "name" | "external_id" | "enabled">>) =>
    request<CompetitorRow>(`/config/competitors/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCompetitor: (id: number) =>
    request<void>(`/config/competitors/${id}`, { method: "DELETE" }),

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
