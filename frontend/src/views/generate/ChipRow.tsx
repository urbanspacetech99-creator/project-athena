export function ChipRow<T extends string>({ options, value, onPick, disabled }: {
  options: readonly T[]; value: T; onPick: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div className="gchip-row">
      {options.map((o) => (
        <button key={o} className={`gchip ${value === o ? "on" : ""}`}
          onClick={() => onPick(o)} disabled={disabled}>{o}</button>
      ))}
    </div>
  );
}
