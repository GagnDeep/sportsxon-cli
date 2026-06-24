/**
 * A single, cohesive theme for the interactive TUI. Centralising colours, glyphs
 * and small format helpers keeps every screen visually consistent and makes the
 * whole app re-skinnable from one place.
 */

export const theme = {
  color: {
    brand: "green",
    accent: "cyan",
    accent2: "magenta",
    muted: "gray",
    text: "white",
    yes: "green",
    no: "red",
    warn: "yellow",
    danger: "red",
    info: "blue",
    bidColor: "green",
    askColor: "red",
  },
  /** Border colour for the active/focused panel vs idle panels. */
  border: {
    active: "cyan",
    idle: "gray",
    brand: "green",
    danger: "red",
  },
} as const;

export const glyph = {
  ball: "⚽",
  live: "●",
  up: "▲",
  down: "▼",
  bar: "█",
  half: "▌",
  dot: "·",
  arrowR: "→",
  check: "✓",
  cross: "✗",
  warn: "⚠",
  spark: "▁▂▃▄▅▆▇█",
} as const;

/** Money, always two decimals with a sign-free `$`. */
export function usd(n: number): string {
  const v = Math.abs(n) >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(2);
  return `$${v}`;
}

/** Signed money for P&L (`+$12.30` / `-$4.00`). */
export function signedUsd(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/** Probability (0..1) → cents string (`63¢`). */
export function cents(p: number | null | undefined): string {
  return p == null ? "—" : `${Math.round(p * 100)}¢`;
}

/** Probability (0..1) → percent string (`63%`). */
export function pct(p: number | null | undefined, digits = 1): string {
  return p == null ? "—" : `${(p * 100).toFixed(digits)}%`;
}

export function pnlColor(n: number): "green" | "red" | "gray" {
  if (n > 0) return "green";
  if (n < 0) return "red";
  return "gray";
}

/** Compact large dollar volume (`$1.2M`, `$340K`). */
export function compactUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

/** Truncate to a hard width with an ellipsis. */
export function clip(s: string, width: number): string {
  if (s.length <= width) return s;
  return width <= 1 ? s.slice(0, width) : s.slice(0, width - 1) + "…";
}
