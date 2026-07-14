import type { CSSProperties, ReactNode } from "react";
import { Ico } from "../icons";
import { TagPill } from "./TagPill";

/** Ports the prototype's `.ai-card` header pattern — see docs/draft/urbanspace_dashboard.html lines 674-681. */
export function AiCard({ title, sub, tag, style, children }: {
  title: string; sub?: string; tag?: string; style?: CSSProperties; children: ReactNode;
}) {
  return (
    <div className="ai-card" style={style}>
      <div className="ai-card-hdr">
        <div className="ai-card-title-row">
          <div className="ai-star-ico"><Ico k="sparkle" /></div>
          <div className="card-title" style={{ fontSize: 17 }}>{title}</div>
        </div>
        {tag && <TagPill red>{tag}</TagPill>}
      </div>
      {sub && <div className="card-sub" style={{ marginBottom: 6 }}>{sub}</div>}
      {children}
    </div>
  );
}
