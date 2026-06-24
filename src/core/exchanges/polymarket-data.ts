import { httpJson, maybeJsonArray, num } from "./http";
import type { MarketDataSource, MarketQuery, MarketRef, Orderbook, OrderbookLevel } from "./types";

export const POLY_HOSTS = {
  gamma: "https://gamma-api.polymarket.com",
  clob: "https://clob.polymarket.com",
} as const;

interface GammaMarket {
  question?: string;
  slug?: string;
  conditionId?: string;
  clobTokenIds?: string;
  outcomePrices?: string;
  volume?: string | number;
  liquidity?: string | number;
  endDate?: string;
  negRisk?: boolean;
  closed?: boolean;
}

function toRef(m: GammaMarket): MarketRef | null {
  const tokenIds = maybeJsonArray(m.clobTokenIds) as string[] | null;
  if (!tokenIds || tokenIds.length === 0) return null;
  const prices = (maybeJsonArray(m.outcomePrices) as string[] | null) ?? [];
  return {
    venue: "polymarket",
    id: String(tokenIds[0]),
    ticker: m.conditionId,
    question: m.question ?? m.slug ?? String(tokenIds[0]),
    yesPrice: num(prices[0]),
    noPrice: num(prices[1]),
    volumeUsd: num(m.volume),
    liquidityUsd: num(m.liquidity),
    closeTime: m.endDate ?? null,
    negRisk: m.negRisk,
    url: m.slug ? `https://polymarket.com/event/${m.slug}` : undefined,
  };
}

/** Public (no-auth) Polymarket market data: Gamma for discovery, CLOB for book. */
export class PolymarketMarketData implements MarketDataSource {
  readonly venue = "polymarket" as const;
  constructor(
    private readonly gamma: string = POLY_HOSTS.gamma,
    private readonly clob: string = POLY_HOSTS.clob,
  ) {}

  async listMarkets(q?: MarketQuery): Promise<MarketRef[]> {
    const want = q?.limit ?? 25;
    const fetchN = q?.q ? 500 : Math.min(want, 200);
    const arr = await httpJson<GammaMarket[]>(
      `${this.gamma}/markets?closed=false&active=true&limit=${fetchN}&order=volume24hr&ascending=false`,
    );
    let refs = arr.map(toRef).filter((r): r is MarketRef => r !== null);
    if (q?.q) {
      const needle = q.q.toLowerCase();
      refs = refs.filter((m) => m.question.toLowerCase().includes(needle));
    }
    return refs.slice(0, want);
  }

  async getMarket(id: string): Promise<MarketRef> {
    // `id` is a CLOB token id; resolve via the Gamma lookup by token.
    const arr = await httpJson<GammaMarket[]>(`${this.gamma}/markets?clob_token_ids=${encodeURIComponent(id)}`);
    const ref = arr.map(toRef).find((r): r is MarketRef => r !== null);
    if (ref) return ref;
    // Fall back to a minimal ref from the CLOB price endpoint.
    const price = await httpJson<{ price?: string }>(`${this.clob}/price?token_id=${encodeURIComponent(id)}&side=buy`);
    return {
      venue: "polymarket",
      id,
      question: id,
      yesPrice: num(price.price),
      noPrice: num(price.price) != null ? Number((1 - (num(price.price) as number)).toFixed(4)) : null,
    };
  }

  async getOrderbook(id: string): Promise<Orderbook> {
    const ob = await httpJson<{ bids?: { price: string; size: string }[]; asks?: { price: string; size: string }[] }>(
      `${this.clob}/book?token_id=${encodeURIComponent(id)}`,
    );
    const map = (lv: { price: string; size: string }[] | undefined): OrderbookLevel[] =>
      (lv ?? []).map((l) => ({ price: Number(l.price), size: Number(l.size) })).filter((l) => Number.isFinite(l.price));
    const bids = map(ob.bids).sort((a, b) => b.price - a.price);
    const asks = map(ob.asks).sort((a, b) => a.price - b.price);
    return { venue: "polymarket", marketId: id, bids, asks, ts: Date.now() };
  }
}
