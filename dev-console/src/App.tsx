import { useState } from "react";
import { DataIngestTab } from "./components/DataIngestTab";
import { GenerateTab } from "./components/GenerateTab";
import { HomeTab } from "./components/HomeTab";
import { ResearchTab } from "./components/ResearchTab";
import { SettingsTab } from "./components/SettingsTab";

type Tab = "data" | "home" | "research" | "generate" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("data");
  const [prefill, setPrefill] = useState<string>("");

  const tabs: { id: Tab; label: string }[] = [
    { id: "data", label: "Data & Ingest" },
    { id: "home", label: "Home" },
    { id: "research", label: "Research" },
    { id: "generate", label: "Generate" },
    { id: "settings", label: "Settings" },
  ];

  const goGenerate = (p: string) => { setPrefill(p); setTab("generate"); };

  return (
    <>
      <header><h1>Athena Dev Console</h1></header>
      <nav>
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""}
                  onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
      <main>
        {tab === "data" && <DataIngestTab />}
        {tab === "home" && <HomeTab />}
        {tab === "research" && <ResearchTab onSendToGenerate={goGenerate} />}
        {tab === "generate" && <GenerateTab prefill={prefill} />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </>
  );
}
