import { CliError, ExitCode } from "../../lib/exit";
import { getPolymarketCreds, type PolymarketCreds } from "../config/credentials";
import { httpJson } from "./http";
import { PolymarketMarketData, POLY_HOSTS } from "./polymarket-data";
import type { ExchangeOptions } from "./kalshi";
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

const POLYGON_CHAIN_ID = 137;
const DATA_API = "https://data-api.polymarket.com";

/** Build a live Polymarket exchange (requires credentials + optional deps). */
export function createPolymarketExchange(mode: TradeMode, _opts: ExchangeOptions = {}): Exchange {
  const creds = getPolymarketCreds();
  if (!creds) {
    throw new CliError(
      "No Polymarket credentials found.",
      ExitCode.AUTH,
      "Run `sportsxon login --venue polymarket --polymarket-key 0x...`.",
    );
  }
  if (mode === "demo") {
    throw new CliError("Polymarket has no demo environment — use paper mode to simulate.", ExitCode.USAGE);
  }
  return new PolymarketExchange(creds, mode);
}

/** Lazily load viem + the CLOB SDK so they remain optional dependencies. */
async function loadSdk(): Promise<{
  ClobClient: any;
  Side: any;
  OrderType: any;
  SignatureType: any;
  createWalletClient: any;
  http: any;
  privateKeyToAccount: any;
  polygon: any;
}> {
  try {
    const clob: any = await import("@polymarket/clob-client");
    const viem: any = await import("viem");
    const accounts: any = await import("viem/accounts");
    const chains: any = await import("viem/chains");
    return {
      ClobClient: clob.ClobClient,
      Side: clob.Side ?? clob.OrderSide,
      OrderType: clob.OrderType,
      SignatureType: clob.SignatureType,
      createWalletClient: viem.createWalletClient,
      http: viem.http,
      privateKeyToAccount: accounts.privateKeyToAccount,
      polygon: chains.polygon,
    };
  } catch (e) {
    throw new CliError(
      "Live Polymarket trading needs the optional deps `@polymarket/clob-client` and `viem`.",
      ExitCode.GENERIC,
      "Install them: npm i -g @polymarket/clob-client viem",
    );
  }
}

class PolymarketExchange implements Exchange {
  readonly venue = "polymarket" as const;
  private readonly data = new PolymarketMarketData();
  private client: any | null = null;
  private address: string | null = null;

  constructor(
    private readonly creds: PolymarketCreds,
    readonly mode: TradeMode,
  ) {}

  listMarkets(q?: MarketQuery): Promise<MarketRef[]> {
    return this.data.listMarkets(q);
  }
  getMarket(id: string): Promise<MarketRef> {
    return this.data.getMarket(id);
  }
  getOrderbook(id: string): Promise<Orderbook> {
    return this.data.getOrderbook(id);
  }

  /** Construct (once) an authenticated CLOB client, deriving L2 creds if needed. */
  private async ensureClient(): Promise<any> {
    if (this.client) return this.client;
    const sdk = await loadSdk();
    const pk = (this.creds.privateKey.startsWith("0x") ? this.creds.privateKey : `0x${this.creds.privateKey}`) as `0x${string}`;
    const account = sdk.privateKeyToAccount(pk);
    this.address = account.address;
    const wallet = sdk.createWalletClient({ account, chain: sdk.polygon, transport: sdk.http() });

    let apiCreds =
      this.creds.apiKey && this.creds.apiSecret && this.creds.apiPassphrase
        ? { key: this.creds.apiKey, secret: this.creds.apiSecret, passphrase: this.creds.apiPassphrase }
        : undefined;
    if (!apiCreds) {
      // Derive L2 creds from the wallet (L1 signature).
      const l1 = new sdk.ClobClient(POLY_HOSTS.clob, POLYGON_CHAIN_ID, wallet);
      apiCreds = await l1.createOrDeriveApiKey?.() ?? (await l1.deriveApiKey());
    }
    const sigType = sdk.SignatureType?.EOA ?? 0;
    this.client = new sdk.ClobClient(POLY_HOSTS.clob, POLYGON_CHAIN_ID, wallet, apiCreds, sigType, account.address);
    return this.client;
  }

