/** 2500000 -> "2.5M", 11800 -> "11.8k", 1000 -> "1k", 950 -> "950". */
export const fmt = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
      : n.toLocaleString();
