import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { ScreenProps } from "../App";
import { fetchLive, fetchMatches, type Match } from "../../core/commands/wc26";
import { useAsync, useTick } from "../hooks";
import { Panel } from "../components/Panel";
import { MatchRows } from "../components/Matches";
import { glyph } from "../theme";

export function Live({ ctx, active, goTab }: ScreenProps): React.ReactElement {
  const [manual, setManual] = useState(0);
  const auto = useTick(15_000);
  const live = useAsync(() => fetchLive(ctx), [auto, manual]);
  const upcoming = useAsync(
    () => fetchMatches(ctx, { status: "scheduled", limit: 12 }).catch(() => [] as Match[]),
    [manual],
  );

  useInput(
    (input, key) => {
      if (key.escape || input === "b") goTab("home");
      if (input === "r") setManual((n) => n + 1);
    },
    { isActive: active },
  );

  const loadingLive = live.loading && live.loads === 0;
  return (
    <Box flexDirection="column">
      <Panel
        title={`${glyph.ball} Live scoreboard`}
        subtitle={live.loading ? "refreshing…" : "auto-refresh 15s · r now"}
      >
        {loadingLive ? (
          <Text>
            <Spinner type="dots" /> loading…
          </Text>
        ) : live.error ? (
          <Text color="red">{live.error}</Text>
        ) : (live.data ?? []).length === 0 ? (
          <Text dimColor>No matches are live right now.</Text>
        ) : (
          <MatchRows matches={live.data ?? []} max={20} showStage />
        )}
      </Panel>
      <Box marginTop={1}>
        <Panel title="🗓  Upcoming fixtures" subtitle={(upcoming.data ?? []).length ? `next ${(upcoming.data ?? []).length}` : ""}>
          {upcoming.loading && upcoming.loads === 0 ? (
            <Text>
              <Spinner type="dots" /> loading…
            </Text>
          ) : (upcoming.data ?? []).length === 0 ? (
            <Text dimColor>No scheduled fixtures returned.</Text>
          ) : (
            <MatchRows matches={upcoming.data ?? []} max={10} showStage />
          )}
        </Panel>
      </Box>
    </Box>
  );
}
