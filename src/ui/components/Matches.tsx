import React from "react";
import { Box, Text } from "ink";
import type { Match } from "../../core/commands/wc26";

const LIVE = new Set(["live", "ht"]);

function score(m: Match): string {
  return m.homeGoals != null && m.awayGoals != null ? `${m.homeGoals}-${m.awayGoals}` : "v";
}

export function MatchRows({ matches, max = 20 }: { matches: Match[]; max?: number }): React.ReactElement {
  if (matches.length === 0) return <Text dimColor>No matches.</Text>;
  return (
    <Box flexDirection="column">
      {matches.slice(0, max).map((m) => {
        const live = LIVE.has(m.status);
        return (
          <Box key={m.slug}>
            <Box width={24} justifyContent="flex-end">
              <Text>
                {m.homeFlag ?? ""} {m.homeTeamName}
              </Text>
            </Box>
            <Box width={7} justifyContent="center">
              <Text bold color={live ? "green" : undefined}>
                {score(m)}
              </Text>
            </Box>
            <Box width={24}>
              <Text>
                {m.awayFlag ?? ""} {m.awayTeamName}
              </Text>
            </Box>
            <Text color={live ? "green" : undefined} dimColor={!live}>
              {live ? " ● LIVE" : ` ${m.status.toUpperCase()}`}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
