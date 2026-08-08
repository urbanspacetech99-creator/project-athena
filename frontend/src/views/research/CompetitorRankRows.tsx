import { useState } from "react";
import { Ico } from "../../components/Ico";
import { splitHashtags } from "../../lib/splitHashtags";
import { PLACEHOLDER_PNG_B64 } from "../../providers/GenerateProvider";
import type { CompetitorPostRow } from "../../types";

export function CompetitorRankRows({ posts }: { posts: CompetitorPostRow[] }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  if (posts.length === 0) return <div className="empty-note">No posts ingested yet.</div>;

  return (
    <>
      {posts.map((p, i) => {
        const { caption, tags } = splitHashtags(p.text);
        const hasImage = p.image_b64 && p.image_b64 !== PLACEHOLDER_PNG_B64;
        const src = hasImage ? `data:image/png;base64,${p.image_b64}` : "";
        return (
          <div className="comp-post-item" key={p.id}>
            <div className="comp-post-media">
              <div className="comp-post-thumb-wrap">
                {hasImage ? (
                  <img className="comp-post-thumb" src={src} alt="" onClick={() => setLightboxSrc(src)} />
                ) : (
                  <div className="comp-post-thumb" />
                )}
                <span className="comp-post-num">{i + 1}</span>
              </div>
              <div className="comp-post-stats">
                <span className="comp-post-stat"><Ico k="heart" /> {p.like_count}</span>
                <span className="comp-post-stat"><Ico k="msg" /> {p.comment_count}</span>
              </div>
            </div>
            <div className="comp-post-body">
              <p className="comp-post-caption">{caption}</p>
              {tags.length > 0 && <div className="comp-post-tags">{tags.join(" ")}</div>}
              {p.permalink && (
                <a className="comp-post-link" href={p.permalink} target="_blank" rel="noreferrer">View post ↗</a>
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