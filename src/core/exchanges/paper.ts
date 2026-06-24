import { CliError, ExitCode } from "../../lib/exit";
import { loadPaper, savePaper } from "../paper/store";
import { applyPaperOrder, simulateFill } from "../paper/engine";
import type { FeeConfig } from "../quant/fees";
import type {
  Balance,
  Exchange,
  Fill,
  MarketDataSource,
  MarketQuery,
  MarketRef,
  Orderbook,
  OrderResult,
  PlaceOrderParams,
  Position,
  Venue,
} from "./types";

/**
 * Paper exchange: real market data + a simulated portfolio persisted to
 * ~/.config/sportsxon/paper.json. Orders fill against the live book.
 */
export class PaperExchange implements Exchange {
  readonly venue: Venue;
  readonly mode = "paper" as const;

  constructor(
    private readonly data: MarketDataSource,
    private readonly feeCfg: FeeConfig = {},
  ) {
    this.venue = data.venue;
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

  async placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
    const state = loadPaper();
    let p = params;
    if (p.side === "SELL") {
      const held =
        state.positions.find((x) => x.venue === this.venue && x.marketId === p.marketId && x.outcome === p.outcome)
          ?.quantity ?? 0;
      if (held <= 0) {
        throw new CliError(`No ${p.outcome} position in ${p.marketId} to sell.`, ExitCode.REFUSED);
      }
      if (p.quantity > held) p = { ...p, quantity: held };
    }
    const book = await this.getOrderbook(p.marketId);
    let question: string | undefined;
    try {
      question = (await this.getMarket(p.marketId)).question;
    } catch {
      /* market metadata is best-effort */
    }
    const sim = simulateFill(book, p);
    const res = applyPaperOrder(state, p, sim, this.venue, question, this.feeCfg, "paper");
    savePaper(state);
    return res;
  }

  async cancelOrder(_orderId: string): Promise<void> {
    throw new CliError(
      "Paper orders fill or are rejected immediately — there is nothing resting to cancel.",
      ExitCode.USAGE,
    );
  }

  async getPositions(): Promise<Position[]> {
    return loadPaper().positions.filter((p) => p.venue === this.venue);
  }

  async getBalance(): Promise<Balance> {
    return { venue: this.venue, mode: "paper", cashUsd: loadPaper().cashUsd };
  }

  async getFills(): Promise<Fill[]> {
    return loadPaper().fills.filter((f) => f.venue === this.venue);
  }
}
