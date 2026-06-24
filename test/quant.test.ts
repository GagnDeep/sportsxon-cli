import { describe, it, expect } from "vitest";
import { kelly, expectedValue, arbitrage, devig, payout, oddsView, centsToProb } from "../src/core/quant";
import { kalshiFee } from "../src/core/quant/fees";

describe("kelly", () => {
  it("sizes a positive edge and zeroes a non-edge", () => {
    // fair 60%, price 50¢: b=1, f = (1*0.6 - 0.4)/1 = 0.2
    const k = kelly(0.6, 0.5);
    expect(k.fullFraction).toBeCloseTo(0.2, 6);
    expect(k.halfFraction).toBeCloseTo(0.1, 6);
    expect(kelly(0.5, 0.5).fullFraction).toBe(0); // no edge
    expect(kelly(0.4, 0.5).fullFraction).toBe(0); // negative -> clamped 0
  });
});

describe("expectedValue", () => {
  it("computes EV per contract and per $100", () => {
    const ev = expectedValue(0.6, 0.5);
    expect(ev.evPerContract).toBeCloseTo(0.1, 6); // 0.6 - 0.5
    expect(ev.evPer100).toBeCloseTo(20, 4); // 0.1/0.5*100
    expect(ev.positive).toBe(true);
    expect(expectedValue(0.4, 0.5).positive).toBe(false);
  });
});

describe("arbitrage", () => {
  it("detects an arb and sizes equal-payout legs", () => {
    const a = arbitrage(0.45, 0.45, 100); // sum 0.9 < 1
    expect(a.isArb).toBe(true);
    expect(a.profit).toBeGreaterThan(0);
    // equal cost legs => equal stakes
    expect(a.yesStake).toBeCloseTo(a.noStake, 1);
    expect(arbitrage(0.55, 0.55).isArb).toBe(false);
  });
});

describe("devig", () => {
  it("normalizes implied probabilities to sum 1", () => {
    const r = devig([centsToProb(55), centsToProb(50)]); // sum 1.05
    expect(r.overround).toBeCloseTo(0.05, 4);
    const sum = r.fair.reduce((x, y) => x + y, 0);
    expect(sum).toBeCloseTo(1, 6);
  });
});

describe("payout", () => {
  it("computes contracts, payout and ROI", () => {
    const p = payout(0.5, 100); // 200 contracts, payout 200
    expect(p.contracts).toBeCloseTo(200, 4);
    expect(p.maxPayout).toBeCloseTo(200, 4);
    expect(p.profitIfYes).toBeCloseTo(100, 4);
    expect(p.profitIfNo).toBeCloseTo(-100, 4);
    expect(p.roi).toBeCloseTo(1, 4);
  });
});

describe("oddsView", () => {
  it("round-trips representations", () => {
    const v = oddsView(0.5);
    expect(v.cents).toBe(50);
    expect(v.decimal).toBeCloseTo(2, 4);
    expect(v.american).toBe(100);
  });
});

describe("kalshiFee", () => {
  it("rounds up to the next cent", () => {
    // 0.07 * 1 * 0.5 * 0.5 = 0.0175 -> ceil to $0.02
    expect(kalshiFee(1, 0.5)).toBeCloseTo(0.02, 6);
    expect(kalshiFee(100, 0.99)).toBeGreaterThan(0);
  });
});
