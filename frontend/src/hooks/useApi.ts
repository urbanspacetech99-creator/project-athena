import { useEffect, useRef, useState } from "react";
import { cacheDelete, cacheGet, cacheSet } from "../lib/cache";

export interface Query<T> {
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** Fetch-on-mount hook. `deps` re-triggers the fetch (must be a stable-length array across renders); `reload()` retries manually. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []): Query<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    fnRef.current().then(
      (data) => { if (alive) setState({ data, loading: false }); },
      (err: unknown) => { if (alive) setState({ error: err instanceof Error ? err.message : String(err), loading: false }); },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}

/** useApi + localStorage cache (24 h TTL). A fresh cache entry renders instantly with
 *  NO network call; `reload()` busts the entry and refetches. Use for AI-backed GETs
 *  only — cheap /data reads and anything that must reflect writes stay on useApi.
 *  `deps` must be a stable-length array across renders (same constraint as useApi). */
export function useCachedApi<T>(key: string, fn: () => Promise<T>, deps: unknown[] = []): Query<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    const cached = cacheGet<T>(key);
    if (cached !== undefined) { setState({ data: cached, loading: false }); return; }
    setState({ loading: true });
    fnRef.current().then(
      (data) => { cacheSet(key, data); if (alive) setState({ data, loading: false }); },
      (err: unknown) => { if (alive) setState({ error: err instanceof Error ? err.message : String(err), loading: false }); },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, key, tick]);

  return { ...state, reload: () => { cacheDelete(key); setTick((t) => t + 1); } };
}
