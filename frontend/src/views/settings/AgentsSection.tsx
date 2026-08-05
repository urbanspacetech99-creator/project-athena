import { useState, useMemo } from "react";
import { AsyncSection } from "../../components/AsyncSection";
import { type Query } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { DEFAULT_AGENTS } from "../../lib/agentDefaults";
import { useToast } from "../../providers/useToast";
import type { AgentDef, ListResponse, SkillDef } from "../../types";
import { SectionCard } from "./SectionCard";

export function AgentsSection({ agents, skills }: {
  agents: Query<ListResponse<AgentDef>>; skills: Query<ListResponse<SkillDef>>;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<AgentDef | null>(null);
  const [/*original*/, setOriginal] = useState<AgentDef | null>(null);
  const [prompt, setPrompt] = useState("");
  const [skillKeys, setSkillKeys] = useState<string[]>([]);

  const effectivePreview = useMemo(() => {
    if (!editing) return "";
    const attached = (skills.data?.items ?? []).filter((s) => skillKeys.includes(s.key));
    return [prompt, ...attached.map((s) => s.content)].filter(Boolean).join("\n\n");
  }, [editing, prompt, skillKeys, skills.data]);

  const toggle = (a: AgentDef) => {
    if (editing?.key === a.key) { setEditing(null); return; }
    setEditing(a); setOriginal(a); setPrompt(a.system_prompt); setSkillKeys(a.skill_keys);
  };
  const save = () =>
    api.updateAgent(editing!.key, { system_prompt: prompt, skill_keys: skillKeys })
      .then((updated) => {
        agents.reload();
        setEditing(updated); setOriginal(updated);
        setPrompt(updated.system_prompt); setSkillKeys(updated.skill_keys);
        toast("Agent updated");
      }, (e) => toast(`Failed: ${e instanceof Error ? e.message : e}`));
    const reset = () => {
      const d = editing ? DEFAULT_AGENTS[editing.key] : undefined;
      if (!d) return;
      setPrompt(d.system_prompt); setSkillKeys(d.skill_keys);
      toast("Reset to default");
    };

  return (
    <SectionCard title="Agents" sub="System prompts and attached skills for each AI agent">
      <AsyncSection q={agents}>
        {(d) => (
          <>
            {d.items.map((a) => {
              const isOpen = editing?.key === a.key;
              return (
                <div key={a.key} className={isOpen ? "agent-row-open" : ""}>
                  <div className="sdraft-row">
                    <div style={{ flex: 1 }}>
                      <div className="sdraft-title">{a.name}</div>
                      <div className="sdraft-meta" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        <span>{a.key}</span>
                        {a.skill_keys.length > 0
                          ? a.skill_keys.map((k) => <span key={k} className="skill-pill">{k}</span>)
                          : <span className="skill-pill skill-pill-empty">none</span>}
                      </div>
                    </div>
                    <button className="btn btn-blue-outline btn-sm" onClick={() => toggle(a)}>
                      {isOpen ? "Close" : "Edit"}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="agent-edit-panel">
                      <div className="gform-lbl">System prompt</div>
                      <textarea className="gprompt" style={{ minHeight: 120 }} value={prompt}
                        aria-label="Agent system prompt" onChange={(e) => setPrompt(e.target.value)} />
                      <div className="gform-lbl" style={{ marginTop: 10 }}>Attached skills</div>
                      <div className="skill-hint">
                        Skills are appended to the system prompt above at generation time — they don't change the text in
                        this box. See the live combined result below.
                      </div>
                      <div className="gchip-row" style={{ marginTop: 8 }}>
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
                        {DEFAULT_AGENTS[editing.key] && (
                          <button className="btn btn-white btn-sm" onClick={reset}>Reset to default</button>
                        )}
                      </div>
                      <div className="gform-lbl" style={{ marginTop: 12 }}>Effective prompt (live preview)</div>
                      <pre style={{ marginTop: 6, whiteSpace: "pre-wrap", fontSize: 12,
                        background: "var(--ora-l)", padding: 12, borderRadius: 10 }}>{effectivePreview}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </AsyncSection>
    </SectionCard>
  );
}
