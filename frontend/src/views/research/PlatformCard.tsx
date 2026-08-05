import { StatusBadge } from "../../components/StatusBadge";
import type { CompetitorPlatformStat } from "../../lib/derive";
import { splitHashtags } from "../../lib/splitHashtags";

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
      <div className="comp-sec-title">Recent Posts</div>
      {stat.recent.length === 0
        ? <div className="empty-note">No posts ingested yet.</div>
        : (
      <div className="comp-recent-list">
        {stat.recent.map((p) => {
          const { caption, tags } = splitHashtags(p.text);
          return (
            <div className="comp-post-item" key={p.id}>
              <div className="comp-post-title">{caption}</div>
              {tags.length > 0 && <div className="comp-post-tags">{tags.join(" ")}</div>}
            </div>
          );
        })}
      </div>
        )}
    </div>
  );
}
