import pc from "picocolors";
import type { RunContext } from "../../context";
import type { CommandOutput } from "../../render/headless";
import { table, keyValues, type Column } from "../../render/tables";
import { CliError, ExitCode } from "../../lib/exit";
import { confirmPhrase } from "../../lib/prompt";
import { exchange, marketData } from "../exchanges/factory";
import { simulateFill } from "../paper/engine";
import { loadPaper, resetPaper, DEFAULT_CASH } from "../paper/store";
import { estimateFee } from "../quant/fees";
import { centsToProb } from "../quant/odds";
import { isRiskAccepted, loadSettings, saveSettings, DEFAULTS } from "../config/settings";
import type {
  MarketRef,
  Orderbook,
  Outcome,
  PlaceOrderParams,
  Position,
  Side,
  TradeMode,
  Venue,
} from "../exchanges/types";

const usd = (n: number) => `$${n.toFixed(2)}`;
const cents = (p: number | null | undefined) => (p == null ? "—" : `${Math.round(p * 100)}¢`);
const pnlPaint = (n: number, color: boolean) => (!color ? usd(n) : n >= 0 ? pc.green(usd(n)) : pc.red(usd(n)));

function modeOf(o: { live?: boolean; demo?: boolean }): TradeMode {
  if (o.live) return "live";
  if (o.demo) return "demo";
  return "paper";
}

function outcomeOf(o: { outcome?: string }): Outcome {
  return (o.outcome ?? "yes").toUpperCase() === "NO" ? "NO" : "YES";
}

const LIVE_BANNER =
  "⚠ LIVE trading uses REAL money and is IRREVERSIBLE. You are responsible for compliance " +
  "(Polymarket blocks US persons; Kalshi is US-only/CFTC-regulated), for your jurisdiction's laws, " +
  "and for taxes. This tool is provided as-is, with no warranty and is not financial advice.";

// ---------------------------------------------------------------------------
// Market data (read-only, no creds)
// ---------------------------------------------------------------------------

export async function runMarkets(ctx: RunContext, o: { q?: string; limit?: number }): Promise<CommandOutput> {
  const refs = await marketData(ctx.venue).listMarkets({ q: o.q, limit: o.limit ?? 25 });
  return {
    data: { venue: ctx.venue, markets: refs },
    render: (color) => {
      const cols: Column<MarketRef>[] = [
        { header: "Yes", get: (m) => cents(m.yesPrice), align: "right", paint: (v) => (color ? pc.green(v) : v) },
        { header: "No", get: (m) => cents(m.noPrice), align: "right" },
        { header: "Vol", get: (m) => (m.volumeUsd != null ? `$${Math.round(m.volumeUsd).toLocaleString()}` : "—"), align: "right" },
        { header: "Market", get: (m) => m.question.slice(0, 60) },
        { header: "Id", get: (m) => m.id.slice(0, 22), paint: (v) => (color ? pc.dim(v) : v) },
      ];
      return table(refs, cols, color);
    },
  };
}

export async function runMarket(ctx: RunContext, id: string): Promise<CommandOutput> {
  const m = await marketData(ctx.venue).getMarket(id);
  return {
    data: m,
    render: (color) =>
      keyValues(
        [
          ["Market", m.question],
          ["Venue", m.venue],
          ["YES", cents(m.yesPrice)],
          ["NO", cents(m.noPrice)],
          ["Volume", m.volumeUsd != null ? usd(m.volumeUsd) : "—"],
          ["Closes", m.closeTime ?? "—"],
          ["Id", m.id],
          ...(m.url ? [["URL", m.url] as [string, string]] : []),
        ],
        color,
      ),
  };
}

export async function runBook(ctx: RunContext, id: string): Promise<CommandOutput> {
  const ob = await marketData(ctx.venue).getOrderbook(id);
  return {
    data: ob,
    render: (color) => {
      const rows = Math.max(ob.bids.length, ob.asks.length, 1);
      const lines: string[] = [];
      const head = `${"Bid size".padStart(10)}  ${"Bid".padStart(5)}  │  ${"Ask".padEnd(5)}  ${"Ask size"}`;
      lines.push(color ? pc.bold(pc.cyan(head)) : head);
      for (let i = 0; i < rows; i++) {
        const b = ob.bids[i];
        const a = ob.asks[i];
        const bid = b ? `${String(b.size).padStart(10)}  ${cents(b.price).padStart(5)}` : `${" ".repeat(10)}  ${" ".repeat(5)}`;
        const ask = a ? `${cents(a.price).padEnd(5)}  ${a.size}` : "";
        const bidC = color && b ? pc.green(bid) : bid;
        const askC = color && a ? pc.red(ask) : ask;
        lines.push(`${bidC}  │  ${askC}`);
      }
      return lines.join("\n");
    },
  };
}

