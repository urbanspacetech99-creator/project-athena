import type { ReactNode } from "react";
import type { Query } from "../hooks/useApi";

/** Wraps one data section: independent loading / error+retry / success states. */
export function AsyncSection<T>({ q, children }: { q: Query<T>; children: (data: T) => ReactNode }) {
  if (q.loading) return <div className="async-note">Loading…</div>;
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
