import { useState } from "react";
import { AsyncSection } from "../../components/AsyncSection";
import { Ico } from "../../components/Ico";
import { TagPill } from "../../components/TagPill";
import { useApi } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { useToast } from "../../providers/useToast";
import { SectionCard } from "./SectionCard";

export function CompetitorsSection() {
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