  async placeOrder(p: PlaceOrderParams): Promise<OrderResult> {
    const sdk = await loadSdk();
    const client = await this.ensureClient();
    const side = p.side === "BUY" ? sdk.Side.BUY : sdk.Side.SELL;
    // On Polymarket the token id encodes the outcome; we trade the given token.
    try {
      let signed: any;
      if (p.type === "MARKET") {
        signed = await client.createMarketOrder({ tokenID: p.marketId, side, size: p.quantity });
      } else {
        signed = await client.createOrder({ tokenID: p.marketId, price: p.limitPrice, size: p.quantity, side });
      }
      const orderType = p.tif === "FOK" ? sdk.OrderType?.FOK : p.tif === "IOC" ? sdk.OrderType?.FAK : sdk.OrderType?.GTC;
      const resp = await client.postOrder(signed, orderType);
      return {
        orderId: String(resp?.orderID ?? resp?.orderId ?? signed?.orderID ?? "unknown"),
        venue: "polymarket",
        mode: this.mode,
        status: resp?.success === false ? "rejected" : "resting",
        filledQty: Number(resp?.matchedAmount ?? 0),
        avgPrice: p.limitPrice ?? null,
        feeUsd: 0,
        costUsd: 0,
        message: resp?.errorMsg ? String(resp.errorMsg) : undefined,
        raw: resp,
      };
    } catch (e) {
      throw new CliError(`Polymarket order failed: ${(e as Error).message}`, ExitCode.GENERIC, "Check funding, allowances and that the market is open.");
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    const client = await this.ensureClient();
    await client.cancelOrder({ orderID: orderId });
  }

  async getPositions(): Promise<Position[]> {
    await this.ensureClient();
    if (!this.address) return [];
    const rows = await httpJson<Array<Record<string, unknown>>>(`${DATA_API}/positions?user=${this.address}`);
    return (rows ?? [])
      .filter((r) => Number(r.size ?? 0) !== 0)
      .map((r) => ({
        venue: "polymarket" as const,
        marketId: String(r.asset ?? r.tokenId ?? ""),
        question: typeof r.title === "string" ? r.title : undefined,
        outcome: String(r.outcome ?? "Yes").toUpperCase() === "NO" ? ("NO" as const) : ("YES" as const),
        quantity: Number(r.size ?? 0),
        avgPrice: Number(r.avgPrice ?? 0),
      }));
  }

  async getBalance(): Promise<Balance> {
    const client = await this.ensureClient();
    try {
      const ba = await client.getBalanceAllowance({ asset_type: "COLLATERAL" });
      const raw = Number(ba?.balance ?? 0);
      // USDC has 6 decimals on Polygon.
      return { venue: "polymarket", mode: this.mode, cashUsd: raw > 1e6 ? raw / 1e6 : raw };
    } catch {
      return { venue: "polymarket", mode: this.mode, cashUsd: 0 };
    }
  }

  async getFills(): Promise<Fill[]> {
    const client = await this.ensureClient();
    const trades: any[] = (await client.getTrades?.()) ?? [];
    return trades.map((t) => ({
      orderId: String(t.id ?? t.order_id ?? ""),
      venue: "polymarket" as const,
      marketId: String(t.asset_id ?? t.market ?? ""),
      outcome: "YES" as const,
      side: String(t.side ?? "BUY").toUpperCase() === "SELL" ? ("SELL" as const) : ("BUY" as const),
      price: Number(t.price ?? 0),
      quantity: Number(t.size ?? 0),
      feeUsd: Number(t.fee ?? 0),
      ts: t.match_time ? new Date(String(t.match_time)).getTime() : Date.now(),
    }));
  }
}
