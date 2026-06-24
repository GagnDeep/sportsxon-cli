import { httpJson } from "./http";
import type { MarketDataSource, MarketQuery, MarketRef, Orderbook, OrderbookLevel } from "./types";

export const KALSHI_HOSTS = {
  live: "https://api.elections.kalshi.com/trade-api/v2",
  demo: "https://demo-api.kalshi.co/trade-api/v2",
} as const;

interface KalshiMarket {
  ticker: string;
  title?: string;
  subtitle?: string;
  yes_ask?: number;
  yes_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume?: number;
  close_time?: string;
  status?: string;
}

const cents = (c: number | undefined): number | null => (typeof c === "number" ? c / 100 : null);

function toRef(m: KalshiMarket): MarketRef {
  const yes = cents(m.yes_ask) ?? cents(m.last_price);
  return {
    venue: "kalshi",
    id: m.ticker,
    ticker: m.ticker,
    question: [m.title, m.subtitle].filter(Boolean).join(" — ") || m.ticker,
    yesPrice: yes,
    noPrice: yes != null ? Number((1 - yes).toFixed(4)) : null,
    volumeUsd: typeof m.volume === "number" ? m.volume : null,
    closeTime: m.close_time ?? null,
    url: `https://kalshi.com/markets/${m.ticker}`,
  };
}

/**
 * Public (no-auth) Kalshi market data. The orderbook arrives as resting YES and
 * NO bids in cents; we fold the NO side into YES-equivalent asks so every venue
 * exposes a single YES book.
 */
export class KalshiMarketData implements MarketDataSource {
  readonly venue = "kalshi" as const;
  constructor(private readonly base: string = KALSHI_HOSTS.live) {}

  async listMarkets(q?: MarketQuery): Promise<MarketRef[]> {
    const want = q?.limit ?? 25;
    const fetchN = q?.q ? 1000 : Math.min(want, 200);
    const data = await httpJson<{ markets: KalshiMarket[] }>(`${this.base}/markets?limit=${fetchN}&status=open`);
    let refs = (data.markets ?? []).map(toRef);
    if (q?.q) {
      const needle = q.q.toLowerCase();
      refs = refs.filter((m) => m.question.toLowerCase().includes(needle) || m.id.toLowerCase().includes(needle));
    }
    return refs.slice(0, want);
  }

  async getMarket(id: string): Promise<MarketRef> {
    const data = await httpJson<{ market: KalshiMarket }>(`${this.base}/markets/${encodeURIComponent(id)}`);
    return toRef(data.market);
  }

  async getOrderbook(id: string): Promise<Orderbook> {
    const data = await httpJson<{ orderbook: { yes?: [number, number][]; no?: [number, number][] } }>(
      `${this.base}/markets/${encodeURIComponent(id)}/orderbook`,
    );
    const ob = data.orderbook ?? {};
    const bids: OrderbookLevel[] = (ob.yes ?? []).map(([p, s]) => ({ price: p / 100, size: s }));
    // A NO bid at price p is a YES ask at (100 - p).
    const asks: OrderbookLevel[] = (ob.no ?? []).map(([p, s]) => ({ price: (100 - p) / 100, size: s }));
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);
    return { venue: "kalshi", marketId: id, bids, asks, ts: Date.now() };
  }
}
