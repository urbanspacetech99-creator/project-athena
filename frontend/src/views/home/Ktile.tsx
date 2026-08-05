import { Ico, type IcoKey } from "../../components/Ico";

const deltaBadge = (pct: number | null) =>
  pct === null || pct === 0 ? null : (
    <div className="ksub">{pct >= 0 ? "↑" : "↓"} {pct >= 0 ? "+" : ""}{pct}% vs last week</div>
  );

export function Ktile({ fill, value, label, delta, icon }: {
  fill: boolean; value: string; label: string; delta: number | null; icon: IcoKey;
}) {
  return (
    <div className={`ktile ${fill ? "fill" : "plain"}`}>
      <div>
        <div className="kval">{value}</div>
        <div className="klbl">{label}</div>
        {deltaBadge(delta)}
      </div>
      <div className="kicowrap"><Ico k={icon} /></div>
    </div>
  );
}
