import type { CSSProperties, ReactNode } from "react";
import { Ico } from "./Ico";
import { StatusBadge } from "./StatusBadge";
import { TagPill } from "./TagPill";

/** Ports the prototype's `.ai-card` header pattern — see docs/draft/urbanspace_dashboard.html lines 674-681.
 *  Every AiCard is AI-generated content, so the header always carries the AI mode badge.
 *  `action` renders right of the tag (e.g. a refresh button). */
export function AiCard({ title, sub, tag, style, action, children }: {
  title: string; sub?: string; tag?: string; style?: CSSProperties;
  action?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="ai-card" style={style}>
      <div className="ai-card-hdr">
        <div className="ai-card-title-row">
          <div className="ai-star-ico"><Ico k="sparkle" /></div>
          <div className="card-title" style={{ fontSize: 17 }}>{title}</div>
          <StatusBadge kind="ai" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {tag && <TagPill red>{tag}</TagPill>}
          {action}
        </div>
      </div>
      {sub && <div className="card-sub" style={{ marginBottom: 6 }}>{sub}</div>}
      {children}
    </div>
  );
}
