import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import SelectInput from "ink-select-input";
import type { RunContext } from "../../context";
import { fetchLive } from "../../core/commands/wc26";
import { loadPaper } from "../../core/paper/store";
import { useAsync } from "../hooks";
import { MatchRows } from "../components/Matches";

export type Screen = "home" | "live" | "markets" | "portfolio";

export function Home({
  ctx,
  onNavigate,
  onQuit,
}: {
  ctx: RunContext;
  onNavigate: (s: Screen) => void;
  onQuit: () => void;
}): React.ReactElement {
  const live = useAsync(() => fetchLive(ctx), []);
  const paper = loadPaper();

  const items = [
    { label: "📊  Live scoreboard", value: "live" },
    { label: "💹  Browse markets", value: "markets" },
    { label: "💼  Portfolio", value: "portfolio" },
    { label: "🚪  Quit", value: "quit" },
  ];

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>Live now</Text>
        {live.loading ? (
          <Text>
            <Spinner type="dots" /> loading…
          </Text>
        ) : live.error ? (
          <Text color="red">{live.error}</Text>
        ) : (
          <MatchRows matches={live.data ?? []} max={5} />
        )}
      </Box>
      <Box paddingX={1}>
        <Text>
          Paper cash: <Text color="green">${paper.cashUsd.toFixed(2)}</Text> · open positions: {paper.positions.length}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <SelectInput
          items={items}
          onSelect={(it) => (it.value === "quit" ? onQuit() : onNavigate(it.value as Screen))}
        />
      </Box>
    </Box>
  );
}
