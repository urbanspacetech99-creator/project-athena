import { useModes } from "../providers/useModes";
import type { Modes } from "../types";

/** Live/Fixture dot + text (spec §4). kind="data" reads sources[source];
 *  kind="ai" reads ai.llm. Renders nothing until modes are known. `light` is
 *  for colored headers. */
export function StatusBadge({ kind, source, light }: {
  kind: "data" | "ai"; source?: keyof Modes["sources"]; light?: boolean;
}) {
  const modes = useModes();
  if (!modes || (kind === "data" && !source)) return null;
  const live = kind === "ai" ? modes.ai.llm === "live" : modes.sources[source!] === "live";
  const text = kind === "ai" ? (live ? "Live AI" : "Sample AI") : (live ? "Live" : "Fixture");
  return (
    <span className={`stat-badge${light ? " light" : ""}`}>
      <span className="stat-dot" style={{ background: live ? "var(--green)" : "var(--gold)" }} />
      {text}
    </span>
  );
}
