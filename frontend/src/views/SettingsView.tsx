import { useState, type ReactNode } from "react";
import { api } from "../api";
import { AsyncSection } from "../components/AsyncSection";
import { TagPill } from "../components/TagPill";
import { useApi, type Query } from "../hooks/useApi";
import { Ico } from "../icons";
import { useToast } from "../toast";
import type { AgentDef, IngestSource, ListResponse, SkillDef } from "../types";

function SectionCard({ title, sub, children }: {
  title: string; sub: string; children: ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-hdr-row" style={{ marginBottom: 12 }}>
        <div className="card-ico" style={{ background: "var(--ora-l)", color: "var(--ora)" }}><Ico k="target" /></div>
        <div><div className="card-title">{title}</div><div className="card-sub">{sub}</div></div>
      </div>
      {children}
    </div>
  );
}

const INGEST_SOURCES: IngestSource[] = ["meta", "competitor", "google_reviews",
  "google_ads", "zoho", "competitor_reviews"];

function DataSourcesSection() {
  const toast = useToast();
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const runOne = async (source: IngestSource) => {
    setBusy(source);
    try {
      const r = await api.ingest(source);
      if (r.skipped) {
        // Degenerate single-DB live config (no fixture DB): the backend refuses to
        // write fixture rows into the live DB. With a fixture DB configured, sources
        // are routed there instead and never skip. Not an error — run-all keeps going.
        setResults((m) => ({ ...m, [source]: "skipped (no fixture DB configured)" }));
        toast(`Skipped ${source}`);
      } else {
        const failed = r.failed.length ? ` · failed: ${r.failed.join(", ")}` : "";
        setResults((m) => ({ ...m, [source]: `${r.inserted} new, ${r.updated} updated${failed}` }));
        toast(`Ingested ${source}`);
      }
    } catch (e) {
      toast(`Failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  };
  // Sequential so a shared DB/adapter isn't hit by six concurrent ingests.
  const runAll = async () => { for (const s of INGEST_SOURCES) await runOne(s); };

  return (
    <SectionCard title="Data Sources"
      sub="Pull the latest data from each source into the active database (live or fixture, per SOURCE_MODE).">
      {INGEST_SOURCES.map((s) => (
        <div className="sdraft-row" key={s}>
          <div style={{ flex: 1 }}>
            <div className="sdraft-title">{s}</div>
            {results[s] && <div className="sdraft-meta">{results[s]}</div>}
          </div>
          <button className="btn btn-outline btn-sm" disabled={busy !== null}
            onClick={() => runOne(s)}>
            {busy === s ? "Ingesting…" : "Ingest"}
          </button>
        </div>
      ))}
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-ora btn-sm" disabled={busy !== null} onClick={runAll}>
          Ingest all
        </button>
      </div>
    </SectionCard>
  );
}

function CompetitorsSection() {
  const toast = useToast();
  const q = useApi(api.listCompetitors);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"facebook" | "instagram">("facebook");
  const [externalId, setExternalId] = useState("");

  const run = (p: Promise<unknown>, okMsg: string) =>
    p.then(() => { q.reload(); toast(okMsg); },
           (e) => toast(`Failed: ${e instanceof Error ? e.message : e}`));

  return (
    <SectionCard title="Competitors" sub="Pages tracked by competitor ingestion and research">
      <AsyncSection q={q}>
        {(d) => (
          <>
            {d.items.map((c) => (
              <div className="sdraft-row" key={c.id}>
                <div style={{ flex: 1 }}>
                  <div className="sdraft-title">{c.name}</div>
                  <div className="sdraft-meta">{c.platform}{c.external_id ? ` · ${c.external_id}` : ""}</div>
                </div>
                <TagPill style={c.enabled
                  ? { background: "var(--green-l)", color: "var(--green-d)" }
                  : { background: "var(--red-l)", color: "var(--red-d)" }}>
                  {c.enabled ? "enabled" : "disabled"}
                </TagPill>
                <button className="btn btn-outline btn-sm"
                  onClick={() => run(api.updateCompetitor(c.id, { enabled: !c.enabled }), "Updated")}>
                  {c.enabled ? "Disable" : "Enable"}
                </button>
                <button className="btn btn-outline btn-sm"
                  onClick={() => run(api.deleteCompetitor(c.id), "Deleted")}>
                  <Ico k="trash" /> Delete
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <input className="gprompt" style={{ flex: 2, minHeight: 0, height: 34 }} placeholder="Name"
                aria-label="Competitor name" value={name} onChange={(e) => setName(e.target.value)} />
              <select className="gchip" aria-label="Competitor platform" value={platform}
                onChange={(e) => setPlatform(e.target.value as "facebook" | "instagram")}>
                <option value="facebook">facebook</option>
                <option value="instagram">instagram</option>
              </select>
              <input className="gprompt" style={{ flex: 1, minHeight: 0, height: 34 }} placeholder="External id (optional)"
                aria-label="Competitor external id" value={externalId} onChange={(e) => setExternalId(e.target.value)} />
              <button className="btn btn-ora btn-sm" disabled={!name.trim()}
                onClick={() => run(api.createCompetitor({ platform, name: name.trim(), external_id: externalId.trim() })
                  .then(() => { setName(""); setExternalId(""); }), "Competitor added")}>
                Add
              </button>
            </div>
          </>
        )}
      </AsyncSection>
    </SectionCard>
  );
}

function KeywordsSection() {
  const toast = useToast();
  const q = useApi(api.listKeywords);
  const [keyword, setKeyword] = useState("");
  const run = (p: Promise<unknown>, okMsg: string) =>
    p.then(() => { q.reload(); toast(okMsg); },
           (e) => toast(`Failed: ${e instanceof Error ? e.message : e}`));

  return (
    <SectionCard title="Tracked Keywords" sub="Keywords fetched weekly from Google Ads Keyword Planner">
      <AsyncSection q={q}>
        {(d) => (
          <>
            {d.items.map((k) => (
              <div className="sdraft-row" key={k.id}>
                <div style={{ flex: 1 }}><div className="sdraft-title">{k.keyword}</div></div>
                <TagPill style={k.enabled
                  ? { background: "var(--green-l)", color: "var(--green-d)" }
                  : { background: "var(--red-l)", color: "var(--red-d)" }}>
                  {k.enabled ? "enabled" : "disabled"}
                </TagPill>
                <button className="btn btn-outline btn-sm"
                  onClick={() => run(api.updateKeyword(k.id, { enabled: !k.enabled }), "Updated")}>
                  {k.enabled ? "Disable" : "Enable"}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => run(api.deleteKeyword(k.id), "Deleted")}>
                  <Ico k="trash" /> Delete
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="gprompt" style={{ flex: 1, minHeight: 0, height: 34 }} placeholder="New keyword"
                aria-label="New keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              <button className="btn btn-ora btn-sm" disabled={!keyword.trim()}
                onClick={() => run(api.createKeyword(keyword.trim()).then(() => setKeyword("")), "Keyword added")}>
                Add
              </button>
            </div>
          </>
        )}
      </AsyncSection>
    </SectionCard>
  );
}

function AgentsSection({ agents, skills }: {
  agents: Query<ListResponse<AgentDef>>; skills: Query<ListResponse<SkillDef>>;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<AgentDef | null>(null);
  const [prompt, setPrompt] = useState("");
  const [skillKeys, setSkillKeys] = useState<string[]>([]);
  const [effective, setEffective] = useState("");

  const open = (a: AgentDef) => {
    setEditing(a); setPrompt(a.system_prompt); setSkillKeys(a.skill_keys); setEffective("");
  };
  const save = () =>
    api.updateAgent(editing!.key, { system_prompt: prompt, skill_keys: skillKeys })
      .then(() => { agents.reload(); setEditing(null); toast("Agent updated"); },
            (e) => toast(`Failed: ${e instanceof Error ? e.message : e}`));
  const preview = () =>
    api.effectivePrompt(editing!.key)
      .then((r) => setEffective(r.effective_prompt),
            (e) => toast(`Failed: ${e instanceof Error ? e.message : e}`));

  return (
    <SectionCard title="Agents" sub="System prompts and attached skills for each AI agent">
      <AsyncSection q={agents}>
        {(d) => (
          <>
            {d.items.map((a) => (
              <div className="sdraft-row" key={a.key}>
                <div style={{ flex: 1 }}>
                  <div className="sdraft-title">{a.name}</div>
                  <div className="sdraft-meta">{a.key} · skills: {a.skill_keys.join(", ") || "none"}</div>
                </div>
                <button className="btn btn-blue-outline btn-sm" onClick={() => open(a)}>Edit</button>
              </div>
            ))}
            {editing && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <div className="gform-lbl">System prompt — {editing.name}</div>
                <textarea className="gprompt" style={{ minHeight: 120 }} value={prompt}
                  aria-label="Agent system prompt" onChange={(e) => setPrompt(e.target.value)} />
                <div className="gform-lbl" style={{ marginTop: 10 }}>Attached skills</div>
                <div className="gchip-row">
                  {(skills.data?.items ?? []).map((s) => (
                    <button key={s.key} className={`gchip ${skillKeys.includes(s.key) ? "on" : ""}`}
                      onClick={() => setSkillKeys(skillKeys.includes(s.key)
                        ? skillKeys.filter((k) => k !== s.key) : [...skillKeys, s.key])}>
                      {s.name}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="btn btn-ora btn-sm" onClick={save}>Save</button>
                  <button className="btn btn-outline btn-sm" onClick={preview}>Preview effective prompt</button>
                  <button className="btn btn-white btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                </div>
                {effective && (
                  <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 12,
                    background: "var(--ora-l)", padding: 12, borderRadius: 10 }}>{effective}</pre>
                )}
              </div>
            )}
          </>
        )}
      </AsyncSection>
    </SectionCard>
  );
}

function SkillsSection({ skills, agents }: {
  skills: Query<ListResponse<SkillDef>>; agents: Query<ListResponse<AgentDef>>;
}) {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  /** Skill mutations also reload agents: the backend detaches deleted skills from
      agents server-side, so agent rows' skill_keys change too. The promise resolves
      to the toast message so success feedback stays a single toast. */
  const run = (p: Promise<string>) =>
    p.then((msg) => { skills.reload(); agents.reload(); toast(msg); },
           (e) => toast(`Failed: ${e instanceof Error ? e.message : e}`));

  return (
    <SectionCard title="Skills" sub="Reusable prompt fragments attachable to agents">
      <AsyncSection q={skills}>
        {(d) => (
          <>
            {d.items.map((s) => (
              <div className="sdraft-row" key={s.key}>
                <div style={{ flex: 1 }}>
                  <div className="sdraft-title">{s.name}</div>
                  <div className="sdraft-meta">{s.key} · {s.content.slice(0, 80)}</div>
                </div>
                <button className="btn btn-outline btn-sm"
                  onClick={() => run(api.deleteSkill(s.key).then((r) => r.detached_from.length
                    ? `Skill deleted — detached from: ${r.detached_from.join(", ")}`
                    : "Skill deleted"))}>
                  <Ico k="trash" /> Delete
                </button>
              </div>
            ))}
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="gprompt" style={{ flex: 1, minHeight: 0, height: 34 }}
                  placeholder="key (kebab-case)" aria-label="Skill key" value={key} onChange={(e) => setKey(e.target.value)} />
                <input className="gprompt" style={{ flex: 2, minHeight: 0, height: 34 }}
                  placeholder="Display name" aria-label="Skill display name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <textarea className="gprompt" placeholder="Skill content" aria-label="Skill content" value={content}
                onChange={(e) => setContent(e.target.value)} />
              <button className="btn btn-ora btn-sm" style={{ justifySelf: "start" }}
                disabled={!key.trim() || !name.trim() || !content.trim()}
                onClick={() => run(api.createSkill({ key: key.trim(), name: name.trim(), content })
                  .then(() => { setKey(""); setName(""); setContent(""); return "Skill added"; }))}>
                Add skill
              </button>
            </div>
          </>
        )}
      </AsyncSection>
    </SectionCard>
  );
}

export function SettingsView() {
  // Agents and skills share one pair of queries: skill mutations change agent
  // skill_keys server-side, so both sections must read (and reload) the same data.
  const agents = useApi(api.listAgents);
  const skills = useApi(api.listSkills);
  return (
    <div className="pgwrap">
      <div>
        <div className="pg-title" style={{ fontSize: 34 }}>Settings</div>
        <div className="pg-sub">Configure tracked competitors, keywords, and the AI agents behind each feature.</div>
      </div>
      <DataSourcesSection />
      <CompetitorsSection />
      <KeywordsSection />
      <AgentsSection agents={agents} skills={skills} />
      <SkillsSection skills={skills} agents={agents} />
    </div>
  );
}
