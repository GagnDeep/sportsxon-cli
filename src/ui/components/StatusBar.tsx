import React from "react";
import { Box, Text } from "ink";
import type { RunContext } from "../../context";
import { glyph } from "../theme";
import { VenueBadge, ModeBadge } from "./Badges";

export type Tab = "home" | "live" | "markets" | "portfolio" | "quant";

export const TABS: { id: Tab; label: string; key: string }[] = [
  { id: "home", label: "Home", key: "1" },
  { id: "live", label: "Live", key: "2" },
  { id: "markets", label: "Markets", key: "3" },
  { id: "portfolio", label: "Portfolio", key: "4" },
  { id: "quant", label: "Quant", key: "5" },
];

/** The persistent top bar: brand, tab strip, venue/mode badges, clock. */
export function TopBar({
  ctx,
  active,
  clock,
}: {
  ctx: RunContext;
  active: Tab;
  clock: string;
}): React.ReactElement {
  return (
    <Box
      borderStyle="round"
      borderColor="green"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text bold color="green">
          {glyph.ball} sportsxon
        </Text>
        <Text>  </Text>
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <Text key={t.id}>
              <Text color={on ? "black" : "gray"} backgroundColor={on ? "cyan" : undefined} bold={on}>
                {` ${t.key} ${t.label} `}
              </Text>
              <Text> </Text>
            </Text>
          );
        })}
      </Box>
      <Box>
        <VenueBadge venue={ctx.venue} />
        <Text> </Text>
        <ModeBadge mode="paper" />
        <Text dimColor> {clock}</Text>
      </Box>
    </Box>
  );
}

/** The persistent bottom hint bar. */
export function HintBar({ hints }: { hints: string }): React.ReactElement {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text dimColor>{hints}</Text>
      <Text dimColor>? help · q quit</Text>
    </Box>
  );
}
