import React from "react";
import { Text } from "ink";
import type { TradeMode, Venue } from "../../core/exchanges/types";
import { signedUsd, pnlColor } from "../theme";

export function VenueBadge({ venue }: { venue: Venue }): React.ReactElement {
  const label = venue === "kalshi" ? " KALSHI " : " POLYMARKET ";
  return (
    <Text bold color="black" backgroundColor={venue === "kalshi" ? "cyan" : "magenta"}>
      {label}
    </Text>
  );
}

export function ModeBadge({ mode }: { mode: TradeMode }): React.ReactElement {
  const map = {
    paper: { bg: "blue", label: " PAPER " },
    demo: { bg: "yellow", label: " DEMO " },
    live: { bg: "red", label: " ● LIVE " },
  } as const;
  const m = map[mode];
  return (
    <Text bold color="black" backgroundColor={m.bg}>
      {m.label}
    </Text>
  );
}

/** Coloured signed P&L text. */
export function Pnl({ value, bold = false }: { value: number; bold?: boolean }): React.ReactElement {
  return (
    <Text color={pnlColor(value)} bold={bold}>
      {signedUsd(value)}
    </Text>
  );
}

/** A small status pill, e.g. for live/upcoming/final match status. */
export function Pill({ text, color = "gray" }: { text: string; color?: string }): React.ReactElement {
  return (
    <Text color="black" backgroundColor={color}>
      {` ${text} `}
    </Text>
  );
}
