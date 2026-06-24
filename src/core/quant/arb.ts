/**
 * Two-leg binary arbitrage. Buy YES at `yesCost` on one venue and NO at
 * `noCost` on another (each a probability/cost in dollars for a $1 payout). If
 * the costs sum to < $1 the position is risk-free; we size the legs so both
 * outcomes pay the same. Mirrors the web ArbCalculator.
 */
export interface ArbResult {
  yesCost: number;
  noCost: number;
  sumCost: number; // < 1 => arbitrage exists
  isArb: boolean;
  totalStake: number;
  yesStake: number;
  noStake: number;
  payout: number; // guaranteed payout if arb
  profit: number;
  roi: number; // profit / totalStake
}

export function arbitrage(yesCost: number, noCost: number, totalStake = 100): ArbResult {
  const a = Math.min(0.999, Math.max(0.001, yesCost));
  const b = Math.min(0.999, Math.max(0.001, noCost));
  const sum = a + b;
  const stake = Math.max(0, totalStake);
  // Allocate inversely to cost so each leg returns the same amount.
  const yesStake = stake * (b / sum);
  const noStake = stake * (a / sum);
  const payout = yesStake / a; // == noStake / b
  const profit = payout - stake;
  return {
    yesCost: a,
    noCost: b,
    sumCost: Number(sum.toFixed(4)),
    isArb: sum < 1,
    totalStake: stake,
    yesStake: Number(yesStake.toFixed(2)),
    noStake: Number(noStake.toFixed(2)),
    payout: Number(payout.toFixed(2)),
    profit: Number(profit.toFixed(2)),
    roi: stake > 0 ? Number((profit / stake).toFixed(4)) : 0,
  };
}
