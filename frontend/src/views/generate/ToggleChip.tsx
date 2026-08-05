export function ToggleChip({ label, on, onToggle, disabled }: { label: string; on: boolean; onToggle: () => void; disabled: boolean }) {
  return <button className={`gchip ${on ? "on" : ""}`} disabled={disabled} onClick={onToggle}>{label}</button>;
}
