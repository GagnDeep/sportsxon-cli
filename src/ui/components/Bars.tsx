import React from "react";
import { Box, Text } from "ink";

const BLOCKS = "▏▎▍▌▋▊▉█";

/** A horizontal bar that fills `value/max` of `width` cells (sub-cell precision). */
export function Bar({
  value,
  max,
  width,
  color = "cyan",
  align = "left",
}: {
  value: number;
  max: number;
  width: number;
  color?: string;
  align?: "left" | "right";
}): React.ReactElement {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const exact = frac * width;
  const full = Math.floor(exact);
  const rem = exact - full;
  const partial = rem > 0.05 ? BLOCKS[Math.min(BLOCKS.length - 1, Math.floor(rem * BLOCKS.length))] : "";
  let bar = "█".repeat(full) + partial;
  if (bar.length > width) bar = bar.slice(0, width);
  const pad = " ".repeat(Math.max(0, width - bar.length));
  return <Text color={color}>{align === "right" ? pad + bar : bar + pad}</Text>;
}

/** A labelled meter: `label  ████████░░  value`. */
export function Meter({
  label,
  value,
  max,
  width = 16,
  color = "cyan",
  display,
}: {
  label: string;
  value: number;
  max: number;
  width?: number;
  color?: string;
  display?: string;
}): React.ReactElement {
  return (
    <Box>
      <Box width={14}>
        <Text dimColor>{label}</Text>
      </Box>
      <Bar value={value} max={max} width={width} color={color} />
      <Text> {display ?? value.toFixed(2)}</Text>
    </Box>
  );
}

/** A bid/ask depth row, bars growing outward from the centre spread. */
export function DepthRow({
  bidSize,
  bidPrice,
  askSize,
  askPrice,
  maxSize,
  cellWidth = 14,
}: {
  bidSize?: number;
  bidPrice?: string;
  askSize?: number;
  askPrice?: string;
  maxSize: number;
  cellWidth?: number;
}): React.ReactElement {
  return (
    <Box>
      <Box width={6} justifyContent="flex-end">
        <Text color="green">{bidSize != null ? bidSize : ""}</Text>
      </Box>
      <Box width={cellWidth} justifyContent="flex-end" marginX={1}>
        {bidSize != null ? <Bar value={bidSize} max={maxSize} width={cellWidth} color="green" align="right" /> : <Text> </Text>}
      </Box>
      <Box width={5} justifyContent="center">
        <Text bold color="green">
          {bidPrice ?? ""}
        </Text>
      </Box>
      <Text dimColor>│</Text>
      <Box width={5} justifyContent="center">
        <Text bold color="red">
          {askPrice ?? ""}
        </Text>
      </Box>
      <Box width={cellWidth} marginX={1}>
        {askSize != null ? <Bar value={askSize} max={maxSize} width={cellWidth} color="red" /> : <Text> </Text>}
      </Box>
      <Box width={6}>
        <Text color="red">{askSize != null ? askSize : ""}</Text>
      </Box>
    </Box>
  );
}
