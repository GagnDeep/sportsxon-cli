import { describe, it, expect } from "vitest";
import { simulateFill, applyPaperOrder } from "../src/core/paper/engine";
import { freshState } from "../src/core/paper/store";
import type { Orderbook, PlaceOrderParams } from "../src/core/exchanges/types";

const book: Orderbook = {
  venue: "kalshi",
  marketId: "TEST",
  asks: [
    { price: 0.5, size: 10 },
    { price: 0.55, size: 10 },
  ],
  bids: [
    { price: 0.45, size: 10 },
    { price: 0.4, size: 10 },
  ],
  ts: 0,
};

const order = (p: Partial<PlaceOrderParams>): PlaceOrderParams => ({
  marketId: "TEST",
  side: "BUY",
  outcome: "YES",
  type: "MARKET",
  quantity: 10,
  ...p,
});

describe("simulateFill", () => {
  it("walks the ask book for a YES market buy (VWAP + slippage)", () => {
    const sim = simulateFill(book, order({ quantity: 15 }));
    expect(sim.filledQty).toBe(15);
    expect(sim.notionalUsd).toBeCloseTo(10 * 0.5 + 5 * 0.55, 6);
    expect(sim.avgPrice).toBeCloseTo(7.75 / 15, 6);
    expect(sim.status).toBe("filled");
  });

  it("respects a YES buy limit (rests the remainder)", () => {
    const sim = simulateFill(book, order({ quantity: 15, type: "LIMIT", limitPrice: 0.5 }));
    expect(sim.filledQty).toBe(10); // only the 0.50 level is at/through the limit
    expect(sim.status).toBe("partial");
  });

  it("buys NO against the YES bid side at (1 - price)", () => {
    const sim = simulateFill(book, order({ outcome: "NO", quantity: 10 }));
    expect(sim.filledQty).toBe(10);
    expect(sim.avgPrice).toBeCloseTo(1 - 0.45, 6); // 0.55
  });

  it("sells YES against the bid side", () => {
    const sim = simulateFill(book, order({ side: "SELL", quantity: 10 }));
    expect(sim.avgPrice).toBeCloseTo(0.45, 6);
  });
});

describe("applyPaperOrder", () => {
  it("debits cash on a buy and credits realized P&L on a profitable sell", () => {
    const state = freshState(1000);

    const buy = simulateFill(book, order({ quantity: 10 })); // 10 @ 0.50 = $5
    applyPaperOrder(state, order({ quantity: 10 }), buy, "kalshi", "Test market", {}, "paper");
    expect(state.cashUsd).toBeLessThan(1000 - 5); // $5 notional + a small fee
    expect(state.cashUsd).toBeGreaterThan(1000 - 6);
    expect(state.positions).toHaveLength(1);
    expect(state.positions[0]!.quantity).toBe(10);

    // Sell into the 0.45 bid -> realized loss vs 0.50 entry.
    const sell = simulateFill(book, order({ side: "SELL", quantity: 10 }));
    applyPaperOrder(state, order({ side: "SELL", quantity: 10 }), sell, "kalshi", "Test market", {}, "paper");
    expect(state.positions).toHaveLength(0);
    expect(state.realizedPnlUsd).toBeLessThan(0); // bought 0.50, sold 0.45
  });
});
