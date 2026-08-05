import { Ico } from "../../components/Ico";
import { splitHashtags } from "../../lib/splitHashtags";
import type { OwnPostRow } from "../../types";

export function RankRows({ posts }: { posts: OwnPostRow[] }) {
  if (posts.length === 0) return <div className="empty-note">No posts ingested yet.</div>;
  return (
    <>
      <div className="rank-header"><span /><span>Ranking</span><span>Likes</span><span>Interactions</span></div>
      {posts.map((p, i) => {
        const { caption, tags } = splitHashtags(p.title || p.content);
        return (
          <div className="rank-row" key={p.id}>
            <span className="rank-num">{i + 1}</span>
            <div className="rank-title-col">
              <span className="rank-title">{caption}</span>
              {tags.length > 0 && <span className="rank-tags">{tags.join(" ")}</span>}
            </div>
            <span className="rank-stat"><Ico k="heart" /> {p.likes}</span>
            <span className="rank-stat"><Ico k="msg" /> {p.interactions}</span>
          </div>
        );
      })}
    </>
  );
}
