import type { StreamProgress } from "../types";

/** Loading bar: determinate (real step/total from a streaming endpoint) when
 *  `progress` is given, otherwise an animated indeterminate bar. */
export function ProgressBar({ progress }: { progress?: StreamProgress | null }) {
  const pct = progress ? Math.min(100, Math.round((100 * progress.step) / Math.max(1, progress.total))) : null;
  return (
    <div className="pbar-wrap" role="status">
      <div className="pbar">
        {pct === null
          ? <div className="pbar-fill indet" />
          : <div className="pbar-fill" style={{ width: `${pct}%` }} />}
      </div>
      <div className="pbar-lbl">
        {progress ? `${progress.label} · ${progress.step} of ${progress.total}` : "Loading…"}
      </div>
    </div>
  );
}
