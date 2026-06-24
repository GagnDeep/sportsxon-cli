/**
 * Contract payout mechanics. Buying `stake` dollars of YES at `price`
 * (probability/cost, $1 payout) gives `stake/price` contracts. Mirrors the web
 * PayoutCalculator.
 */
export interface PayoutResult {
  price: number;
  stake: number;
  contracts: number;
  maxPayout: number; // if YES
  profitIfYes: number;
  profitIfNo: number; // = -stake
  roi: number; // profitIfYes / stake
  breakEvenProb: number; // == price
}

export function payout(price: number, stake: number): PayoutResult {
  const c = Math.min(0.999, Math.max(0.001, price));
  const s = Math.max(0, stake);
  const contracts = s / c;
  const maxPayout = contracts * 1;
  const profitIfYes = maxPayout - s;
  return {
    price: c,
    stake: s,
    contracts: Number(contracts.toFixed(2)),
    maxPayout: Number(maxPayout.toFixed(2)),
    profitIfYes: Number(profitIfYes.toFixed(2)),
    profitIfNo: Number((-s).toFixed(2)),
    roi: s > 0 ? Number((profitIfYes / s).toFixed(4)) : 0,
    breakEvenProb: c,
  };
}
