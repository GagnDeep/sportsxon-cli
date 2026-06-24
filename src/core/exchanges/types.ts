/**
 * The unified Exchange contract. Kalshi, Polymarket and the paper engine all
 * implement this. Prices are normalized internally to a YES probability in
 * [0,1]; adapters convert at the edges (Kalshi cents 1–99, Polymarket decimal).
 */

export type Venue = "kalshi" | "polymarket";
export const VENUES: readonly Venue[] = ["kalshi", "polymarket"];

/** paper = simulated; demo = venue sandbox (fake funds); live = real money. */
export type TradeMode = "paper" | "demo" | "live";

export type Outcome = "YES" | "NO";
export type Side = "BUY" | "SELL";
export type OrderType = "LIMIT" | "MARKET";
export type Tif = "GTC" | "IOC" | "FOK";

export interface MarketRef {
  venue: Venue;
  id: string; // venue order/token id used for trading
  ticker?: string;
  question: string;
  yesPrice: number | null; // probability 0..1
  noPrice: number | null; // probability 0..1
  volumeUsd?: number | null;
  liquidityUsd?: number | null;
  closeTime?: string | null;
  negRisk?: boolean;
  url?: string;
}

export interface OrderbookLevel {
  price: number; // YES probability 0..1
  size: number; // contracts/shares available
}

export interface Orderbook {
  venue: Venue;
  marketId: string;
  bids: OrderbookLevel[]; // descending price
  asks: OrderbookLevel[]; // ascending price
  ts: number;
}

export interface PlaceOrderParams {
  marketId: string;
  side: Side;
  outcome: Outcome;
  type: OrderType;
  limitPrice?: number; // probability 0..1 (required for LIMIT)
  quantity: number; // contracts/shares
  tif?: Tif;
  clientOrderId?: string;
}

export interface OrderResult {
  orderId: string;
  venue: Venue;
  mode: TradeMode;
  status: "filled" | "partial" | "resting" | "rejected" | "simulated";
  filledQty: number;
  avgPrice: number | null; // probability 0..1
  feeUsd: number;
  costUsd: number; // signed: positive = cash out (buy), negative = cash in (sell)
  message?: string;
  raw?: unknown;
}

export interface Position {
  venue: Venue;
  marketId: string;
  question?: string;
  outcome: Outcome;
  quantity: number;
  avgPrice: number; // probability 0..1
}

export interface Balance {
  venue: Venue;
  mode: TradeMode;
  cashUsd: number;
}

export interface Fill {
  orderId: string;
  venue: Venue;
  marketId: string;
  outcome: Outcome;
  side: Side;
  price: number; // probability 0..1
  quantity: number;
  feeUsd: number;
  ts: number;
}

export interface MarketQuery {
  q?: string;
  limit?: number;
  cursor?: string;
}

/** Read-only market data — available on every adapter without credentials. */
export interface MarketDataSource {
  readonly venue: Venue;
  listMarkets(q?: MarketQuery): Promise<MarketRef[]>;
  getMarket(id: string): Promise<MarketRef>;
  getOrderbook(id: string): Promise<Orderbook>;
}

/** Full trading surface (paper or real). */
export interface Exchange extends MarketDataSource {
  readonly mode: TradeMode;
  placeOrder(p: PlaceOrderParams): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  getPositions(): Promise<Position[]>;
  getBalance(): Promise<Balance>;
  getFills(): Promise<Fill[]>;
}
