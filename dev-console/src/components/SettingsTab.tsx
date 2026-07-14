import { useEffect, useState } from "react";
import { api } from "../api";
import type { AgentDef, CompetitorRow, SkillDef, TrackedKeyword } from "../types";

const PLATFORMS = ["facebook", "instagram"];

export function SettingsTab() {
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([]);
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [skills, setSkills] = useState<SkillDef[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [c, k, a, s] = await Promise.all([
        api.listCompetitors(), api.listKeywords(), api.listAgents(), api.listSkills(),
      ]);
      setCompetitors(c.items); setKeywords(k.items); setAgents(a.items); setSkills(s.items);
    } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { void load(); }, []);

  return (
    <>
      {error && <p className="err">Error: {error}</p>}
      <CompetitorsCard competitors={competitors} onChanged={load} onError={setError} />
      <KeywordsCard keywords={keywords} onChanged={load} onError={setError} />
      <AgentsCard agents={agents} skills={skills} onChanged={load} onError={setError} />
      <SkillsCard skills={skills} onChanged={load} onError={setError} />
    </>
  );
}

function CompetitorsCard({ competitors, onChanged, onError }: {
  competitors: CompetitorRow[]; onChanged: () => Promise<void>; onError: (m: string) => void;
}) {
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");

  const add = async () => {
    try {
      await api.createCompetitor({ platform, name, external_id: externalId });
      setName(""); setExternalId("");
      await onChanged();
    } catch (e) { onError((e as Error).message); }
  };
  const toggle = async (row: CompetitorRow) => {
    try { await api.updateCompetitor(row.id, { enabled: !row.enabled }); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };
  const remove = async (id: number) => {
    try { await api.deleteCompetitor(id); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };

  return (
    <section className="card">
      <h3>Competitors</h3>
      {competitors.length === 0 ? <p className="muted">No competitors tracked yet.</p> : (
        <table>
          <tbody>
            {competitors.map((c) => (
              <tr key={c.id}>
                <td>{c.platform}</td>
                <td>{c.name}</td>
                <td>{c.external_id || "—"}</td>
                <td>
                  <label><input type="checkbox" checked={c.enabled}
                    onChange={() => toggle(c)} />enabled</label>
                </td>
                <td><button className="danger" onClick={() => remove(c.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="External ID" value={externalId}
          onChange={(e) => setExternalId(e.target.value)} />
        <button className="action" disabled={!name} onClick={add}>Add</button>
      </div>
    </section>
  );
}

function KeywordsCard({ keywords, onChanged, onError }: {
  keywords: TrackedKeyword[]; onChanged: () => Promise<void>; onError: (m: string) => void;
}) {
  const [keyword, setKeyword] = useState("");

  const add = async () => {
    try { await api.createKeyword(keyword); setKeyword(""); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };
  const toggle = async (row: TrackedKeyword) => {
    try { await api.updateKeyword(row.id, { enabled: !row.enabled }); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };
  const remove = async (id: number) => {
    try { await api.deleteKeyword(id); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };

  return (
    <section className="card">
      <h3>Tracked keywords</h3>
      {keywords.length === 0 ? <p className="muted">No keywords tracked yet.</p> : (
        <table>
          <tbody>
            {keywords.map((k) => (
              <tr key={k.id}>
                <td>{k.keyword}</td>
                <td>
                  <label><input type="checkbox" checked={k.enabled}
                    onChange={() => toggle(k)} />enabled</label>
                </td>
                <td><button className="danger" onClick={() => remove(k.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <input placeholder="Keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <button className="action" disabled={!keyword} onClick={add}>Add</button>
      </div>
    </section>
  );
}

function AgentsCard({ agents, skills, onChanged, onError }: {
  agents: AgentDef[]; skills: SkillDef[]; onChanged: () => Promise<void>; onError: (m: string) => void;
}) {
  const [agentKey, setAgentKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [skillKeys, setSkillKeys] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

  // Resync form state from the fetched list ONLY when the selected agent is missing:
  // on first load (agentKey is "") or after the selected key disappears, fall back to
  // the first agent. Unrelated reloads — a mutation in another card refreshing all
  // lists — must not clobber unsaved edits; explicit selection resyncs in selectAgent.
  useEffect(() => {
    if (agents.length === 0 || agents.some((a) => a.key === agentKey)) return;
    const first = agents[0];
    setAgentKey(first.key); setPrompt(first.system_prompt); setSkillKeys(first.skill_keys);
  }, [agents, agentKey]);

  const selectAgent = (key: string) => {
    const a = agents.find((x) => x.key === key);
    if (!a) return;
    setAgentKey(a.key); setPrompt(a.system_prompt); setSkillKeys(a.skill_keys); setPreview(null);
  };
  const toggleSkill = (key: string) => {
    setSkillKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };
  const save = async () => {
    try {
      await api.updateAgent(agentKey, { system_prompt: prompt, skill_keys: skillKeys });
      await onChanged();
    } catch (e) { onError((e as Error).message); }
  };
  const showEffectivePrompt = async () => {
    try { setPreview((await api.effectivePrompt(agentKey)).effective_prompt); }
    catch (e) { onError((e as Error).message); }
  };

  return (
    <section className="card">
      <h3>Agents</h3>
      {agents.length === 0 ? <p className="muted">No agents configured.</p> : (
        <>
          <div className="row">
            <select value={agentKey} onChange={(e) => selectAgent(e.target.value)}>
              {agents.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
            </select>
          </div>
          <textarea style={{ width: "100%", marginTop: 8 }} rows={6} value={prompt}
            onChange={(e) => setPrompt(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            {skills.map((s) => (
              <label key={s.key}>
                <input type="checkbox" checked={skillKeys.includes(s.key)}
                  onChange={() => toggleSkill(s.key)} />{s.name}
              </label>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="action" onClick={save}>Save agent</button>
            <button className="ghost" onClick={showEffectivePrompt}>Preview effective prompt</button>
          </div>
          {preview !== null && <pre>{preview}</pre>}
        </>
      )}
    </section>
  );
}

function SkillsCard({ skills, onChanged, onError }: {
  skills: SkillDef[]; onChanged: () => Promise<void>; onError: (m: string) => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  const add = async () => {
    try {
      await api.createSkill({ key, name, content });
      setKey(""); setName(""); setContent("");
      await onChanged();
    } catch (e) { onError((e as Error).message); }
  };

  return (
    <section className="card">
      <h3>Skills</h3>
      {info && <p className="muted">{info}</p>}
      {skills.length === 0 ? <p className="muted">No skills defined.</p> : skills.map((s) => (
        // Keyed by skill.key: each editor keeps its own unsaved name/content state,
        // which intentionally survives sibling-triggered reloads (state resets only
        // when the skill itself is removed and its key unmounts).
        <SkillEditor key={s.key} skill={s} onChanged={onChanged} onError={onError}
          onInfo={setInfo} />
      ))}
      <div className="row" style={{ marginTop: 8 }}>
        <input placeholder="key (kebab-case)" value={key} onChange={(e) => setKey(e.target.value)} />
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Content" value={content} onChange={(e) => setContent(e.target.value)} />
        <button className="action" disabled={!key || !name} onClick={add}>Add</button>
      </div>
    </section>
  );
}

function SkillEditor({ skill, onChanged, onError, onInfo }: {
  skill: SkillDef; onChanged: () => Promise<void>; onError: (m: string) => void;
  onInfo: (m: string | null) => void;
}) {
  const [name, setName] = useState(skill.name);
  const [content, setContent] = useState(skill.content);

  const save = async () => {
    try { await api.updateSkill(skill.key, { name, content }); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };
  const remove = async () => {
    try {
      const res = await api.deleteSkill(skill.key);
      onInfo(res.detached_from.length > 0
        ? `Detached from: ${res.detached_from.join(", ")}` : null);
      await onChanged();
    } catch (e) { onError((e as Error).message); }
  };

  return (
    <details style={{ marginBottom: 8 }}>
      <summary>{skill.name} <code>{skill.key}</code></summary>
      <div className="row" style={{ marginTop: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <textarea style={{ width: "100%", marginTop: 8 }} rows={4} value={content}
        onChange={(e) => setContent(e.target.value)} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="action" onClick={save}>Save</button>
        <button className="danger" onClick={remove}>Delete</button>
      </div>
    </details>
  );
}
