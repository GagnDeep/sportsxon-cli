import { clampProb } from "./odds";

/**
 * Closing-line value: how much better your entry was than the closing price.
 * For a YES position, the line moving up (closeProb > entryProb) is positive
 * CLV — the market came to agree with you. Beating the close is the single best
 * predictor of long-run edge.
 */
export interface ClvResult {
  entryProb: number;
  closeProb: number;
  deltaProb: number; // close - entry
  pctMove: number; // relative move vs entry price
  beatClose: boolean;
}

export function clv(entryProb: number, closeProb: number): ClvResult {
  const e = clampProb(entryProb);
  const c = clampProb(closeProb);
  return {
    entryProb: e,
    closeProb: c,
    deltaProb: Number((c - e).toFixed(4)),
    pctMove: e > 0 ? Number(((c - e) / e).toFixed(4)) : 0,
    beatClose: c > e,
  };
}
