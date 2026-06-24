import React from "react";
import { Box, Text } from "ink";
import type { RunContext } from "../../context";

export function Header({ ctx, screen }: { ctx: RunContext; screen: string }): React.ReactElement {
  return (
    <Box justifyContent="space-between" borderStyle="round" borderColor="green" paddingX={1}>
      <Text color="green" bold>
        ⚽ sportsxon
      </Text>
      <Text dimColor>
        {screen} · venue {ctx.venue} · {" "}
        <Text color="cyan">PAPER</Text>
      </Text>
    </Box>
  );
}

export function Footer({ hint }: { hint: string }): React.ReactElement {
  return (
    <Box paddingX={1}>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}
