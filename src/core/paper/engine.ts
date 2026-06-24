import type { Orderbook, OrderResult, PlaceOrderParams, TradeMode, Venue } from "../exchanges/types";
import { estimateFee, type FeeConfig } from "../quant/fees";
import type { PaperOrder, PaperState } from "./store";

export interface FillSim {
  legs: { price: number; qty: number }[]; // price in the OUTCOME's terms
  filledQty: number;
  avgPrice: number | null;
  notionalUsd: number;
  status: "filled" | "partial" | "resting" | "rejected";
}

/**
 * Walk the REAL book to produce a realistic fill. Everything is expressed in the
 * order's outcome (YES or NO). Buying NO consumes the YES bid side at price
 * (1 − yes); selling NO consumes the YES ask side. LIMIT orders only take levels
 * at/through the limit; the rest rests.
 */
export function simulateFill(book: Orderbook, params: PlaceOrderParams): FillSim {
  const { side, outcome, type, limitPrice, quantity } = params;

  let levels;
  let priceOf: (yesPrice: number) => number;
  let withinLimit: (p: number) => boolean;

  if (outcome === "YES" && side === "BUY") {
    levels = book.asks;
    priceOf = (y) => y;
    withinLimit = (p) => limitPrice == null || p <= limitPrice + 1e-9;
  } else if (outcome === "YES" && side === "SELL") {
    levels = book.bids;
    priceOf = (y) => y;
    withinLimit = (p) => limitPrice == null || p >= limitPrice - 1e-9;
  } else if (outcome === "NO" && side === "BUY") {
    levels = book.bids;
    priceOf = (y) => 1 - y;
    withinLimit = (p) => limitPrice == null || p <= limitPrice + 1e-9;
  } else {
    // NO SELL
    levels = book.asks;
    priceOf = (y) => 1 - y;
    withinLimit = (p) => limitPrice == null || p >= limitPrice - 1e-9;
  }

  let remaining = quantity;
  const legs: { price: number; qty: number }[] = [];
  for (const lv of levels) {
    if (remaining <= 0) break;
    const p = priceOf(lv.price);
    if (type === "LIMIT" && !withinLimit(p)) break; // levels are monotonic -> safe to stop
    const take = Math.min(remaining, lv.size);
    if (take <= 0) continue;
    legs.push({ price: p, qty: take });
    remaining -= take;
  }

  const filledQty = quantity - remaining;
  const notionalUsd = legs.reduce((a, l) => a + l.price * l.qty, 0);
  const avgPrice = filledQty > 0 ? notionalUsd / filledQty : null;
  const status: FillSim["status"] =
    filledQty === 0 ? (type === "LIMIT" ? "resting" : "rejected") : remaining > 1e-9 ? "partial" : "filled";
  return { legs, filledQty, avgPrice, notionalUsd, status };
}

function genOrderId(): string {
  return `paper-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Apply a simulated fill to the paper state: move cash, update the position
 * (weighted-average entry; SELL realizes P&L), and append fills + the order.
 */
export function applyPaperOrder(
  state: PaperState,
  params: PlaceOrderParams,
  sim: FillSim,
  venue: Venue,
  question: string | undefined,
  feeCfg: FeeConfig,
  mode: TradeMode,
): OrderResult {
  const orderId = genOrderId();
  // p*(1-p) is symmetric, so the outcome price works directly for the Kalshi fee.
  const fee =
    sim.filledQty > 0 && sim.avgPrice != null ? estimateFee(venue, sim.filledQty, sim.avgPrice, feeCfg) : 0;

  let costUsd: number;
  if (params.side === "BUY") {
    costUsd = sim.notionalUsd + fee; // cash out
  } else {
    costUsd = -(sim.notionalUsd - fee); // cash in (negative cost)
  }
  state.cashUsd -= costUsd;

  if (sim.filledQty > 0 && sim.avgPrice != null) {
    applyToPositions(state, venue, params, question, sim.avgPrice, sim.filledQty);
    for (const leg of sim.legs) {
      state.fills.push({
        orderId,
        venue,
        marketId: params.marketId,
        outcome: params.outcome,
        side: params.side,
        price: Number(leg.price.toFixed(4)),
        quantity: leg.qty,
        feeUsd: Number(((fee * leg.qty) / sim.filledQty).toFixed(4)),
        ts: Date.now(),
      });
    }
  }

  const order: PaperOrder = {
    orderId,
    venue,
    marketId: params.marketId,
    question,
    side: params.side,
    outcome: params.outcome,
    type: params.type,
    limitPrice: params.limitPrice,
    quantity: params.quantity,
    filledQty: sim.filledQty,
    avgPrice: sim.avgPrice != null ? Number(sim.avgPrice.toFixed(4)) : null,
    feeUsd: Number(fee.toFixed(4)),
    status: sim.status,
    ts: Date.now(),
  };
  state.orders.unshift(order);

  return {
    orderId,
    venue,
    mode,
    status: sim.status === "filled" || sim.status === "partial" ? "simulated" : sim.status,
    filledQty: sim.filledQty,
    avgPrice: order.avgPrice,
    feeUsd: order.feeUsd,
    costUsd: Number(costUsd.toFixed(4)),
    message: sim.status === "resting" ? "No book at your limit — order would rest (paper: not filled)." : undefined,
  };
}

function applyToPositions(
  state: PaperState,
  venue: Venue,
  params: PlaceOrderParams,
  question: string | undefined,
  avgPrice: number,
  filledQty: number,
): void {
  const idx = state.positions.findIndex(
    (p) => p.venue === venue && p.marketId === params.marketId && p.outcome === params.outcome,
  );
  const pos = idx >= 0 ? state.positions[idx]! : null;

  if (params.side === "BUY") {
    if (!pos) {
      state.positions.push({
        venue,
        marketId: params.marketId,
        question,
        outcome: params.outcome,
        quantity: filledQty,
        avgPrice,
      });
    } else {
      const newQty = pos.quantity + filledQty;
      pos.avgPrice = Number(((pos.avgPrice * pos.quantity + avgPrice * filledQty) / newQty).toFixed(4));
      pos.quantity = newQty;
    }
  } else if (pos) {
    // SELL closes the position; realize P&L vs the weighted entry.
    const closeQty = Math.min(pos.quantity, filledQty);
    state.realizedPnlUsd = Number((state.realizedPnlUsd + (avgPrice - pos.avgPrice) * closeQty).toFixed(4));
    pos.quantity -= closeQty;
    if (pos.quantity <= 1e-9) state.positions.splice(idx, 1);
  }
}
