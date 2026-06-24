import crypto from "node:crypto";
import { CliError, ExitCode } from "../../lib/exit";
import { getKalshiCreds, type KalshiCreds } from "../config/credentials";
import type { FeeConfig } from "../quant/fees";
import { KalshiMarketData, KALSHI_HOSTS } from "./kalshi-data";
import { kalshiAuthHeaders } from "./kalshi-sign";
import type {
  Balance,
  Exchange,
  Fill,
  MarketQuery,
  MarketRef,
  Orderbook,
  OrderResult,
  PlaceOrderParams,
  Position,
  TradeMode,
} from "./types";

export interface ExchangeOptions {
  feeCfg?: FeeConfig;
}

/** Build a live/demo Kalshi exchange (requires credentials). */
export function createKalshiExchange(mode: TradeMode, opts: ExchangeOptions = {}): Exchange {
  const creds = getKalshiCreds();
  if (!creds) {
    throw new CliError(
      "No Kalshi credentials found.",
      ExitCode.AUTH,
      "Run `sportsxon login --venue kalshi --kalshi-key-id <id> --kalshi-key-file <path>`.",
    );
  }
  const base = mode === "demo" ? KALSHI_HOSTS.demo : KALSHI_HOSTS.live;
  return new KalshiExchange(creds, base, mode);
}

class KalshiExchange implements Exchange {
  readonly venue = "kalshi" as const;
  private readonly data: KalshiMarketData;

  constructor(
    private readonly creds: KalshiCreds,
    private readonly base: string,
    readonly mode: TradeMode,
  ) {
    this.data = new KalshiMarketData(base);
  }

  listMarkets(q?: MarketQuery): Promise<MarketRef[]> {
    return this.data.listMarkets(q);
  }
  getMarket(id: string): Promise<MarketRef> {
    return this.data.getMarket(id);
  }
  getOrderbook(id: string): Promise<Orderbook> {
    return this.data.getOrderbook(id);
  }

  private async authed<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const apiPath = new URL(this.base).pathname + endpoint; // e.g. /trade-api/v2/portfolio/orders
    const url = this.base + endpoint;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      ...kalshiAuthHeaders(this.creds.apiKeyId, this.creds.privateKeyPem, method, apiPath),
    };
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new CliError("Kalshi rejected the credentials (401/403).", ExitCode.AUTH, "Check your API key id and private key.");
    }
    if (res.status === 429) throw new CliError("Kalshi rate limit hit.", ExitCode.RATE_LIMIT, "Slow down and retry.");
    if (!res.ok) throw new CliError(`Kalshi API error (HTTP ${res.status}): ${text.slice(0, 200)}`, ExitCode.GENERIC);
    return (text ? JSON.parse(text) : {}) as T;
  }

  async placeOrder(p: PlaceOrderParams): Promise<OrderResult> {
    const priceCents = p.limitPrice != null ? Math.round(p.limitPrice * 100) : undefined;
    const body: Record<string, unknown> = {
      ticker: p.marketId,
      action: p.side === "BUY" ? "buy" : "sell",
      side: p.outcome === "YES" ? "yes" : "no",
      count: Math.round(p.quantity),
      type: p.type === "LIMIT" ? "limit" : "market",
      client_order_id: p.clientOrderId ?? crypto.randomUUID(),
      time_in_force: p.tif === "IOC" ? "immediate_or_cancel" : p.tif === "FOK" ? "fill_or_kill" : undefined,
    };
    if (p.type === "LIMIT" && priceCents != null) {
      if (p.outcome === "YES") body.yes_price = priceCents;
      else body.no_price = priceCents;
    }
    const resp = await this.authed<{ order?: Record<string, unknown> }>("POST", "/portfolio/orders", body);
    const order = resp.order ?? {};
    const status = String(order.status ?? "resting");
    return {
      orderId: String(order.order_id ?? body.client_order_id),
      venue: "kalshi",
      mode: this.mode,
      status: status === "executed" || status === "filled" ? "filled" : status === "resting" ? "resting" : "partial",
      filledQty: Number(order.taker_fill_count ?? order.fill_count ?? 0),
      avgPrice: p.limitPrice ?? null,
      feeUsd: Number(order.taker_fees ?? 0) / 100,
      costUsd: 0,
      raw: order,
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.authed("DELETE", `/portfolio/orders/${encodeURIComponent(orderId)}`);
  }

  async getPositions(): Promise<Position[]> {
    const resp = await this.authed<{ market_positions?: Array<Record<string, unknown>> }>("GET", "/portfolio/positions");
    return (resp.market_positions ?? [])
      .filter((m) => Number(m.position ?? 0) !== 0)
      .map((m) => {
        const net = Number(m.position ?? 0);
        const qty = Math.abs(net);
        const exposure = Number(m.market_exposure ?? 0) / 100; // dollars
        return {
          venue: "kalshi" as const,
          marketId: String(m.ticker ?? ""),
          outcome: net >= 0 ? ("YES" as const) : ("NO" as const),
          quantity: qty,
          avgPrice: qty > 0 ? Number((exposure / qty).toFixed(4)) : 0,
        };
      });
  }

  async getBalance(): Promise<Balance> {
    const resp = await this.authed<{ balance?: number }>("GET", "/portfolio/balance");
    return { venue: "kalshi", mode: this.mode, cashUsd: Number(resp.balance ?? 0) / 100 };
  }

  async getFills(): Promise<Fill[]> {
    const resp = await this.authed<{ fills?: Array<Record<string, unknown>> }>("GET", "/portfolio/fills");
    return (resp.fills ?? []).map((f) => ({
      orderId: String(f.order_id ?? ""),
      venue: "kalshi" as const,
      marketId: String(f.ticker ?? ""),
      outcome: String(f.side ?? "yes").toUpperCase() === "NO" ? ("NO" as const) : ("YES" as const),
      side: String(f.action ?? "buy").toUpperCase() === "SELL" ? ("SELL" as const) : ("BUY" as const),
      price: Number(f.yes_price ?? f.no_price ?? 0) / 100,
      quantity: Number(f.count ?? 0),
      feeUsd: Number(f.fee ?? 0) / 100,
      ts: f.created_time ? new Date(String(f.created_time)).getTime() : Date.now(),
    }));
  }
}
