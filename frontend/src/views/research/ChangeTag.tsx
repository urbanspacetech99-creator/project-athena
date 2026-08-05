import type { KeywordChange } from "../../lib/derive";

export function ChangeTag({ ch }: { ch: KeywordChange | undefined }) {
  if (!ch) return null;
  if (ch.kind === "new") return <span className="mini-tag riser">NEW</span>;
  return (
    <span className={`kw-pct ${ch.pct < 0 ? "chg-dn" : "chg-up"}`}>
      {ch.pct >= 0 ? "+" : ""}{ch.pct}%
    </span>
  );
}
