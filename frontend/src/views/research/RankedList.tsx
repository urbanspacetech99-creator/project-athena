export function RankedList({ items, light }: { items: string[]; light?: boolean }) {
  return (
    <>
      {items.map((s, i) => (
        <div className="svc-row" key={i}>
          <div className="svc-top" style={light ? { color: "#fff" } : undefined}>
            <span>#{i + 1} &nbsp; {s}</span>
          </div>
        </div>
      ))}
    </>
  );
}
