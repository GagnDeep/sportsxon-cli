import pc from "picocolors";

export interface Column<T> {
  header: string;
  get: (row: T) => string;
  align?: "left" | "right";
  /** Optional per-cell colorizer applied only when color is enabled. */
  paint?: (value: string, row: T) => string;
}

// --- display width (so flag/emoji/CJK columns align) -----------------------
const seg = new Intl.Segmenter("en", { granularity: "grapheme" });

function clusterWidth(cluster: string): number {
  const cp = cluster.codePointAt(0);
  if (cp === undefined) return 0;
  if (cp === 0x200d || (cp >= 0x0300 && cp <= 0x036f)) return 0; // ZWJ / combining marks
  if (
    (cp >= 0x1f1e6 && cp <= 0x1f1ff) || // regional indicators (flags)
    (cp >= 0x1f300 && cp <= 0x1faff) || // emoji
    (cp >= 0x2600 && cp <= 0x27bf) || // misc symbols & dingbats
    (cp >= 0x1100 && cp <= 0x115f) || // hangul jamo
    (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK
    (cp >= 0xac00 && cp <= 0xd7a3) || // hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat
    (cp >= 0xff00 && cp <= 0xff60) || // fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6)
  ) {
    return 2;
  }
  return 1;
}

export function displayWidth(s: string): number {
  let w = 0;
  for (const { segment } of seg.segment(s)) w += clusterWidth(segment);
  return w;
}

function pad(s: string, target: number, align?: "left" | "right"): string {
  const gap = Math.max(0, target - displayWidth(s));
  const spaces = " ".repeat(gap);
  return align === "right" ? spaces + s : s + spaces;
}

/** Render an aligned, dependency-free table. */
export function table<T>(rows: T[], columns: Column<T>[], color: boolean): string {
  if (rows.length === 0) return color ? pc.dim("(none)") : "(none)";

  const raw = rows.map((r) => columns.map((c) => c.get(r) ?? ""));
  const widths = columns.map((c, i) =>
    Math.max(displayWidth(c.header), ...raw.map((row) => displayWidth(row[i] ?? ""))),
  );

  const headerCells = columns.map((c, i) => {
    const h = pad(c.header, widths[i]!, c.align);
    return color ? pc.bold(pc.cyan(h)) : h;
  });
  const sep = columns.map((_, i) => "─".repeat(widths[i]!)).join("  ");

  const bodyLines = raw.map((row, ri) =>
    columns
      .map((c, i) => {
        const padded = pad(row[i] ?? "", widths[i]!, c.align);
        return color && c.paint ? c.paint(padded, rows[ri]!) : padded;
      })
      .join("  "),
  );

  return [headerCells.join("  "), color ? pc.dim(sep) : sep, ...bodyLines].join("\n");
}

/** Render a label/value detail block. */
export function keyValues(pairs: [string, string][], color: boolean): string {
  const w = Math.max(0, ...pairs.map(([k]) => k.length));
  return pairs
    .map(([k, v]) => {
      const label = k.padEnd(w);
      return `${color ? pc.dim(label) : label}  ${v}`;
    })
    .join("\n");
}
