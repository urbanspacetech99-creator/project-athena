import { useApi } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { AgentsSection } from "./AgentsSection";
import { CompetitorsSection } from "./CompetitorsSection";
import { DataSourcesSection } from "./DataSourcesSection";
import { KeywordsSection } from "./KeywordsSection";
import { SkillsSection } from "./SkillsSection";

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
