import React from "react";
import { Box, Text } from "ink";
import { clip } from "../theme";

export interface Col<T> {
  header: string;
  width: number;
  align?: "left" | "right";
  get: (row: T) => string;
  color?: (row: T) => string | undefined;
  dim?: (row: T) => boolean;
}

/**
 * A fixed-width, flexbox-based table for the TUI. Unlike the headless string
 * table, this renders real Ink <Box> cells so per-cell colour and the highlight
 * row compose cleanly.
 */
export function DataTable<T>({
  rows,
  cols,
  selected,
  gap = 1,
  empty = "Nothing to show.",
}: {
  rows: T[];
  cols: Col<T>[];
  selected?: number;
  gap?: number;
  empty?: string;
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box>
        {cols.map((c, i) => (
          <Box key={i} width={c.width} marginRight={i < cols.length - 1 ? gap : 0} justifyContent={c.align === "right" ? "flex-end" : "flex-start"}>
            <Text bold dimColor>
              {clip(c.header, c.width)}
            </Text>
          </Box>
        ))}
      </Box>
      {rows.length === 0 ? (
        <Text dimColor>{empty}</Text>
      ) : (
        rows.map((row, ri) => {
          const isSel = selected === ri;
          return (
            <Box key={ri}>
              {cols.map((c, ci) => {
                const raw = c.get(row);
                const txt = clip(raw, c.width);
                return (
                  <Box
                    key={ci}
                    width={c.width}
                    marginRight={ci < cols.length - 1 ? gap : 0}
                    justifyContent={c.align === "right" ? "flex-end" : "flex-start"}
                  >
                    <Text
                      color={isSel ? "black" : c.color?.(row)}
                      backgroundColor={isSel ? "cyan" : undefined}
                      dimColor={!isSel && c.dim?.(row)}
                      bold={isSel}
                    >
                      {txt}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          );
        })
      )}
    </Box>
  );
}
