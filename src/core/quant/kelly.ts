import { clampProb } from "./odds";

/**
 * Kelly stake sizing for a binary contract. `fairProb` is your estimate of the
 * true probability; `price` is the contract price as a probability (cost in $
 * for a $1 payout). Mirrors the web KellyCalculator: full Kelly maximises
 * long-run growth, fractional Kelly trades a little growth for much less
 * variance. Returns 0 when there is no edge.
 */
export interface KellyResult {
  fairProb: number;
  price: number;
  edge: number; // fairProb - price
  fullFraction: number; // fraction of bankroll (0 if no edge)
  halfFraction: number;
  quarterFraction: number;
}

export function kelly(fairProb: number, price: number): KellyResult {
  const p = clampProb(fairProb);
  const c = Math.min(0.999, Math.max(0.001, price));
  const b = 1 / c - 1; // net decimal odds
  const q = 1 - p;
  const full = b > 0 ? (b * p - q) / b : 0;
  const clamped = Math.max(0, full);
  return {
    fairProb: p,
    price: c,
    edge: p - c,
    fullFraction: clamped,
    halfFraction: clamped / 2,
    quarterFraction: clamped / 4,
  };
}

export interface KellyStakes extends KellyResult {
  bankroll: number;
  fullStake: number;
  halfStake: number;
  quarterStake: number;
}

export function kellyStakes(fairProb: number, price: number, bankroll: number): KellyStakes {
  const k = kelly(fairProb, price);
  const roll = Math.max(0, bankroll);
  return {
    ...k,
    bankroll: roll,
    fullStake: k.fullFraction * roll,
    halfStake: k.halfFraction * roll,
    quarterStake: k.quarterFraction * roll,
  };
}
