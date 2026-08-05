import { useState } from "react";
import { AsyncSection } from "../../components/AsyncSection";
import { Ico } from "../../components/Ico";
import { type Query } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { useToast } from "../../providers/useToast";
import type { AgentDef, ListResponse, SkillDef } from "../../types";
import { SectionCard } from "./SectionCard";

export function SkillsSection({ skills, agents }: {
  skills: Query<ListResponse<SkillDef>>; agents: Query<ListResponse<AgentDef>>;
}) {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [editingSkill, setEditingSkill] = useState<SkillDef | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  const run = (p: Promise<string>) =>
    p.then((msg) => { skills.reload(); agents.reload(); toast(msg); },
           (e) => toast(`Failed: ${e instanceof Error ? e.message : e}`));

  const toggleSkill = (s: SkillDef) => {
    if (editingSkill?.key === s.key) { setEditingSkill(null); return; }
    setEditingSkill(s); setEditName(s.name); setEditContent(s.content);
  };
  const saveSkill = () =>
    run(api.updateSkill(editingSkill!.key, { name: editName, content: editContent })
      .then(() => { setEditingSkill(null); return "Skill updated"; }));

  return (
    <SectionCard title="Skills" sub="Reusable prompt fragments attachable to agents">
      <AsyncSection q={skills}>
        {(d) => (
          <>
            {d.items.map((s) => {
              const isOpen = editingSkill?.key === s.key;
              return (
                <div key={s.key} className={isOpen ? "agent-row-open" : ""}>
                  <div className="sdraft-row">
                    <div style={{ flex: 1 }}>
                      <div className="sdraft-title">{s.name}</div>
                      <div className="sdraft-meta" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <span className="skill-pill">{s.key}</span>
                        <span className="skill-preview">{s.content.slice(0, 80)}</span>
                      </div>
                    </div>
                    <button className="btn btn-blue-outline btn-sm" onClick={() => toggleSkill(s)}>
                      {isOpen ? "Close" : "Edit"}
                    </button>
                    <button className="btn btn-outline btn-sm"
                      onClick={() => run(api.deleteSkill(s.key).then((r) => r.detached_from.length
                        ? `Skill deleted — detached from: ${r.detached_from.join(", ")}`
                        : "Skill deleted"))}>
                      <Ico k="trash" /> Delete
                    </button>
                  </div>
                  {isOpen && (
                    <div className="agent-edit-panel">
                      <div className="gform-lbl">Display name</div>
                      <input className="gprompt" style={{ minHeight: 0, height: 34, marginBottom: 10 }}
                        aria-label="Skill display name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <div className="gform-lbl">Content</div>
                      <textarea className="gprompt" aria-label="Skill content" value={editContent}
                        onChange={(e) => setEditContent(e.target.value)} />
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button className="btn btn-ora btn-sm" onClick={saveSkill}>Save</button>
                        <button className="btn btn-white btn-sm" onClick={() => setEditingSkill(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
