import { clampProb } from "./odds";

/**
 * Expected value of buying a binary YES contract at `price` (probability/cost)
 * when your fair estimate is `fairProb`. A contract pays $1 if it resolves YES.
 */
export interface EvResult {
  fairProb: number;
  price: number; // implied probability of the price
  edge: number; // fairProb - price
  evPerContract: number; // dollars
  evPer100: number; // dollars of EV per $100 staked
  positive: boolean;
}

export function expectedValue(fairProb: number, price: number): EvResult {
  const p = clampProb(fairProb);
  const c = Math.min(0.999, Math.max(0.001, price));
  const evPerContract = p * 1 - c; // win $ (1 - c) w.p. p, lose c w.p. (1-p)  => p - c
  const evPer100 = (evPerContract / c) * 100;
  return {
    fairProb: p,
    price: c,
    edge: p - c,
    evPerContract: Number(evPerContract.toFixed(4)),
    evPer100: Number(evPer100.toFixed(2)),
    positive: evPerContract > 0,
  };
}
