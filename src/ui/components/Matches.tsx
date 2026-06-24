import React from "react";
import { Box, Text } from "ink";
import type { Match } from "../../core/commands/wc26";
import { clip, glyph } from "../theme";

const LIVE = new Set(["live", "ht"]);
const PLAYED = new Set(["ft", "aet", "pen", "live", "ht"]);

function score(m: Match): string {
  return PLAYED.has(m.status) && m.homeGoals != null && m.awayGoals != null
    ? `${m.homeGoals} - ${m.awayGoals}`
    : "v";
}

function kickoff(m: Match): string {
  if (!m.kickoffUtc) return "";
  try {
    const d = new Date(m.kickoffUtc);
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function statusLabel(m: Match): { text: string; color: string } {
  if (m.status === "live") return { text: `${glyph.live} LIVE`, color: "green" };
  if (m.status === "ht") return { text: "HT", color: "green" };
  if (m.status === "ft") return { text: "FT", color: "gray" };
  if (m.status === "aet") return { text: "AET", color: "gray" };
  if (m.status === "pen") return { text: "PEN", color: "gray" };
  return { text: kickoff(m) || m.status.toUpperCase(), color: "gray" };
}

/** A compact, aligned list of fixtures with flags, scores and status pills. */
export function MatchRows({
  matches,
  max = 20,
  selected,
  showStage,
}: {
  matches: Match[];
  max?: number;
  selected?: number;
  showStage?: boolean;
}): React.ReactElement {
  if (matches.length === 0) return <Text dimColor>No matches.</Text>;
  return (
    <Box flexDirection="column">
      {matches.slice(0, max).map((m, i) => {
        const live = LIVE.has(m.status);
        const st = statusLabel(m);
        const isSel = selected === i;
        const homeWin = (m.homeGoals ?? 0) > (m.awayGoals ?? 0) && PLAYED.has(m.status);
        const awayWin = (m.awayGoals ?? 0) > (m.homeGoals ?? 0) && PLAYED.has(m.status);
        return (
          <Box key={m.slug}>
            <Box width={2}>
              <Text color="cyan">{isSel ? "›" : " "}</Text>
            </Box>
            {showStage ? (
              <Box width={7}>
                <Text dimColor>{clip(m.groupLetter ? `Grp ${m.groupLetter}` : m.stage, 7)}</Text>
              </Box>
            ) : null}
            <Box width={22} justifyContent="flex-end">
              <Text bold={homeWin} dimColor={awayWin}>
                {clip(`${m.homeTeamName} ${m.homeFlag ?? ""}`, 22)}
              </Text>
            </Box>
            <Box width={9} justifyContent="center">
              <Text bold color={live ? "green" : undefined}>
                {score(m)}
              </Text>
            </Box>
            <Box width={22}>
              <Text bold={awayWin} dimColor={homeWin}>
                {clip(`${m.awayFlag ?? ""} ${m.awayTeamName}`, 22)}
              </Text>
            </Box>
            <Box width={12}>
              <Text color={st.color} bold={live}>
                {st.text}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
