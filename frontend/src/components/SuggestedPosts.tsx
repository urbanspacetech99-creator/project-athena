import { Ico } from "./Ico";
import { AiCard } from "./AiCard";

/** Ports the prototype's suggBlock — see docs/draft/urbanspace_dashboard.html lines 665-682.
 *  `titles` come from the backend's research/recommendation `titles` arrays.
 *  `onRefresh` (optional) renders a refresh button that busts the caller's cache. */
export function SuggestedPosts({ title, sub, titles, subLabel, onGenerate, onRefresh }: {
  title: string; sub: string; titles: string[]; subLabel: string;
  onGenerate: (title: string) => void; onRefresh?: () => void;
}) {
  return (
    <AiCard title={title} sub={sub} tag="AI SUGGESTED POSTS"
      action={onRefresh
        ? <button className="btn btn-white btn-sm" onClick={onRefresh} aria-label="Refresh">
            <Ico k="refresh" />
          </button>
        : undefined}>
      {titles.map((t, i) => (
        <div className="sugg-row" key={i}>
          <div className="sugg-num">{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div className="sugg-title">{t}</div>
            <div className="sugg-sub">{subLabel}</div>
          </div>
          <button className="btn btn-ai btn-sm" onClick={() => onGenerate(t)}>
            <Ico k="pencil" /> Generate
          </button>
        </div>
      ))}
    </AiCard>
  );
}
