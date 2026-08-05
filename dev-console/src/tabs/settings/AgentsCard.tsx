import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AgentDef, SkillDef } from "../../types";

export function AgentsCard({ agents, skills, onChanged, onError }: {
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
