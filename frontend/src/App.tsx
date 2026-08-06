import { useEffect, useState } from "react";
import { GenerateProvider } from "./providers/GenerateProvider";
import { ModesProvider } from "./providers/ModesProvider";
import { ToastProvider } from "./providers/ToastProvider";
import { useGenerate } from "./providers/useGenerate";
import { GenerateView } from "./views/generate/GenerateView";
import { HomeView } from "./views/home/HomeView";
import { ResearchView } from "./views/research/ResearchView";
import { SettingsView } from "./views/settings/SettingsView";

export type View = "home" | "research" | "generate" | "settings";

const NAV: Array<{ id: View; label: string; icon: JSX.Element }> = [
  { id: "home", label: "Home", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/></svg> },
  { id: "research", label: "Research", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg> },
  { id: "generate", label: "Generate", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> },
  { id: "settings", label: "Settings", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
];

const VALID_VIEWS: View[] = ["home", "research", "generate", "settings"];

function AppShell() {
  const [view, setView] = useState<View>(() => {
    const saved = localStorage.getItem("athena_view");
    return (VALID_VIEWS as string[]).includes(saved ?? "") ? (saved as View) : "home";
  });
  const [collapsed, setCollapsed] = useState(false);
  const { loadPrefill } = useGenerate();

  useEffect(() => { localStorage.setItem("athena_view", view); }, [view]);

  const generateFrom = (title: string, context: string) => {
    loadPrefill(title, context);
    setView("generate");
  };

  return (
    <div className="shell">
      <nav className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sb-toprow">
          <button className="sb-toggle" title="Collapse sidebar" onClick={() => setCollapsed(!collapsed)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        </div>
        <div className="sb-logo-row">
          <div className="sb-logo-box">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7l9-5z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>
          </div>
          <div className="sb-logo-text">
            <div className="sb-logo-name"><b>URBAN<span style={{ fontWeight: 800 }}>SPACE</span></b></div>
            <div className="sb-logo-sub">Self-Storage &middot; Work &middot; Fulfilment</div>
          </div>
        </div>
        <div className="sb-status"><span className="sb-status-dot" /><span className="sb-status-txt">Marketing Agent</span></div>
        <div className="sb-nav">
          {NAV.map((n) => (
            <button key={n.id} className={`sb-item ${view === n.id ? "on" : ""}`} onClick={() => setView(n.id)}>
              {n.icon}<span>{n.label}</span>
            </button>
          ))}
        </div>
        <div className="sb-spacer" />
      </nav>
      <main className="main" style={{ background: "#FFEAD9" }}>
        {view === "home" && <HomeView onNavigate={setView} />}
        {view === "research" && <ResearchView onGenerate={generateFrom} />}
        {view === "generate" && <GenerateView />}
        {view === "settings" && <SettingsView />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <ModesProvider>
        <GenerateProvider>
          <AppShell />
        </GenerateProvider>
      </ModesProvider>
    </ToastProvider>
  );
}