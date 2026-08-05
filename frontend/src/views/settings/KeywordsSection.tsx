import { useState } from "react";
import { AsyncSection } from "../../components/AsyncSection";
import { Ico } from "../../components/Ico";
import { TagPill } from "../../components/TagPill";
import { useApi } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { useToast } from "../../providers/useToast";
import { SectionCard } from "./SectionCard";

export function KeywordsSection() {
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
