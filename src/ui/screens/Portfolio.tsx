import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { ScreenProps } from "../App";
import { loadPaper } from "../../core/paper/store";
import { marketData } from "../../core/exchanges/factory";
import type { Position } from "../../core/exchanges/types";
import { useAsync } from "../hooks";
import { Panel } from "../components/Panel";
import { Pnl } from "../components/Badges";
import { DataTable, type Col } from "../components/DataTable";
import { usd, cents, signedUsd, pnlColor, clip } from "../theme";

type Marked = Position & { mark: number | null; unrealized: number | null };

export function Portfolio({ active, goTab }: ScreenProps): React.ReactElement {
  const [manual, setManual] = useState(0);
  const state = loadPaper();

  const marked = useAsync<Marked[]>(async () => {
    const out: Marked[] = [];
    for (const p of state.positions) {
      let mark: number | null = null;
      try {
        const m = await marketData(p.venue).getMarket(p.marketId);
        mark = (p.outcome === "YES" ? m.yesPrice : m.noPrice) ?? null;
      } catch {
        /* best-effort */
      }
      out.push({ ...p, mark, unrealized: mark != null ? (mark - p.avgPrice) * p.quantity : null });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, state.positions.length]);

  useInput(
    (input, key) => {
      if (key.escape || input === "b") goTab("home");
      if (input === "r") setManual((n) => n + 1);
    },
    { isActive: active },
  );

  const rows = marked.data ?? [];
  const positionsValue = rows.reduce((a, p) => a + (p.mark ?? p.avgPrice) * p.quantity, 0);
  const unrealized = rows.reduce((a, p) => a + (p.unrealized ?? 0), 0);
  const equity = state.cashUsd + positionsValue;
  const totalPnl = equity - state.startingCash;

  const cols: Col<Marked>[] = [
    { header: "Venue", width: 10, get: (p) => p.venue },
    { header: "Market", width: 30, get: (p) => clip(p.question ?? p.marketId, 30) },
    { header: "Side", width: 4, get: (p) => p.outcome },
    { header: "Qty", width: 6, align: "right", get: (p) => String(p.quantity) },
    { header: "Avg", width: 5, align: "right", get: (p) => cents(p.avgPrice) },
    { header: "Mark", width: 5, align: "right", get: (p) => cents(p.mark) },
    {
      header: "uPnL",
      width: 9,
      align: "right",
      get: (p) => (p.unrealized == null ? "—" : signedUsd(p.unrealized)),
      color: (p) => (p.unrealized == null ? undefined : pnlColor(p.unrealized)),
    },
  ];

  const fills = state.fills.slice(-8).reverse();
  const fcols: Col<(typeof fills)[number]>[] = [
    { header: "When", width: 11, get: (f) => new Date(f.ts).toISOString().slice(5, 16).replace("T", " ") },
    { header: "Venue", width: 10, get: (f) => f.venue },
    { header: "Action", width: 9, get: (f) => `${f.side} ${f.outcome}` },
    { header: "Qty", width: 5, align: "right", get: (f) => String(f.quantity) },
    { header: "Price", width: 5, align: "right", get: (f) => cents(f.price) },
    { header: "Market", width: 22, get: (f) => clip(f.marketId, 22) },
  ];

  return (
    <Box flexDirection="column">
      <Panel title="💼 Portfolio summary" subtitle={marked.loading ? "marking…" : "paper"}>
        <Box>
          <Stat label="Cash" node={<Text color="green">{usd(state.cashUsd)}</Text>} />
          <Stat label="Positions" node={<Text>{usd(positionsValue)}</Text>} />
          <Stat label="Equity" node={<Text bold>{usd(equity)}</Text>} />
        </Box>
        <Box>
          <Stat label="Realized" node={<Pnl value={state.realizedPnlUsd} />} />
          <Stat label="Unrealized" node={marked.loading && marked.loads === 0 ? <Spinner type="dots" /> : <Pnl value={unrealized} />} />
          <Stat label="Total P&L" node={<Pnl value={totalPnl} bold />} />
        </Box>
        <Text dimColor>
          started {usd(state.startingCash)} · open {rows.length} · reset with `sportsxon paper reset`
        </Text>
      </Panel>

      <Box marginTop={1}>
        <Panel title="📌 Open positions">
          {marked.loading && marked.loads === 0 ? (
            <Text>
              <Spinner type="dots" /> marking positions…
            </Text>
          ) : (
            <DataTable rows={rows} cols={cols} empty="No open positions. Open the Markets tab and press o to trade." />
          )}
        </Panel>
      </Box>

      <Box marginTop={1}>
        <Panel title="🧾 Recent fills">
          <DataTable rows={fills} cols={fcols} empty="No fills yet." />
        </Panel>
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>r refresh marks · esc home</Text>
      </Box>
    </Box>
  );
}

function Stat({ label, node }: { label: string; node: React.ReactNode }): React.ReactElement {
  return (
    <Box width={22}>
      <Box width={11}>
        <Text dimColor>{label}</Text>
      </Box>
      {node}
    </Box>
  );
}
