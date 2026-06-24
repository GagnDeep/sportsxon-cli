import React from "react";
import { Box, Text } from "ink";

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: "Navigation",
    rows: [
      ["1 – 5", "jump to Home / Live / Markets / Portfolio / Quant"],
      ["Tab / ⇧Tab", "cycle tabs forward / back"],
      ["? ", "toggle this help"],
      ["q / Ctrl-C", "quit"],
    ],
  },
  {
    title: "Lists & forms",
    rows: [
      ["↑ ↓", "move selection / change field"],
      ["Enter", "open / submit"],
      ["Esc / b", "back / cancel"],
      ["v", "switch venue (Markets)"],
      ["/", "search (Markets)"],
      ["r", "refresh"],
    ],
  },
  {
    title: "Trading (paper)",
    rows: [
      ["o", "open order ticket on a market"],
      ["Tab", "next field in the ticket"],
      ["Enter", "place the (paper) order"],
      ["Live trading", "use the CLI: sportsxon buy <id> --live"],
    ],
  },
];

/** A centred modal-style help card. */
export function HelpOverlay(): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1}>
      <Text bold color="cyan">
        ⚽ sportsxon — keyboard reference
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {SECTIONS.map((s) => (
          <Box key={s.title} flexDirection="column" marginBottom={1}>
            <Text bold>{s.title}</Text>
            {s.rows.map(([k, v]) => (
              <Box key={k}>
                <Box width={14}>
                  <Text color="yellow">{k}</Text>
                </Box>
                <Text dimColor>{v}</Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      <Text dimColor>Press ? or Esc to close.</Text>
    </Box>
  );
}
