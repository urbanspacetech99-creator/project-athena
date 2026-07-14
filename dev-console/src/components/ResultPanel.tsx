export function ResultPanel({ loading, error, data }:
  { loading: boolean; error: string | null; data: unknown }) {
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="err">Error: {error}</p>;
  if (data === undefined || data === null) return null;
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
