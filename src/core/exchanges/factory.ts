import { KalshiMarketData } from "./kalshi-data";
import { PolymarketMarketData } from "./polymarket-data";
import { PaperExchange } from "./paper";
import type { Exchange, MarketDataSource, TradeMode, Venue } from "./types";
import type { ExchangeOptions } from "./kalshi";

/** Public market data for a venue (no credentials needed). */
export function marketData(venue: Venue): MarketDataSource {
  return venue === "polymarket" ? new PolymarketMarketData() : new KalshiMarketData();
}

/**
 * Build a full trading Exchange. Paper (the default) wraps live market data with
 * a simulated portfolio. live/demo lazily load the real adapters.
 */
export async function exchange(venue: Venue, mode: TradeMode, opts: ExchangeOptions = {}): Promise<Exchange> {
  if (mode === "paper") return new PaperExchange(marketData(venue), opts.feeCfg);
  if (venue === "kalshi") {
    const m = await import("./kalshi");
    return m.createKalshiExchange(mode, opts);
  }
  const m = await import("./polymarket");
  return m.createPolymarketExchange(mode, opts);
}
