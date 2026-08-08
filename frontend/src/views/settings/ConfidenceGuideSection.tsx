import { SectionCard } from "./SectionCard";

const LEVELS: Array<{ score: number; color: string; label: string; desc: string }> = [
  { score: 1, color: "var(--red-d)", label: "Highly uncertain",
    desc: "This suggestion is highly uncertain and may be incorrect. Verify independently before relying on it." },
  { score: 2, color: "var(--ora)", label: "Plausible, limited evidence",
    desc: "This suggestion is plausible but based on limited or conflicting information. Treat it as a starting point rather than a reliable answer." },
  { score: 3, color: "var(--gold)", label: "Reasonably likely",
    desc: "This suggestion is reasonably likely to be correct, but there are meaningful uncertainties or assumptions. Consider verifying important details." },
  { score: 4, color: "var(--green)", label: "Likely accurate",
    desc: "This suggestion is likely to be accurate and is supported by strong evidence or consistent reasoning. Minor errors are still possible." },
  { score: 5, color: "var(--blue)", label: "Strongly supported",
    desc: "This suggestion is strongly supported by available evidence and is very likely to be accurate. While no AI output is guaranteed, the risk of error is low." },
];

export function ConfidenceGuideSection() {
  return (
    <SectionCard title="AI confidence scores"
      sub="What the 1-5 score next to AI-generated suggestions and recommendations means">
      {LEVELS.map((l) => (
        <div key={l.score} className="conf-guide-row">
          <span className="conf-num" style={{ background: l.color }}>{l.score}</span>
          <div>
            <div className="conf-guide-label">{l.label}</div>
            <div className="conf-guide-desc">{l.desc}</div>
          </div>
        </div>
      ))}
    </SectionCard>
  );
}