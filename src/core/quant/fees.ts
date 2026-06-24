import type { Venue } from "../exchanges/types";

/** Round a dollar amount up to the next whole cent. */
function ceilCent(usd: number): number {
  return Math.ceil(usd * 100) / 100;
}

/**
 * Kalshi trading fee: ceil(rate × contracts × price × (1 − price)), rounded up
 * to the next cent. Default rate 0.07 (verify the live schedule before trusting
 * real P&L — it has changed before).
 */
export function kalshiFee(contracts: number, price: number, rate = 0.07): number {
  return ceilCent(rate * contracts * price * (1 - price));
}

/** Polymarket fee: operator-set bps on notional. Default 0 (configurable). */
export function polymarketFee(contracts: number, price: number, bps = 0): number {
  return ceilCent((contracts * price * bps) / 10_000);
}

export interface FeeConfig {
  kalshiRate?: number;
  polymarketBps?: number;
}

/** Estimate the fee for a fill on a venue. */
export function estimateFee(venue: Venue, contracts: number, price: number, cfg: FeeConfig = {}): number {
  return venue === "kalshi"
    ? kalshiFee(contracts, price, cfg.kalshiRate ?? 0.07)
    : polymarketFee(contracts, price, cfg.polymarketBps ?? 0);
}