export async function runQuote(ctx: RunContext, id: string, o: { outcome?: string; qty?: number }): Promise<CommandOutput> {
  const qty = o.qty ?? 100;
  const outcome = outcomeOf(o);
  const ob = await marketData(ctx.venue).getOrderbook(id);
  const sim = simulateFill(ob, { marketId: id, side: "BUY", outcome, type: "MARKET", quantity: qty });
  const fee = sim.avgPrice != null ? estimateFee(ctx.venue, sim.filledQty, sim.avgPrice) : 0;
  const best = (outcome === "YES" ? ob.asks[0]?.price : ob.bids[0] ? 1 - ob.bids[0].price : null) ?? null;
  const slippage = best != null && sim.avgPrice != null ? sim.avgPrice - best : null;
  return {
    data: {
      venue: ctx.venue,
      marketId: id,
      outcome,
      requestedQty: qty,
      filledQty: sim.filledQty,
      avgPrice: sim.avgPrice,
      bestPrice: best,
      slippage,
      feeUsd: fee,
      costUsd: sim.notionalUsd + fee,
    },
    render: (color) =>
      keyValues(
        [
          ["Buy", `${qty} ${outcome} @ market`],
          ["Filled", `${sim.filledQty}${sim.filledQty < qty ? color ? pc.yellow(" (book too thin)") : " (book too thin)" : ""}`],
          ["Avg price", cents(sim.avgPrice)],
          ["Best price", cents(best)],
          ["Slippage", slippage != null ? `${(slippage * 100).toFixed(2)}¢` : "—"],
          ["Est. fee", usd(fee)],
          ["Est. cost", usd(sim.notionalUsd + fee)],
        ],
        color,
      ),
  };
}

// ---------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------

export interface TradeFlags {
  qty?: number;
  outcome?: string;
  limit?: number;
  live?: boolean;
  demo?: boolean;
  dryRun?: boolean;
  force?: boolean;
  maxUsd?: number;
}

async function enforceLiveGuards(
  ctx: RunContext,
  venue: Venue,
  mode: TradeMode,
  params: PlaceOrderParams,
  estPrice: number,
  o: TradeFlags,
): Promise<void> {
  if (!isRiskAccepted()) {
    throw new CliError(
      "Live trading requires a one-time risk acknowledgement.",
      ExitCode.REFUSED,
      "Run `sportsxon accept-risk` first.",
    );
  }
  const notional = params.quantity * estPrice;
  const cap = o.maxUsd ?? loadSettings().maxOrderUsd ?? DEFAULTS.maxOrderUsd;
  if (notional > cap && !o.force) {
    throw new CliError(
      `Order notional ${usd(notional)} exceeds the ${usd(cap)} cap.`,
      ExitCode.REFUSED,
      "Raise --max-usd, set maxOrderUsd in config, or pass --force.",
    );
  }
  // Typed confirmation.
  if (ctx.interactive && !ctx.yes) {
    process.stderr.write((ctx.color ? pc.yellow(LIVE_BANNER) : LIVE_BANNER) + "\n");
    const ok = await confirmPhrase(
      venue.toUpperCase(),
      `Type ${pc.bold(venue.toUpperCase())} to place this ${mode.toUpperCase()} order: `,
    );
    if (!ok) throw new CliError("Live order cancelled (confirmation did not match).", ExitCode.REFUSED);
  } else if (!ctx.yes) {
    throw new CliError(
      "Refusing to place a live order without confirmation in non-interactive mode.",
      ExitCode.REFUSED,
      "Re-run with --yes to confirm (and you accept the risks).",
    );
  }
}

