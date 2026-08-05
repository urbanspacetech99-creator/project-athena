import type { ReactNode } from "react";
import { TagPill } from "../../components/TagPill";

export function NotifRow({ color, tag, title, sub }: { color: "red" | "ora" | "green"; tag: string; title: string; sub: ReactNode }) {
  const c = { red: ["var(--red)", "var(--red-l)", "var(--red-d)"],
              ora: ["var(--ora)", "var(--ora-l)", "var(--ora-d)"],
              green: ["var(--green)", "var(--green-l)", "var(--green-d)"] }[color];
  return (
    <div className="notif-row">
      <div className="notif-dot" style={{ background: c[0] }} />
      <div style={{ flex: 1 }}>
        <TagPill style={{ background: c[1], color: c[2] }}>{tag}</TagPill>
        <div className="notif-title" style={{ marginTop: 6 }}>{title}</div>
        <div className="notif-sub">{sub}</div>
      </div>
    </div>
  );
}
