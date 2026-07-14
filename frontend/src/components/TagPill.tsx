import type { CSSProperties, ReactNode } from "react";

/** Prototype .tag-pill; `red` variant is the AI branding used on all AI blocks. */
export function TagPill({ red, style, children }: {
  red?: boolean; style?: CSSProperties; children: ReactNode;
}) {
  return <span className={`tag-pill ${red ? "red" : ""}`} style={style}>{children}</span>;
}
