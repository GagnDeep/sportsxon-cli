import { clampProb } from "./odds";

/**
 * Remove the bookmaker's vig (overround) from a set of implied probabilities to
 * recover fair probabilities that sum to 1. Multiplicative (proportional)
 * method, the most common. Mirrors the web DevigCalculator.
 */
export interface DevigResult {
  raw: number[];
  overround: number; // sum of raw - 1 (the vig)
  fair: number[]; // normalized to sum 1
}

export function devig(impliedProbs: number[]): DevigResult {
  const raw = impliedProbs.map(clampProb);
  const sum = raw.reduce((a, b) => a + b, 0);
  const fair = sum > 0 ? raw.map((p) => p / sum) : raw.slice();
  return {
    raw,
    overround: Number((sum - 1).toFixed(4)),
    fair: fair.map((p) => Number(p.toFixed(4))),
  };
}

/** Convenience: de-vig a two-way market given the two implied probabilities. */
export function devigTwoWay(probA: number, probB: number): { fairA: number; fairB: number; overround: number } {
  const r = devig([probA, probB]);
  return { fairA: r.fair[0]!, fairB: r.fair[1]!, overround: r.overround };
}