async function runTrade(ctx: RunContext, side: Side, id: string, o: TradeFlags): Promise<CommandOutput> {
  const mode = modeOf(o);
  const outcome = outcomeOf(o);
  const qty = o.qty;
  if (!qty || qty <= 0) throw new CliError("--qty is required and must be > 0.", ExitCode.USAGE);
  const type = o.limit != null ? "LIMIT" : "MARKET";
  const params: PlaceOrderParams = {
    marketId: id,
    side,
    outcome,
    type,
    limitPrice: o.limit != null ? centsToProb(o.limit) : undefined,
    quantity: qty,
  };

  // Estimate a price for guard + dry-run (limit, else current market).
  let estPrice = params.limitPrice ?? 0.5;
  const md = marketData(ctx.venue);
  if (params.limitPrice == null) {
    try {
      const m = await md.getMarket(id);
      estPrice = (outcome === "YES" ? m.yesPrice : m.noPrice) ?? 0.5;
    } catch {
      /* fall back to 0.5 */
    }
  }

  if (mode !== "paper") await enforceLiveGuards(ctx, ctx.venue, mode, params, estPrice, o);

  if (o.dryRun) {
    const book = await md.getOrderbook(id);
    const sim = simulateFill(book, params);
    const fee = sim.avgPrice != null ? estimateFee(ctx.venue, sim.filledQty, sim.avgPrice) : 0;
    return {
      data: {
        dryRun: true,
        mode,
        venue: ctx.venue,
        params,
        projectedFill: { filledQty: sim.filledQty, avgPrice: sim.avgPrice, status: sim.status, feeUsd: fee, costUsd: sim.notionalUsd + fee },
      },
      render: (color) =>
        `${color ? pc.yellow("DRY RUN") : "DRY RUN"} — ${mode.toUpperCase()} ${side} ${qty} ${outcome} on ${ctx.venue}\n` +
        keyValues(
          [
            ["Type", type + (o.limit != null ? ` @ ${o.limit}¢` : " @ market")],
            ["Would fill", `${sim.filledQty} @ ${cents(sim.avgPrice)} (${sim.status})`],
            ["Est. fee", usd(fee)],
            ["Est. cost", usd(sim.notionalUsd + fee)],
          ],
          color,
        ),
    };
  }

  const ex = await exchange(ctx.venue, mode);
  const res = await ex.placeOrder(params);
  return {
    data: res,
    render: (color) => {
      const tag = mode === "paper" ? (color ? pc.cyan("[PAPER]") : "[PAPER]") : color ? pc.red(`[${mode.toUpperCase()}]`) : `[${mode.toUpperCase()}]`;
      const head = `${tag} ${side} ${res.filledQty}/${qty} ${outcome} @ ${cents(res.avgPrice)} — ${res.status}`;
      const lines: [string, string][] = [
        ["Order", res.orderId],
        ["Fee", usd(res.feeUsd)],
        ["Cash flow", res.costUsd >= 0 ? `-${usd(res.costUsd)}` : `+${usd(-res.costUsd)}`],
      ];
      if (res.message) lines.push(["Note", res.message]);
      return `${head}\n${keyValues(lines, color)}`;
    },
  };
}

export const runBuy = (ctx: RunContext, id: string, o: TradeFlags) => runTrade(ctx, "BUY", id, o);
export const runSell = (ctx: RunContext, id: string, o: TradeFlags) => runTrade(ctx, "SELL", id, o);

// ---------------------------------------------------------------------------
// Portfolio (paper)
// ---------------------------------------------------------------------------

async function markPositions(positions: Position[]): Promise<Array<Position & { mark: number | null; unrealized: number | null }>> {
  const out: Array<Position & { mark: number | null; unrealized: number | null }> = [];
  for (const p of positions) {
    let mark: number | null = null;
    try {
      const m = await marketData(p.venue).getMarket(p.marketId);
      mark = (p.outcome === "YES" ? m.yesPrice : m.noPrice) ?? null;
    } catch {
      /* mark best-effort */
    }
    const unrealized = mark != null ? (mark - p.avgPrice) * p.quantity : null;
    out.push({ ...p, mark, unrealized });
  }
  return out;
}

export async function runPositions(ctx: RunContext): Promise<CommandOutput> {
  const state = loadPaper();
  const marked = await markPositions(state.positions);
  return {
    data: { positions: marked },
    render: (color) => {
      const cols: Column<(typeof marked)[number]>[] = [
        { header: "Venue", get: (p) => p.venue },
        { header: "Market", get: (p) => (p.question ?? p.marketId).slice(0, 40) },
        { header: "Side", get: (p) => p.outcome },
        { header: "Qty", get: (p) => String(p.quantity), align: "right" },
        { header: "Avg", get: (p) => cents(p.avgPrice), align: "right" },
        { header: "Mark", get: (p) => cents(p.mark), align: "right" },
        { header: "uPnL", get: (p) => (p.unrealized == null ? "—" : usd(p.unrealized)), align: "right", paint: (v, p) => (color && p.unrealized != null ? (p.unrealized >= 0 ? pc.green(v) : pc.red(v)) : v) },
      ];
      return table(marked, cols, color);
    },
  };
}

