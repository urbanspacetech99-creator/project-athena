import { StatusBadge } from "../../components/StatusBadge";
import type { CompetitorPlatformStat } from "../../lib/derive";
import { CompetitorRankRows } from "./CompetitorRankRows";

export function PlatformCard({ label, color, stat }: { label: string; color: string; stat: CompetitorPlatformStat }) {
  return (
    <div className="soc-card">
      <div className="soc-hdr" style={{ background: color }}>
        <span>{label}</span><small>{stat.commentCount} comments</small>
        <StatusBadge kind="data" source="meta" light />
      </div>
      <div className="comp-block">
        <div className="comp-num-lbl">No. of Posts Tracked</div>
        <div className="comp-num-val">{stat.postsTracked}</div>
        <div className="comp-last-active">Last active: {stat.lastActive ? stat.lastActive.slice(0, 10) : "—"}</div>
      </div>
      <CompetitorRankRows posts={stat.recent} />
    </div>
  );
}