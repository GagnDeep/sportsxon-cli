import React from "react";
import { Box, Text, useInput } from "ink";
import type { RunContext } from "../../context";
import { loadPaper } from "../../core/paper/store";

const pnlColor = (n: number) => (n >= 0 ? "green" : "red");

export function Portfolio({ ctx: _ctx, onBack }: { ctx: RunContext; onBack: () => void }): React.ReactElement {
  useInput((input, key) => {
    if (key.escape || input === "b") onBack();
  });
  const s = loadPaper();
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Portfolio (paper)</Text>
      <Text>
        Cash <Text color="green">${s.cashUsd.toFixed(2)}</Text> · Realized P&amp;L{" "}
        <Text color={pnlColor(s.realizedPnlUsd)}>${s.realizedPnlUsd.toFixed(2)}</Text> ·{" "}
        <Text dimColor>start ${s.startingCash.toFixed(0)}</Text>
      </Text>
      <Box marginTop={1} flexDirection="column">
        {s.positions.length === 0 ? (
          <Text dimColor>No open positions. Try `sportsxon buy &lt;market&gt; --qty N`.</Text>
        ) : (
          s.positions.map((p, i) => (
            <Box key={i}>
              <Box width={12}>
                <Text dimColor>{p.venue}</Text>
              </Box>
              <Box width={34}>
                <Text>{(p.question ?? p.marketId).slice(0, 32)}</Text>
              </Box>
              <Box width={5}>
                <Text>{p.outcome}</Text>
              </Box>
              <Box width={7} justifyContent="flex-end">
                <Text>{p.quantity}</Text>
              </Box>
              <Box width={6} justifyContent="flex-end">
                <Text>{Math.round(p.avgPrice * 100)}¢</Text>
              </Box>
            </Box>
          ))
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>esc / b back</Text>
      </Box>
    </Box>
  );
}
