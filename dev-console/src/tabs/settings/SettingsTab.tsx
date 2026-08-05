import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AgentDef, CompetitorRow, SkillDef, TrackedKeyword } from "../../types";
import { AgentsCard } from "./AgentsCard";
import { CompetitorsCard } from "./CompetitorsCard";
import { KeywordsCard } from "./KeywordsCard";
import { SkillsCard } from "./SkillsCard";

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
