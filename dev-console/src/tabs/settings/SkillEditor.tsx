import { useState } from "react";
import { api } from "../../lib/api";
import type { SkillDef } from "../../types";

export function SkillEditor({ skill, onChanged, onError, onInfo }: {
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
