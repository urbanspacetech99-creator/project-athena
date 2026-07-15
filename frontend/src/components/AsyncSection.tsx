import type { ReactNode } from "react";
import type { Query } from "../hooks/useApi";
import type { StreamProgress } from "../types";
import { ProgressBar } from "./ProgressBar";

/** Wraps one data section: independent loading / error+retry / success states.
 *  Pass `progress` (from a streaming call) to upgrade the loading bar to determinate. */
export function AsyncSection<T>({ q, progress, children }: {
  q: Query<T>; progress?: StreamProgress | null; children: (data: T) => ReactNode;
}) {
  if (q.loading) return <ProgressBar progress={progress} />;
  if (q.error !== undefined) {
    return (
      <div className="async-note err">
        Couldn't load this section ({q.error}).
        <button className="btn btn-outline btn-sm" onClick={q.reload}>Retry</button>
      </div>
    );
  }
  return <>{children(q.data as T)}</>;
}
