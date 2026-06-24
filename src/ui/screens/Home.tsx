import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import SelectInput from "ink-select-input";
import type { ScreenProps } from "../App";
import type { Tab } from "../components/StatusBar";
import { fetchLive } from "../../core/commands/wc26";
import { loadPaper } from "../../core/paper/store";
import { credStatus } from "../../core/config/credentials";
import { isRiskAccepted } from "../../core/config/settings";
import { useAsync, useTick } from "../hooks";
import { Panel } from "../components/Panel";
import { MatchRows } from "../components/Matches";
import { Pnl } from "../components/Badges";
import { usd, glyph } from "../theme";

export function Home({ ctx, active, goTab }: ScreenProps): React.ReactElement {
  const tick = useTick(20_000);
  const live = useAsync(() => fetchLive(ctx), [tick]);
  const paper = loadPaper();
  const creds = credStatus();
  const risk = isRiskAccepted();

  // Instant cost-basis snapshot (no network): equity = cash + Σ qty·avg.
  const positionsCost = paper.positions.reduce((a, p) => a + p.avgPrice * p.quantity, 0);
  const equity = paper.cashUsd + positionsCost;

  const items: { label: string; value: Tab }[] = [
    { label: "📊  Live scoreboard", value: "live" },
    { label: "💹  Browse & trade markets", value: "markets" },
    { label: "💼  Portfolio & blotter", value: "portfolio" },
    { label: "🧮  Quant calculators", value: "quant" },
  ];

  return (
    <Box flexDirection="column">
      <Box>
        <Box flexGrow={1} marginRight={1}>
          <Panel
            title={`${glyph.ball} Live now`}
            subtitle={live.loading && live.loads === 0 ? "loading…" : `${(live.data ?? []).length} live`}
          >
            {live.loading && live.loads === 0 ? (
              <Text>
                <Spinner type="dots" /> contacting sportsxon…
              </Text>
            ) : live.error ? (
              <Text color="red">{live.error}</Text>
            ) : (live.data ?? []).length === 0 ? (
              <Text dimColor>No live matches right now — open the Live tab for fixtures.</Text>
            ) : (
              <MatchRows matches={live.data ?? []} max={6} />
            )}
          </Panel>
        </Box>
        <Box width={36} flexDirection="column">
          <Panel title="💼 Paper account">
            <Snap label="Cash" value={usd(paper.cashUsd)} color="green" />
            <Snap label="Equity (cost)" value={usd(equity)} bold />
            <Box>
              <Box width={15}>
                <Text dimColor>Realized P&L</Text>
              </Box>
              <Pnl value={paper.realizedPnlUsd} />
            </Box>
            <Snap label="Open / fills" value={`${paper.positions.length} / ${paper.fills.length}`} />
          </Panel>
          <Panel title="🔌 Connections">
            {creds.map((c) => (
              <Snap
                key={c.venue}
                label={c.venue}
                value={c.configured ? `${glyph.check} ${c.source}` : "— paper only"}
                color={c.configured ? "green" : "gray"}
              />
            ))}
            <Snap label="Live trading" value={risk ? "unlocked" : "locked (paper)"} color={risk ? "yellow" : "gray"} />
          </Panel>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Quick actions</Text>
        <SelectInput isFocused={active} items={items} onSelect={(it) => goTab(it.value)} />
      </Box>
    </Box>
  );
}

function Snap({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }): React.ReactElement {
  return (
    <Box>
      <Box width={15}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text color={color} bold={bold}>
        {value}
      </Text>
    </Box>
  );
}
