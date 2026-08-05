import type { ReactNode } from "react";
import { Ico } from "../../components/Ico";

export function SectionCard({ title, sub, children }: {
  title: string; sub: string; children: ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-hdr-row" style={{ marginBottom: 12 }}>
        <div className="card-ico" style={{ background: "var(--ora-l)", color: "var(--ora)" }}><Ico k="target" /></div>
        <div><div className="card-title">{title}</div><div className="card-sub">{sub}</div></div>
      </div>
      {children}
    </div>
  );
}
