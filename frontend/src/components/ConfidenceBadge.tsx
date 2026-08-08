//import { Ico } from "./Ico";

const CONFIDENCE_COLOR: Record<number, string> = {
  1: "var(--red-d)", 2: "var(--ora)", 3: "var(--gold)", 4: "var(--green)", 5: "var(--blue)",
};

export function ConfidenceBadge({ confidence, reason }: { confidence: number; reason: string }) {
  return (
    <span className="conf-badge">
      <span className="conf-num" style={{ background: CONFIDENCE_COLOR[confidence] ?? "var(--muted)" }}>
        {confidence}
      </span>
      <span className="conf-info-wrap">
        <span className="conf-info-dot">i</span>
        <span className="conf-tooltip">{reason}</span>
      </span>
    </span>
  );
}