import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme";

/**
 * A titled, bordered panel. `active` highlights the border so the user always
 * knows which region currently has focus.
 */
export function Panel({
  title,
  subtitle,
  active = false,
  color,
  children,
  flexGrow,
  width,
  minHeight,
}: {
  title?: string;
  subtitle?: string;
  active?: boolean;
  color?: string;
  children: React.ReactNode;
  flexGrow?: number;
  width?: number | string;
  minHeight?: number;
}): React.ReactElement {
  const borderColor = color ?? (active ? theme.border.active : theme.border.idle);
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      flexGrow={flexGrow}
      width={width}
      minHeight={minHeight}
    >
      {title ? (
        <Box marginBottom={0} justifyContent="space-between">
          <Text bold color={active ? theme.color.accent : undefined}>
            {title}
          </Text>
          {subtitle ? <Text dimColor>{subtitle}</Text> : null}
        </Box>
      ) : null}
      {children}
    </Box>
  );
}
