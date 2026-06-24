import React from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { RunContext } from "../../context";
import { fetchLive } from "../../core/commands/wc26";
import { useAsync, useTick } from "../hooks";
import { MatchRows } from "../components/Matches";

export function Live({ ctx, onBack }: { ctx: RunContext; onBack: () => void }): React.ReactElement {
  const tick = useTick(15_000);
  const live = useAsync(() => fetchLive(ctx), [tick]);
  useInput((input, key) => {
    if (key.escape || input === "b") onBack();
  });
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>
        Live scoreboard {live.loading ? <Spinner type="dots" /> : null}{" "}
        <Text dimColor>(auto-refresh 15s)</Text>
      </Text>
      {live.error ? <Text color="red">{live.error}</Text> : <MatchRows matches={live.data ?? []} max={30} />}
    </Box>
  );
}
