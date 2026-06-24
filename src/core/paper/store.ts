import { paperPath } from "../config/paths";
import { readJson, writeJson } from "../config/store";
import type { Fill, Outcome, OrderType, Position, Side, Venue } from "../exchanges/types";

export interface PaperOrder {
  orderId: string;
  venue: Venue;
  marketId: string;
  question?: string;
  side: Side;
  outcome: Outcome;
  type: OrderType;
  limitPrice?: number;
  quantity: number;
  filledQty: number;
  avgPrice: number | null;
  feeUsd: number;
  status: "filled" | "partial" | "resting" | "rejected";
  ts: number;
}

export interface PaperState {
  version: 1;
  startingCash: number;
  cashUsd: number;
  positions: Position[];
  orders: PaperOrder[];
  fills: Fill[];
  realizedPnlUsd: number;
  updatedAt: number;
}

export const DEFAULT_CASH = 10_000;

export function freshState(cash = DEFAULT_CASH): PaperState {
  return {
    version: 1,
    startingCash: cash,
    cashUsd: cash,
    positions: [],
    orders: [],
    fills: [],
    realizedPnlUsd: 0,
    updatedAt: 0,
  };
}

export function loadPaper(): PaperState {
  return readJson<PaperState>(paperPath(), freshState());
}

export function savePaper(state: PaperState): void {
  state.updatedAt = Date.now();
  // Keep the file from growing without bound.
  if (state.fills.length > 2000) state.fills = state.fills.slice(-2000);
  if (state.orders.length > 500) state.orders = state.orders.slice(0, 500);
  writeJson(paperPath(), state, 0o600);
}

export function resetPaper(cash = DEFAULT_CASH): PaperState {
  const s = freshState(cash);
  savePaper(s);
  return s;
}
