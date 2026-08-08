import { useState } from "react";
import { Ico } from "../../components/Ico";
import { splitHashtags } from "../../lib/splitHashtags";
import { PLACEHOLDER_PNG_B64 } from "../../providers/GenerateProvider";
import type { OwnPostRow, PostCommentRow } from "../../types";

export function RankRows({ posts, comments }: { posts: OwnPostRow[]; comments: PostCommentRow[] }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  if (posts.length === 0) return <div className="empty-note">No posts ingested yet.</div>;
  return (
    <>
      <div className="rank-header">Ranking</div>
      {posts.map((p, i) => {
        const { caption, tags } = splitHashtags(p.title || p.content);
        const commentCount = comments.filter((c) => c.post_source_id === p.source_id).length;
        const hasImage = p.image_b64 && p.image_b64 !== PLACEHOLDER_PNG_B64;
        const src = hasImage ? `data:image/png;base64,${p.image_b64}` : "";
        return (
          <div className="rank-row" key={p.id}>
            <span className="rank-num">{i + 1}</span>
            <div className="rank-media">
              {hasImage ? (
                <img className="rank-thumb-lg" src={src} alt="" onClick={() => setLightboxSrc(src)} />
              ) : (
                <div className="rank-thumb-lg" />
              )}
              <div className="rank-media-stats">
                <span className="rank-stat"><Ico k="heart" /> {p.likes}</span>
                <span className="rank-stat"><Ico k="msg" /> {commentCount}</span>
              </div>
            </div>
            <div className="rank-title-col">
              <span className="rank-title">{caption}</span>
              {tags.length > 0 && <span className="rank-tags">{tags.join(" ")}</span>}
              {p.permalink && (
                <a className="rank-link" href={p.permalink} target="_blank" rel="noreferrer">View post ↗</a>
              )}
            </div>
          </div>
        );
      })}
      {lightboxSrc && (
        <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
          <button className="lightbox-close" onClick={() => setLightboxSrc(null)}>&times;</button>
          <img src={lightboxSrc} alt="Enlarged" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}