export async function runPortfolio(ctx: RunContext): Promise<CommandOutput> {
  const state = loadPaper();
  const marked = await markPositions(state.positions);
  const positionsValue = marked.reduce((a, p) => a + (p.mark ?? p.avgPrice) * p.quantity, 0);
  const unrealized = marked.reduce((a, p) => a + (p.unrealized ?? 0), 0);
  const equity = state.cashUsd + positionsValue;
  const totalPnl = equity - state.startingCash;
  return {
    data: {
      cashUsd: state.cashUsd,
      positionsValueUsd: positionsValue,
      equityUsd: equity,
      startingCashUsd: state.startingCash,
      realizedPnlUsd: state.realizedPnlUsd,
      unrealizedPnlUsd: unrealized,
      totalPnlUsd: totalPnl,
      openPositions: marked.length,
    },
    render: (color) =>
      keyValues(
        [
          ["Cash", usd(state.cashUsd)],
          ["Positions value", usd(positionsValue)],
          ["Equity", color ? pc.bold(usd(equity)) : usd(equity)],
          ["Realized P&L", pnlPaint(state.realizedPnlUsd, color)],
          ["Unrealized P&L", pnlPaint(unrealized, color)],
          ["Total P&L", `${pnlPaint(totalPnl, color)}  ${color ? pc.dim(`(from ${usd(state.startingCash)})`) : `(from ${usd(state.startingCash)})`}`],
          ["Open positions", String(marked.length)],
        ],
        color,
      ),
  };
}

export async function runFills(ctx: RunContext, limit: number): Promise<CommandOutput> {
  const fills = loadPaper().fills.slice(-limit).reverse();
  return {
    data: { fills },
    render: (color) => {
      const cols: Column<(typeof fills)[number]>[] = [
        { header: "When", get: (f) => new Date(f.ts).toISOString().slice(5, 16).replace("T", " ") },
        { header: "Venue", get: (f) => f.venue },
        { header: "Side", get: (f) => `${f.side} ${f.outcome}` },
        { header: "Qty", get: (f) => String(f.quantity), align: "right" },
        { header: "Price", get: (f) => cents(f.price), align: "right" },
        { header: "Market", get: (f) => f.marketId.slice(0, 24) },
      ];
      return table(fills, cols, color);
    },
  };
}

export async function runOrders(ctx: RunContext, limit: number): Promise<CommandOutput> {
  const orders = loadPaper().orders.slice(0, limit);
  return {
    data: { orders },
    render: (color) => {
      const cols: Column<(typeof orders)[number]>[] = [
        { header: "When", get: (o) => new Date(o.ts).toISOString().slice(5, 16).replace("T", " ") },
        { header: "Venue", get: (o) => o.venue },
        { header: "Side", get: (o) => `${o.side} ${o.outcome}` },
        { header: "Qty", get: (o) => `${o.filledQty}/${o.quantity}`, align: "right" },
        { header: "Avg", get: (o) => cents(o.avgPrice), align: "right" },
        { header: "Status", get: (o) => o.status },
        { header: "Market", get: (o) => o.marketId.slice(0, 22) },
      ];
      return table(orders, cols, color);
    },
  };
}

// ---------------------------------------------------------------------------
// Config / safety commands
// ---------------------------------------------------------------------------

export function runAcceptRisk(ctx: RunContext): CommandOutput {
  const s = loadSettings();
  s.riskAcceptedAt = Date.now();
  saveSettings(s);
  return {
    data: { riskAcceptedAt: s.riskAcceptedAt },
    render: (color) =>
      (color ? pc.green("✓ ") : "✓ ") +
      "Risk acknowledged. Live trading is now unlocked (still gated by --live, confirmation and size caps).\n" +
      (color ? pc.dim(LIVE_BANNER) : LIVE_BANNER),
  };
}

export function runPaperReset(ctx: RunContext, cash: number): CommandOutput {
  const s = resetPaper(cash || DEFAULT_CASH);
  return {
    data: { cashUsd: s.cashUsd },
    render: (color) => (color ? pc.green("✓ ") : "✓ ") + `Paper account reset to ${usd(s.cashUsd)}.`,
  };
}

export function runConfig(ctx: RunContext): CommandOutput {
  const s = loadSettings();
  return {
    data: s,
    render: (color) =>
      keyValues(
        [
          ["Risk accepted", s.riskAcceptedAt ? new Date(s.riskAcceptedAt).toISOString() : "no"],
          ["Max order USD", String(s.maxOrderUsd ?? DEFAULTS.maxOrderUsd)],
          ["Max position USD", String(s.maxPositionUsd ?? DEFAULTS.maxPositionUsd)],
          ["Kalshi env", s.kalshiEnv ?? "live"],
        ],
        color,
      ),
  };
}
