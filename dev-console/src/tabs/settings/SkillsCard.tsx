import { useState } from "react";
import { api } from "../../lib/api";
import type { SkillDef } from "../../types";
import { SkillEditor } from "./SkillEditor";

export function SkillsCard({ skills, onChanged, onError }: {
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
